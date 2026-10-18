'use strict';

const PROFILE_FIELDS = `u.id, u.name, u.email, u.role_id, r.name AS role,
  u.status, u.profile_complete, u.daycare_id, d.name AS daycare_name,
  d.status AS daycare_status, d.subscription_plan, d.trial_ends_at`;

function createRepository(pool) {
  return {
    connect: () => pool.connect(),
    async lockDaycare(client, code) {
      const result = await client.query(
        'SELECT id, status FROM daycares WHERE login_code = $1 FOR SHARE', [code]);
      return result.rows[0];
    },
    async lockUser(client, daycareId, email) {
      const result = await client.query(`SELECT ${PROFILE_FIELDS}, u.password_hash
        FROM users u JOIN roles r ON r.id = u.role_id
        JOIN daycares d ON d.id = u.daycare_id
        WHERE u.daycare_id = $1 AND lower(btrim(u.email)) = $2 FOR UPDATE OF u`, [daycareId, email]);
      return result.rows[0];
    },
    async createSession(client, user, tokenHash, ttlSeconds) {
      const result = await client.query(`INSERT INTO auth_sessions
        (daycare_id, user_id, token_hash, created_at, expires_at)
        VALUES ($1, $2, $3, clock_timestamp(), clock_timestamp() + make_interval(secs => $4))
        RETURNING id, expires_at`, [user.daycare_id, user.id, tokenHash, ttlSeconds]);
      return result.rows[0];
    },
    async auditLogin(client, user) {
      await client.query(`INSERT INTO audit_logs (actor_id, action, target_table, target_id, metadata, daycare_id)
        VALUES ($1, 'daycare.auth.login', 'users', $1, '{"method":"password","principal_kind":"daycare"}'::jsonb, $2)`,
      [user.id, user.daycare_id]);
    },
    async findLiveSession(tokenHash) {
      const result = await pool.query(`SELECT ${PROFILE_FIELDS}, s.id AS session_id, s.expires_at,
          s.mfa_factor_id AS session_mfa_factor_id, s.mfa_verified_at
        FROM auth_sessions s JOIN users u ON u.id = s.user_id AND u.daycare_id = s.daycare_id
        JOIN daycares d ON d.id = s.daycare_id JOIN roles r ON r.id = u.role_id
        LEFT JOIN mfa_factors f ON f.id = s.mfa_factor_id AND f.daycare_id = s.daycare_id
          AND f.user_id = s.user_id AND f.platform_account_id IS NULL
        WHERE s.token_hash = $1 AND s.platform_account_id IS NULL
          AND s.daycare_id IS NOT NULL AND s.user_id IS NOT NULL
          AND s.revoked_at IS NULL AND s.expires_at > clock_timestamp()
          AND u.status = 'active' AND d.status = 'active' AND u.role_id IN (1, 2, 3)
          AND (u.role_id <> 1 OR (s.mfa_verified_at IS NOT NULL AND s.mfa_verified_at <= clock_timestamp()
            AND f.confirmed_at IS NOT NULL AND f.revoked_at IS NULL))`, [tokenHash]);
      return result.rows[0];
    },
    async revokeSession(tokenHash) {
      await pool.query(`UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, clock_timestamp())
        WHERE token_hash = $1 AND platform_account_id IS NULL
          AND daycare_id IS NOT NULL AND user_id IS NOT NULL`, [tokenHash]);
    },
  };
}

module.exports = { createRepository };
