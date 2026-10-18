'use strict';

const { randomBytes, randomUUID } = require('node:crypto');
const { createSecurity, transaction, failure, safeError, hash, randomToken } = require('../auth-security');
const { createTotp, verifiedStep, factorAad } = require('./otp');

const CHALLENGE_PATTERN = /^mc1\.[A-Za-z0-9_-]{43}$/;
const RECOVERY_PATTERN = /^[a-f0-9]{32}$/;
const INVALID_MESSAGE = 'Authentication verification failed';
const CHALLENGE_TTL_SECONDS = 5 * 60;
const FAILURE_LIMIT = 5;
const FAILURE_WINDOW_SECONDS = 15 * 60;

function principalFields(principal) {
  if (principal.kind === 'daycare') return [principal.daycare_id, principal.id, null];
  return [null, null, principal.id];
}

function principalScope(principal, offset = 1) {
  return principal.kind === 'daycare'
    ? { sql: `daycare_id = $${offset} AND user_id = $${offset + 1} AND platform_account_id IS NULL`, values: [principal.daycare_id, principal.id] }
    : { sql: `platform_account_id = $${offset} AND daycare_id IS NULL AND user_id IS NULL`, values: [principal.id] };
}

function failureKey(principal) {
  return `mfa-failure:${principal.kind}:${principal.kind === 'daycare' ? principal.daycare_id : 'platform'}:${principal.id}`;
}

function challengePrincipal(challenge) {
  if (challenge.platform_account_id !== null && challenge.daycare_id === null && challenge.user_id === null) {
    return { kind: 'platform', id: challenge.platform_account_id };
  }
  if (challenge.daycare_id !== null && challenge.user_id !== null && challenge.platform_account_id === null) {
    return { kind: 'daycare', id: challenge.user_id, daycare_id: challenge.daycare_id };
  }
  return null;
}

function createMfaAuth({ pool, config = {}, security, clock = Date.now }) {
  if (!pool || typeof pool.connect !== 'function' || typeof pool.query !== 'function') {
    throw new TypeError('A PostgreSQL pool is required');
  }
  if (!Number.isSafeInteger(config.sessionTtlSeconds) || config.sessionTtlSeconds <= 0 || typeof clock !== 'function') {
    throw new TypeError('Invalid MFA configuration');
  }
  security = security || createSecurity({ pool, config });

  function now() {
    const value = new Date(clock());
    if (!Number.isFinite(value.getTime())) throw new TypeError('Invalid authentication clock');
    return value;
  }

  async function audit(client, principal, action, outcome, metadata = {}) {
    if (principal.kind === 'daycare') {
      await client.query(`INSERT INTO audit_logs (actor_id, action, target_table, target_id, metadata, daycare_id)
        VALUES ($1, $2, 'users', $1, $3::jsonb, $4)`,
      [principal.id, action, JSON.stringify({ principal_kind: 'daycare', ...metadata }), principal.daycare_id]);
    } else {
      await client.query(`INSERT INTO platform_audit_events
        (actor_kind, platform_account_id, action, target_type, target_id, outcome, metadata)
        VALUES ('platform', $1, $2, 'platform_accounts', $3, $4, $5::jsonb)`,
      [principal.id, action, String(principal.id), outcome, JSON.stringify({ principal_kind: 'platform', ...metadata })]);
    }
  }

  async function factorsForUpdate(client, principal) {
    const scope = principalScope(principal);
    const result = await client.query(`SELECT * FROM mfa_factors WHERE ${scope.sql}
      AND revoked_at IS NULL ORDER BY id FOR UPDATE`, scope.values);
    return result.rows;
  }

  async function revokeOutstanding(client, principal, timestamp) {
    const scope = principalScope(principal, 2);
    await client.query(`UPDATE auth_challenges SET revoked_at = $1
      WHERE ${scope.sql} AND consumed_at IS NULL AND revoked_at IS NULL`, [timestamp, ...scope.values]);
    await client.query(`UPDATE mfa_factors SET revoked_at = $1
      WHERE ${scope.sql} AND confirmed_at IS NULL AND revoked_at IS NULL`, [timestamp, ...scope.values]);
  }

  async function insertChallenge(client, principal, purpose, factorId, timestamp) {
    const token = randomToken('mc1');
    const expiry = new Date(timestamp.getTime() + CHALLENGE_TTL_SECONDS * 1000);
    await client.query(`INSERT INTO auth_challenges
      (daycare_id, user_id, platform_account_id, mfa_factor_id, purpose, token_hash, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [...principalFields(principal), factorId, purpose, hash(token), timestamp, expiry]);
    return { mfa_required: true, enrollment_required: purpose === 'mfa_enrollment', purpose,
      challenge_token: token, expires_at: expiry };
  }

  async function lockPrincipal(client, discovered, purpose) {
    if (discovered.kind === 'daycare') {
      const daycare = (await client.query('SELECT id, status FROM daycares WHERE id = $1 FOR SHARE', [discovered.daycare_id])).rows[0];
      if (!daycare || daycare.status !== 'active') return null;
      const row = (await client.query(`SELECT u.id, u.name, u.email, u.role_id, u.status, u.daycare_id,
        u.profile_complete, r.name AS role, d.name AS daycare_name, d.status AS daycare_status,
        d.subscription_plan, d.trial_ends_at FROM users u JOIN roles r ON r.id = u.role_id
        JOIN daycares d ON d.id = u.daycare_id WHERE u.id = $1 AND u.daycare_id = $2 FOR UPDATE OF u`,
      [discovered.id, discovered.daycare_id])).rows[0];
      if (!row || row.status !== 'active' || row.role_id !== 1 || row.role !== 'admin') return null;
      return { ...row, kind: 'daycare', principal_kind: 'daycare', user_id: row.id };
    }
    const row = (await client.query(`SELECT id, name, email, status, email_verified_at
      FROM platform_accounts WHERE id = $1 FOR UPDATE`, [discovered.id])).rows[0];
    if (!row || !(row.status === 'active' || (row.status === 'pending_activation' && purpose === 'mfa_enrollment'))) return null;
    return { ...row, kind: 'platform', principal_kind: 'platform', platform_account_id: row.id };
  }

  async function discover(input, expectedKind) {
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || typeof input.challenge_token !== 'string' || !CHALLENGE_PATTERN.test(input.challenge_token)
      || !['daycare', 'platform'].includes(expectedKind)) throw failure(401, INVALID_MESSAGE);
    const result = await pool.query('SELECT * FROM auth_challenges WHERE token_hash = $1', [hash(input.challenge_token)]);
    const challenge = result.rows[0];
    const principal = challenge && challengePrincipal(challenge);
    // The two authentication endpoints never accept each other's challenges.
    if (!principal || principal.kind !== expectedKind) throw failure(401, INVALID_MESSAGE);
    return { challenge, principal };
  }

  async function lockedChallenge(client, discovered) {
    const principal = await lockPrincipal(client, discovered.principal, discovered.challenge.purpose);
    if (!principal) return null;
    // Principal locks serialize all password/MFA mutations. Every flow then
    // obtains factor locks before challenge locks, including initial setup.
    const factors = await factorsForUpdate(client, principal);
    const result = await client.query('SELECT * FROM auth_challenges WHERE id = $1 FOR UPDATE', [discovered.challenge.id]);
    // Lock waits may outlive a challenge or an OTP step. Read the clock only
    // after acquiring the locks used to validate and consume this proof.
    const timestamp = now();
    const challenge = result.rows[0];
    const actual = challenge && challengePrincipal(challenge);
    if (!challenge || !actual || actual.kind !== principal.kind || actual.id !== principal.id
      || (actual.kind === 'daycare' && actual.daycare_id !== principal.daycare_id)
      || challenge.token_hash !== discovered.challenge.token_hash || challenge.revoked_at || challenge.consumed_at
      || new Date(challenge.expires_at).getTime() <= timestamp.getTime() || challenge.attempts >= challenge.max_attempts
      || !['login_mfa', 'mfa_enrollment'].includes(challenge.purpose)) return null;
    return { principal, factors, challenge };
  }

  async function checkBudget(client, principal) {
    return security.budgetState(client, failureKey(principal), FAILURE_LIMIT, FAILURE_WINDOW_SECONDS);
  }

  async function failedProof(client, state, timestamp, method) {
    const { principal, challenge } = state;
    await client.query(`UPDATE auth_challenges SET attempts = attempts + 1,
      revoked_at = CASE WHEN attempts + 1 >= max_attempts THEN $2 ELSE revoked_at END WHERE id = $1`,
    [challenge.id, timestamp]);
    await security.budget(client, failureKey(principal), FAILURE_LIMIT, FAILURE_WINDOW_SECONDS);
    await audit(client, principal, 'auth.mfa.proof_failed', 'denied', { purpose: challenge.purpose, method });
    // Returning the error commits the failed attempt and shared principal
    // budget. Throwing here would roll both protections back.
    return { error: failure(401, INVALID_MESSAGE) };
  }

  async function run(work) {
    try {
      const result = await transaction(pool, work);
      if (result && result.error) throw result.error;
      return result;
    } catch (error) { throw safeError(error); }
  }

  return {
    // Caller has verified the password and holds daycare -> user, or platform
    // account locks in its own transaction. No full session is minted here.
    async begin(client, principal) {
      try {
        if (!principal || !['daycare', 'platform'].includes(principal.kind)
          || !Number.isSafeInteger(principal.id) || principal.id <= 0
          || (principal.kind === 'daycare' && (!Number.isSafeInteger(principal.daycare_id)
            || principal.daycare_id <= 0 || principal.role !== 'admin'))) throw failure(401, INVALID_MESSAGE);
        const factors = await factorsForUpdate(client, principal);
        const timestamp = now();
        const confirmed = factors.find(factor => factor.confirmed_at);
        await revokeOutstanding(client, principal, timestamp);
        const result = await insertChallenge(client, principal,
          confirmed ? 'login_mfa' : 'mfa_enrollment', confirmed ? confirmed.id : null, timestamp);
        await audit(client, principal, 'auth.mfa.challenge_started', 'success', { purpose: result.purpose });
        return result;
      } catch (error) { throw safeError(error); }
    },

    async setup(input, expectedKind = 'daycare') {
      let discovered;
      try { discovered = await discover(input, expectedKind); } catch (error) { throw safeError(error); }
      return run(async client => {
        const state = await lockedChallenge(client, discovered);
        if (!state) return { error: failure(401, INVALID_MESSAGE) };
        const { principal, factors, challenge } = state;
        if (challenge.purpose !== 'mfa_enrollment' || challenge.mfa_factor_id !== null
          || factors.some(factor => factor.confirmed_at)) return { error: failure(401, INVALID_MESSAGE) };
        if (!await checkBudget(client, principal)) return { error: failure(429, 'Too many authentication attempts; try again later') };
        const timestamp = now();
        if (new Date(challenge.expires_at).getTime() <= timestamp.getTime()) return { error: failure(401, INVALID_MESSAGE) };
        await client.query('UPDATE auth_challenges SET consumed_at = $2 WHERE id = $1', [challenge.id, timestamp]);
        const scope = principalScope(principal, 2);
        await client.query(`UPDATE mfa_factors SET revoked_at = $1
          WHERE ${scope.sql} AND confirmed_at IS NULL AND revoked_at IS NULL`, [timestamp, ...scope.values]);
        const factorId = randomUUID();
        const totp = createTotp(undefined, `${principal.kind === 'daycare' ? `Daycare ${principal.daycare_id}` : 'Platform'}: ${principal.email}`);
        const secret = totp.secret.base32;
        const ciphertext = security.vault.encrypt(secret, factorAad(principal, factorId), 'mfa-factor');
        await client.query(`INSERT INTO mfa_factors
          (id, daycare_id, user_id, platform_account_id, secret_ciphertext, encryption_key_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [factorId, ...principalFields(principal), ciphertext, security.vault.keyId, timestamp]);
        const next = await insertChallenge(client, principal, 'mfa_enrollment', factorId, timestamp);
        await audit(client, principal, 'auth.mfa.enrollment_started', 'success');
        return { ...next, secret, otpauth_uri: totp.toString() };
      });
    },

    async complete(input, expectedKind = 'daycare') {
      let discovered;
      try { discovered = await discover(input, expectedKind); } catch (error) { throw safeError(error); }
      return run(async client => {
        const state = await lockedChallenge(client, discovered);
        if (!state) return { error: failure(401, INVALID_MESSAGE) };
        const { principal, factors, challenge } = state;
        const factor = factors.find(item => item.id === challenge.mfa_factor_id);
        if (!factor || (challenge.purpose === 'login_mfa' && !factor.confirmed_at)
          || (challenge.purpose === 'mfa_enrollment' && (factor.confirmed_at || factors.some(item => item.confirmed_at)))) {
          return { error: failure(401, INVALID_MESSAGE) };
        }
        if (!await checkBudget(client, principal)) return { error: failure(429, 'Too many authentication attempts; try again later') };
        const timestamp = now();
        if (new Date(challenge.expires_at).getTime() <= timestamp.getTime()) return { error: failure(401, INVALID_MESSAGE) };
        const hasTotp = input.totp_code !== undefined;
        const hasRecovery = input.recovery_code !== undefined;
        let step = null;
        let recoveryRow = null;
        const method = hasRecovery && !hasTotp ? 'recovery' : 'totp';
        if (hasTotp && !hasRecovery && typeof input.totp_code === 'string' && /^\d{6}$/.test(input.totp_code)) {
          const secret = security.vault.decrypt(factor.secret_ciphertext, factorAad(principal, factor.id), 'mfa-factor');
          step = verifiedStep(secret, input.totp_code, timestamp.getTime(), factor.last_used_step);
        } else if (hasRecovery && !hasTotp && challenge.purpose === 'login_mfa'
          && typeof input.recovery_code === 'string' && RECOVERY_PATTERN.test(input.recovery_code)) {
          recoveryRow = (await client.query(`SELECT id FROM mfa_recovery_codes
            WHERE factor_id = $1 AND code_hash = $2 AND consumed_at IS NULL FOR UPDATE`,
          [factor.id, hash(input.recovery_code)])).rows[0];
        }
        if (step === null && !recoveryRow) return failedProof(client, state, timestamp, method);
        let recoveryCodes;
        if (challenge.purpose === 'mfa_enrollment') {
          await client.query(`UPDATE mfa_factors SET confirmed_at = $2, last_used_step = $3 WHERE id = $1`,
          [factor.id, timestamp, step]);
          recoveryCodes = Array.from({ length: 10 }, () => randomBytes(16).toString('hex'));
          for (const code of recoveryCodes) {
            await client.query('INSERT INTO mfa_recovery_codes (factor_id, code_hash, created_at) VALUES ($1, $2, $3)',
              [factor.id, hash(code), timestamp]);
          }
          if (principal.kind === 'platform' && principal.status === 'pending_activation') {
            await client.query("UPDATE platform_accounts SET status = 'active', updated_at = $2 WHERE id = $1", [principal.id, timestamp]);
            principal.status = 'active';
          }
        } else if (recoveryRow) {
          await client.query('UPDATE mfa_recovery_codes SET consumed_at = $2 WHERE id = $1', [recoveryRow.id, timestamp]);
        } else {
          await client.query('UPDATE mfa_factors SET last_used_step = $2 WHERE id = $1', [factor.id, step]);
        }
        await client.query('UPDATE auth_challenges SET consumed_at = $2 WHERE id = $1', [challenge.id, timestamp]);
        const token = randomToken(principal.kind === 'daycare' ? 'dc1' : 'pf1');
        const expiry = new Date(timestamp.getTime() + config.sessionTtlSeconds * 1000);
        await client.query(`INSERT INTO auth_sessions
          (daycare_id, user_id, platform_account_id, token_hash, mfa_factor_id, mfa_verified_at, created_at, expires_at)
          VALUES ($1, $2, $3, $4, $5, $6, $6, $7)`,
        [...principalFields(principal), hash(token), factor.id, timestamp, expiry]);
        await audit(client, principal, challenge.purpose === 'mfa_enrollment' ? 'auth.mfa.enrolled' : 'auth.mfa.login',
          'success', { method, purpose: challenge.purpose });
        return { principal, token, expires_at: expiry, ...(recoveryCodes ? { recovery_codes: recoveryCodes } : {}) };
      });
    },
  };
}

module.exports = { createMfaAuth, CHALLENGE_PATTERN };
