'use strict';

const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');
const { createSecurity, transaction, failure, safeError, hash, randomToken } = require('../auth-security');

const GENERIC_MESSAGE = 'If the account is eligible, recovery instructions have been sent.';
const email = Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(255).required();
const daycareCode = Joi.string().trim().lowercase().max(64).pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/).required();
const password = Joi.string().custom((value, helpers) => {
  const bytes = Buffer.byteLength(value, 'utf8');
  return bytes >= 12 && bytes <= 72 ? value : helpers.error('any.invalid');
}).required();
const TOKEN_PATTERNS = { daycare: /^dr1\.[A-Za-z0-9_-]{43}$/, platform: /^pr1\.[A-Za-z0-9_-]{43}$/ };

function validate(kind, operation, input) {
  if (!TOKEN_PATTERNS[kind]) throw failure(422, 'Invalid recovery request');
  const fields = operation === 'forgot'
    ? { email } : { token: Joi.string().pattern(TOKEN_PATTERNS[kind]).required(), new_password: password };
  if (kind === 'daycare') fields.daycare_code = daycareCode;
  const result = Joi.object(fields).unknown(false).required().validate(input);
  if (result.error) throw failure(422, 'Invalid recovery request');
  return result.value;
}

function validateChange(input) {
  const result = Joi.object({ current_password: Joi.string().min(1).max(128).required(), new_password: password })
    .unknown(false).required().validate(input);
  if (result.error) throw failure(422, 'Invalid password change request');
  return result.value;
}

function recoveryTable(kind) {
  return kind === 'daycare' ? 'daycare_password_reset_tokens' : 'platform_password_reset_tokens';
}

function principalColumns(principal) {
  return principal.principal_kind === 'daycare'
    ? { daycare_id: principal.daycare_id, user_id: principal.id, platform_account_id: null }
    : { daycare_id: null, user_id: null, platform_account_id: principal.id };
}

function mailAad(row) {
  return row.user_id !== null
    ? `local-mail:daycare:${row.daycare_id}:${row.user_id}:${row.id}`
    : `local-mail:platform:global:${row.platform_account_id}:${row.id}`;
}

function createAccountRecovery({ pool, config = {}, security: suppliedSecurity }) {
  if (!pool || typeof pool.query !== 'function' || typeof pool.connect !== 'function') throw new TypeError('A PostgreSQL pool is required');
  const settings = { enabled: false, allowedOrigins: [], resetBaseUrl: 'http://localhost:8081', ...config };
  const base = new URL(settings.resetBaseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash
    || base.pathname !== '/' || !Array.isArray(settings.allowedOrigins)) throw new TypeError('Invalid recovery configuration');
  const security = suppliedSecurity || createSecurity({ pool, config: settings });

  async function queue(client, principal, kind, payload, ttlSeconds) {
    const row = { id: randomUUID(), ...principalColumns(principal) };
    const ciphertext = security.vault.encrypt(JSON.stringify(payload), mailAad(row), 'local-mail');
    await client.query(`INSERT INTO auth_mail_outbox
      (id, daycare_id, user_id, platform_account_id, recipient, kind, payload_ciphertext, encryption_key_id, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, clock_timestamp(), clock_timestamp() + make_interval(secs => $9))`,
    [row.id, row.daycare_id, row.user_id, row.platform_account_id, principal.email, kind, ciphertext, security.vault.keyId, ttlSeconds]);
  }

  async function lockPrincipal(client, kind, selector) {
    if (kind === 'platform') {
      const result = await client.query(`SELECT id, email, password_hash, status FROM platform_accounts
        WHERE ${selector.id ? 'id = $1' : 'lower(btrim(email)) = $1'} FOR UPDATE`, [selector.id || selector.email]);
      const row = result.rows[0];
      return row && row.status === 'active' ? { ...row, principal_kind: kind } : null;
    }
    const center = (await client.query(`SELECT id, login_code, status FROM daycares
      WHERE ${selector.daycare_id ? 'id = $1' : 'login_code = $1'} FOR SHARE`, [selector.daycare_id || selector.daycare_code])).rows[0];
    if (!center || center.status !== 'active') return null;
    const row = (await client.query(`SELECT id, daycare_id, email, password_hash, status, role_id FROM users
      WHERE daycare_id = $1 AND ${selector.id ? 'id = $2' : 'lower(btrim(email)) = $2'} FOR UPDATE`,
    [center.id, selector.id || selector.email])).rows[0];
    return row && row.status === 'active' && [1, 2, 3].includes(row.role_id)
      ? { ...row, principal_kind: kind, daycare_code: center.login_code } : null;
  }

  async function audit(client, principal, action, method) {
    if (principal.principal_kind === 'daycare') {
      await client.query(`INSERT INTO audit_logs (actor_id, action, target_table, target_id, metadata, daycare_id)
        VALUES ($1, $2, 'users', $1, $3::jsonb, $4)`, [principal.id, `daycare.auth.${action}`, JSON.stringify({ method }), principal.daycare_id]);
    } else {
      await client.query(`INSERT INTO platform_audit_events (actor_kind, platform_account_id, action, target_type, target_id, outcome, metadata)
        VALUES ($1, $2, $3, 'platform_account', $4, 'success', $5::jsonb)`,
      [method === 'current_password' ? 'platform' : 'system', method === 'current_password' ? principal.id : null,
        `platform.auth.${action}`, String(principal.id), JSON.stringify({ method })]);
    }
  }

  async function consumeAndRevoke(client, principal, newPassword, method) {
    const kind = principal.principal_kind;
    const columns = principalColumns(principal);
    const accountColumn = kind === 'daycare' ? 'user_id' : 'platform_account_id';
    const accountTable = kind === 'daycare' ? 'users' : 'platform_accounts';
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await client.query(`UPDATE ${accountTable} SET password_hash = $1, updated_at = clock_timestamp() WHERE id = $2`, [passwordHash, principal.id]);
    await client.query(`UPDATE ${recoveryTable(kind)} SET consumed_at = COALESCE(consumed_at, clock_timestamp()) WHERE ${accountColumn} = $1`, [principal.id]);
    if (kind === 'daycare') await client.query('UPDATE password_reset_tokens SET used = true WHERE user_id = $1', [principal.id]);
    for (const table of ['auth_sessions', 'auth_challenges']) {
      await client.query(`UPDATE ${table} SET revoked_at = COALESCE(revoked_at, clock_timestamp())
        WHERE ${accountColumn} = $1 AND ${kind === 'daycare' ? 'daycare_id = $2 AND platform_account_id IS NULL' : 'daycare_id IS NULL AND user_id IS NULL'}`,
      kind === 'daycare' ? [principal.id, columns.daycare_id] : [principal.id]);
    }
    await queue(client, principal, 'password_changed', {
      to: principal.email, subject: 'Your Ankelba password was changed',
      text: 'Your account password was changed. Sign in again with your new password. If you did not request this, contact your administrator.',
    }, 86400);
    await audit(client, principal, method === 'reset_link' ? 'password_reset' : 'password_changed', method);
  }

  const service = {
    async forgotPassword(kind, input) {
      input = validate(kind, 'forgot', input);
      try {
        // This autocommit budget intentionally precedes the business transaction.
        const permitted = await security.budget(pool, hash(`recovery:${kind}:${input.daycare_code || 'platform'}:${input.email}`), 5, 900);
        if (!permitted) return { message: GENERIC_MESSAGE };
        await transaction(pool, async client => {
          const principal = await lockPrincipal(client, kind, input);
          if (!principal) return;
          const token = randomToken(kind === 'daycare' ? 'dr1' : 'pr1');
          const column = kind === 'daycare' ? 'user_id' : 'platform_account_id';
          await client.query(`UPDATE ${recoveryTable(kind)} SET consumed_at = COALESCE(consumed_at, clock_timestamp()) WHERE ${column} = $1`, [principal.id]);
          if (kind === 'daycare') {
            await client.query(`INSERT INTO daycare_password_reset_tokens (daycare_id, user_id, token_hash, created_at, expires_at)
              VALUES ($1, $2, $3, clock_timestamp(), clock_timestamp() + interval '30 minutes')`, [principal.daycare_id, principal.id, hash(token)]);
          } else {
            await client.query(`INSERT INTO platform_password_reset_tokens (platform_account_id, token_hash, created_at, expires_at)
              VALUES ($1, $2, clock_timestamp(), clock_timestamp() + interval '30 minutes')`, [principal.id, hash(token)]);
          }
          const resetUrl = new URL(kind === 'daycare' ? '/reset-password' : '/platform/reset-password', base);
          const fragment = new URLSearchParams({ token });
          if (kind === 'daycare') fragment.set('daycare_code', principal.daycare_code);
          resetUrl.hash = fragment.toString();
          await queue(client, principal, 'password_reset', {
            to: principal.email, subject: 'Reset your Ankelba password', reset_url: resetUrl.href,
            text: `Use this link to reset your password within 30 minutes: ${resetUrl.href}\nIf you did not request this, ignore this message.`,
          }, 1800);
        });
        return { message: GENERIC_MESSAGE };
      } catch (error) { throw safeError(error); }
    },

    async resetPassword(kind, input) {
      input = validate(kind, 'reset', input);
      try {
        await transaction(pool, async client => {
          // Discover only the lock target, then lock daycare -> account -> token.
          const found = (await client.query(`SELECT * FROM ${recoveryTable(kind)} WHERE token_hash = $1`, [hash(input.token)])).rows[0];
          if (!found) throw failure(400, 'Recovery link is invalid or expired');
          const principal = await lockPrincipal(client, kind, kind === 'daycare'
            ? { daycare_code: input.daycare_code, id: found.user_id } : { id: found.platform_account_id });
          if (!principal || (kind === 'daycare' && found.daycare_id !== principal.daycare_id)) throw failure(400, 'Recovery link is invalid or expired');
          const token = (await client.query(`SELECT id FROM ${recoveryTable(kind)} WHERE id = $1 AND token_hash = $2
            AND consumed_at IS NULL AND expires_at > clock_timestamp() FOR UPDATE`, [found.id, hash(input.token)])).rows[0];
          if (!token) throw failure(400, 'Recovery link is invalid or expired');
          await consumeAndRevoke(client, principal, input.new_password, 'reset_link');
        });
        return { message: 'Password updated. Sign in again.' };
      } catch (error) { throw safeError(error); }
    },

    async changePassword(principal, input) {
      input = validateChange(input);
      if (!principal || !['daycare', 'platform'].includes(principal.principal_kind) || !Number.isSafeInteger(principal.id)
        || (principal.principal_kind === 'daycare' && !Number.isSafeInteger(principal.daycare_id))) throw failure(401, 'Authentication required');
      try {
        if (!await security.budget(pool, `password-change:${principal.principal_kind}:${principal.daycare_id || 'platform'}:${principal.id}`, 5, 900)) {
          throw failure(429, 'Too many authentication attempts; try again later');
        }
        await transaction(pool, async client => {
          const current = await lockPrincipal(client, principal.principal_kind, principal);
          if (!current || !await bcrypt.compare(input.current_password, current.password_hash)) throw failure(401, 'Current password is incorrect');
          await consumeAndRevoke(client, current, input.new_password, 'current_password');
        });
        return { message: 'Password updated. Sign in again.' };
      } catch (error) { throw safeError(error); }
    },
  };

  function router(kind) {
    const result = express.Router();
    const boundary = (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      res.set('Pragma', 'no-cache');
      if (!settings.enabled) return next(failure(503, 'Account recovery is unavailable'));
      if (req.get('Origin') && !settings.allowedOrigins.includes(req.get('Origin'))) return next(failure(403, 'Approved origin required'));
      if (!req.is('application/json')) return next(failure(415, 'Content-Type must be application/json'));
      return next();
    };
    for (const [path, operation, status] of [['/forgot-password', 'forgotPassword', 202], ['/reset-password', 'resetPassword', 200]]) {
      result.post(path, boundary, async (req, res, next) => {
        try { res.status(status).json(await service[operation](kind, req.body)); }
        catch (error) { next(safeError(error)); }
      });
    }
    return result;
  }

  const inbox = {
    async list() {
      try { return (await pool.query(`SELECT id, kind, created_at, expires_at FROM auth_mail_outbox
        WHERE expires_at > clock_timestamp() ORDER BY created_at DESC, id DESC LIMIT 100`)).rows; }
      catch (error) { throw safeError(error); }
    },
    async view(id) {
      if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw failure(422, 'Invalid message ID');
      try {
        const row = (await pool.query('SELECT * FROM auth_mail_outbox WHERE id = $1 AND expires_at > clock_timestamp()', [id])).rows[0];
        if (!row) throw failure(404, 'Message not found');
        return { id: row.id, kind: row.kind, created_at: row.created_at, expires_at: row.expires_at,
          ...JSON.parse(security.vault.decrypt(row.payload_ciphertext, mailAad(row), 'local-mail')) };
      } catch (error) { throw safeError(error); }
    },
  };
  return { daycareRouter: router('daycare'), platformRouter: router('platform'), service, inbox };
}

module.exports = { createAccountRecovery, GENERIC_MESSAGE };
