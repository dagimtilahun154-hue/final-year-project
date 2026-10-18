'use strict';

const bcrypt = require('bcryptjs');
const { failure, unavailable } = require('./errors');
const { newToken, hashToken, TOKEN_PATTERN } = require('./tokens');
const { validateLoginInput } = require('./validator');

// A valid, fixed work-factor hash keeps an unknown account on the password
// comparison path too. It is never an actual credential.
const DUMMY_HASH = '$2b$12$KIXxMcQI53RYZGPDAycx9uOQS7CzNlmJ5KCgp.XA7Y3lmpjNNfJHu';
const DAYCARE_ROLES = { 1: 'admin', 2: 'caregiver', 3: 'parent' };

function profile(row) {
  return {
    id: row.id, name: row.name, email: row.email, role: row.role,
    daycare_id: row.daycare_id, daycare_name: row.daycare_name,
    daycare_status: row.daycare_status, subscription_plan: row.subscription_plan,
    trial_ends_at: row.trial_ends_at, profile_complete: row.profile_complete,
    principal_kind: 'daycare',
  };
}

function validPrincipal(row) {
  return row && row.daycare_id !== null && row.status === 'active'
    && row.daycare_status === 'active' && DAYCARE_ROLES[row.role_id] === row.role;
}

function createService(repository, config, mfa, security, pool) {
  return {
    async login(input) {
      input = validateLoginInput(input);
      try {
        if (!await security.budget(pool, `daycare.login:${input.daycare_code}:${input.email}`, 20, 900)) {
          throw failure(429, 'Too many authentication attempts; try again later');
        }
      } catch (error) { throw unavailable(error); }
      let client;
      let inTransaction = false;
      let discardConnection;
      try {
        client = await repository.connect();
        await client.query('BEGIN');
        inTransaction = true;
        // All account administration uses the same daycare -> user lock order.
        // A suspension or credential change either precedes this check or waits
        // until the session and its audit event have committed together.
        const daycare = await repository.lockDaycare(client, input.daycare_code);
        const user = daycare ? await repository.lockUser(client, daycare.id, input.email) : null;
        let passwordMatches = false;
        try {
          passwordMatches = await bcrypt.compare(input.password, user ? user.password_hash : DUMMY_HASH);
        } catch (_) {
          // An unusable legacy hash is an unavailable account, not a different
          // public error that reveals an email exists.
          await bcrypt.compare(input.password, DUMMY_HASH);
        }
        if (!passwordMatches || !validPrincipal(user) || daycare.status !== 'active') {
          throw failure(401, 'Daycare code, email or password is incorrect');
        }
        if (user.role_id === 1) {
          const challenge = await mfa.begin(client, { ...user, kind: 'daycare', user_id: user.id });
          await client.query('COMMIT');
          inTransaction = false;
          return challenge;
        }
        const token = newToken();
        const session = await repository.createSession(client, user, hashToken(token), config.sessionTtlSeconds);
        await repository.auditLogin(client, user);
        await client.query('COMMIT');
        inTransaction = false;
        return { user: profile(user), token, expires_at: session.expires_at };
      } catch (error) {
        if (client && inTransaction) {
          try { await client.query('ROLLBACK'); }
          catch (rollbackError) { discardConnection = rollbackError; }
        }
        throw unavailable(error);
      } finally {
        if (client) client.release(discardConnection);
      }
    },
    async authenticate(token) {
      if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) throw failure(401, 'Authentication required');
      try {
        const row = await repository.findLiveSession(hashToken(token));
        if (!validPrincipal(row)) throw failure(401, 'Authentication required');
        return { user: profile(row), session: { id: row.session_id, expires_at: row.expires_at,
          mfa_factor_id: row.session_mfa_factor_id, mfa_verified_at: row.mfa_verified_at } };
      } catch (error) { throw unavailable(error); }
    },
    async logout(token) {
      if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) throw failure(401, 'Authentication required');
      try { await repository.revokeSession(hashToken(token)); }
      catch (error) { throw unavailable(error); }
    },
  };
}

module.exports = { createService, profile };
