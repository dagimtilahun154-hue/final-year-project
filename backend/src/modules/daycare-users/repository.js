'use strict';

// All statements are parameterized; tenant identity is supplied only by the
// authenticated principal. Never use this repository for platform-wide access.
const safeColumns = `u.id, u.name, u.email, r.name AS role, u.status,
  u.daycare_id, u.created_at, u.updated_at`;

function createRepository(pool) {
  async function transaction(work) {
    const client = await pool.connect();
    let rollbackError;
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (failure) { rollbackError = failure; }
      throw error;
    } finally {
      // A failed rollback leaves the connection's transaction state unknown.
      // Passing the failure to pg discards that connection instead of reusing it.
      client.release(rollbackError);
    }
  }

  async function lockDaycare(client, daycareId) {
    const { rows } = await client.query(
      'SELECT id, status FROM daycares WHERE id = $1 FOR SHARE', [daycareId]
    );
    return rows[0];
  }

  async function lockUsers(client, daycareId, ids, write) {
    // Always lock actors and targets together, in ascending ID order. This also
    // covers the case in which the actor and target are the same account.
    const { rows } = await client.query(
      `SELECT ${safeColumns} FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.daycare_id = $1 AND u.id = ANY($2::integer[])
       ORDER BY u.id ${write ? 'FOR UPDATE' : 'FOR SHARE'} OF u`,
      [daycareId, [...new Set(ids)].sort((a, b) => a - b)]
    );
    return rows;
  }

  async function list(client, daycareId, { page, limit, role, status }) {
    const { rows } = await client.query(
      `WITH filtered AS (
         SELECT ${safeColumns} FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.daycare_id = $1 AND r.name IN ('admin', 'caregiver', 'parent')
           AND ($2::text IS NULL OR r.name = $2)
           AND ($3::text IS NULL OR u.status = $3)
       ), paged AS (
         SELECT * FROM filtered ORDER BY created_at DESC, id DESC LIMIT $4 OFFSET $5
       )
       SELECT COALESCE((SELECT json_agg(paged ORDER BY created_at DESC, id DESC) FROM paged), '[]'::json) AS data,
              (SELECT COUNT(*) FROM filtered) AS total`,
      [daycareId, role || null, status || null, limit, (page - 1) * limit]
    );
    return { data: rows[0].data, total: Number(rows[0].total), page, limit };
  }

  async function emailExists(client, daycareId, email, exceptId) {
    const { rows } = await client.query(
      `SELECT 1 FROM users WHERE daycare_id = $1 AND lower(btrim(email)) = $2
       AND ($3::integer IS NULL OR id <> $3) LIMIT 1`, [daycareId, email, exceptId || null]
    );
    return rows.length !== 0;
  }

  async function findProvisionableRole(client, role) {
    const { rows } = await client.query(
      `SELECT id FROM roles WHERE name = $1 AND
       ((id = 2 AND name = 'caregiver') OR (id = 3 AND name = 'parent'))`, [role]
    );
    return rows[0];
  }

  async function insert(client, daycareId, data, hash, roleId) {
    const { rows } = await client.query(
      `INSERT INTO users (name, email, password_hash, role_id, status, daycare_id)
       VALUES ($1, $2, $3, $4, 'active', $5) RETURNING id`,
      [data.name, data.email, hash, roleId, daycareId]
    );
    return get(client, daycareId, rows[0].id);
  }

  async function get(client, daycareId, userId) {
    const { rows } = await client.query(
      `SELECT ${safeColumns} FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.daycare_id = $1 AND u.id = $2`, [daycareId, userId]
    );
    return rows[0];
  }

  async function update(client, daycareId, userId, data) {
    await client.query(
      `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), updated_at = now()
       WHERE daycare_id = $3 AND id = $4`, [data.name ?? null, data.email ?? null, daycareId, userId]
    );
    return get(client, daycareId, userId);
  }

  async function updateStatus(client, daycareId, userId, status) {
    await client.query(
      `UPDATE users SET status = $1, updated_at = now() WHERE daycare_id = $2 AND id = $3`,
      [status, daycareId, userId]
    );
    return get(client, daycareId, userId);
  }

  async function revokeSessions(client, daycareId, userId) {
    await client.query(
      `UPDATE auth_sessions SET revoked_at = now()
       WHERE daycare_id = $1 AND user_id = $2 AND platform_account_id IS NULL AND revoked_at IS NULL`,
      [daycareId, userId]
    );
    await client.query(
      `UPDATE auth_challenges SET revoked_at = COALESCE(revoked_at, clock_timestamp())
       WHERE daycare_id = $1 AND user_id = $2 AND platform_account_id IS NULL
         AND revoked_at IS NULL AND consumed_at IS NULL`, [daycareId, userId]
    );
  }

  async function invalidateRecovery(client, daycareId, userId) {
    await client.query(
      `UPDATE daycare_password_reset_tokens SET consumed_at = clock_timestamp()
       WHERE daycare_id = $1 AND user_id = $2 AND consumed_at IS NULL`, [daycareId, userId]
    );
    await client.query(
      `UPDATE password_reset_tokens p SET used = true FROM users u
       WHERE p.user_id = u.id AND u.daycare_id = $1 AND u.id = $2 AND p.used = false`,
      [daycareId, userId]
    );
  }

  async function audit(client, actor, action, targetId, metadata) {
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, target_table, target_id, metadata, daycare_id)
       VALUES ($1, $2, 'users', $3, $4::jsonb, $5)`,
      [actor.id, action, targetId, JSON.stringify(metadata), actor.daycare_id]
    );
  }

  return { transaction, lockDaycare, lockUsers, list, emailExists, findProvisionableRole,
    insert, get, update, updateStatus, revokeSessions, invalidateRecovery, audit };
}

module.exports = { createRepository };
