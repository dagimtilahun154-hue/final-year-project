'use strict';

const bcrypt = require('bcryptjs');
const { failure, unavailable } = require('../daycare-auth/errors');
const { TOKEN_PATTERN, hashToken } = require('./tokens');
const { validateLoginInput, validateBootstrapInput } = require('./validator');

const DUMMY_HASH = '$2b$12$KIXxMcQI53RYZGPDAycx9uOQS7CzNlmJ5KCgp.XA7Y3lmpjNNfJHu';
const BOOTSTRAP_LOCK = 'ankelba.platform.owner.bootstrap.v1';
const profile = row => ({ id: row.id, name: row.name, email: row.email, role: 'platform_owner', principal_kind: 'platform' });

function createService({ pool, config, mfa, security }) {
  async function transaction(work) {
    let client;
    let active = false;
    let discard;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      active = true;
      const result = await work(client);
      await client.query('COMMIT');
      active = false;
      return result;
    } catch (error) {
      if (client && active) {
        try { await client.query('ROLLBACK'); } catch (rollbackError) { discard = rollbackError; }
      }
      throw unavailable(error);
    } finally { if (client) client.release(discard); }
  }

  return {
    async login(input) {
      input = validateLoginInput(input);
      // Persist this budget before opening the credential transaction. Failed
      // password checks cannot roll it back; changing email case cannot reset it.
      try {
        if (!await security.budget(pool, `platform.login:${input.email}`, 20, 900)) {
          throw failure(429, 'Too many authentication attempts; try again later');
        }
      } catch (error) { throw unavailable(error); }
      return transaction(async client => {
        const result = await client.query(`SELECT id, name, email, password_hash, status
          FROM platform_accounts WHERE lower(btrim(email)) = $1 FOR UPDATE`, [input.email]);
        const owner = result.rows[0];
        let matches = false;
        try { matches = await bcrypt.compare(input.password, owner && owner.password_hash ? owner.password_hash : DUMMY_HASH); }
        catch (_) { await bcrypt.compare(input.password, DUMMY_HASH); }
        if (!matches || !owner || !['active', 'pending_activation'].includes(owner.status)) {
          throw failure(401, 'Email or password is incorrect');
        }
        // A password proves only the first factor, including first-owner setup.
        // The shared MFA service creates the session after a verified second factor.
        return mfa.begin(client, { kind: 'platform', principal_kind: 'platform', id: owner.id,
          platform_account_id: owner.id, email: owner.email, name: owner.name, status: owner.status });
      });
    },
    async setup(input) {
      try { return await mfa.setup(input, 'platform'); }
      catch (error) { throw unavailable(error); }
    },
    async verify(input) {
      try {
        const result = await mfa.complete(input, 'platform');
        if (!result.principal || result.principal.kind !== 'platform' || !TOKEN_PATTERN.test(result.token)) {
          throw failure(503, 'Authentication service temporarily unavailable');
        }
        return { user: profile(result.principal), token: result.token, expires_at: result.expires_at,
          ...(result.recovery_codes ? { recovery_codes: result.recovery_codes } : {}) };
      } catch (error) { throw unavailable(error); }
    },
    async authenticate(token) {
      if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) throw failure(401, 'Authentication required');
      try {
        const result = await pool.query(`SELECT a.id, a.name, a.email, s.id AS session_id, s.expires_at
          FROM auth_sessions s JOIN platform_accounts a ON a.id = s.platform_account_id
          JOIN mfa_factors f ON f.id = s.mfa_factor_id AND f.platform_account_id = a.id
          WHERE s.token_hash = $1 AND s.daycare_id IS NULL AND s.user_id IS NULL
            AND s.platform_account_id IS NOT NULL AND a.status = 'active'
            AND s.revoked_at IS NULL AND s.expires_at > clock_timestamp()
            AND s.mfa_verified_at IS NOT NULL AND s.mfa_verified_at <= clock_timestamp()
            AND f.kind = 'totp' AND f.confirmed_at IS NOT NULL AND f.revoked_at IS NULL
            AND f.daycare_id IS NULL AND f.user_id IS NULL`, [hashToken(token)]);
        const row = result.rows[0];
        if (!row) throw failure(401, 'Authentication required');
        return { user: profile(row), session: { id: row.session_id, expires_at: row.expires_at } };
      } catch (error) { throw unavailable(error); }
    },
    async logout(token) {
      if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) throw failure(401, 'Authentication required');
      try {
        await pool.query(`UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, clock_timestamp())
          WHERE token_hash = $1 AND platform_account_id IS NOT NULL AND daycare_id IS NULL AND user_id IS NULL`, [hashToken(token)]);
      } catch (error) { throw unavailable(error); }
    },
    async bootstrapOwner(input) {
      input = validateBootstrapInput(input);
      // Hash before acquiring the one-owner lock; never print/store the password.
      const passwordHash = await bcrypt.hash(input.password, 12);
      return transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [BOOTSTRAP_LOCK]);
        const existing = await client.query('SELECT 1 FROM platform_accounts LIMIT 1');
        if (existing.rows.length) throw failure(409, 'A platform account already exists; bootstrap is unavailable');
        const inserted = await client.query(`INSERT INTO platform_accounts (name, email, password_hash, status)
          VALUES ($1, $2, $3, 'pending_activation') RETURNING id, name, email, status`,
        [input.name, input.email, passwordHash]);
        const owner = inserted.rows[0];
        await client.query(`INSERT INTO platform_audit_events
          (actor_kind, action, target_type, target_id, outcome, metadata)
          VALUES ('system', 'platform.owner.bootstrap', 'platform_accounts', $1, 'success',
            '{"requires_mfa_enrollment":true}'::jsonb)`, [String(owner.id)]);
        return { ...profile(owner), status: owner.status };
      });
    },
  };
}

module.exports = { createService };
