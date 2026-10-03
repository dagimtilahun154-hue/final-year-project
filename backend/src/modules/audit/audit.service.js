'use strict';
/**
 * src/modules/audit/audit.service.js
 * Business logic for Audit Logging & Security Event Auditing.
 * SRS Refs: FR-AUD-01–05, NFR-SEC-06
 */
const db = require('../../config/db');

/**
 * Record a security or accountability sensitive event.
 */
const logAudit = async (actorId, action, targetTable, targetId = null, metadata = {}, client = null) => {
  const queryFn = client ? client.query.bind(client) : db.query.bind(db);
  try {
    await queryFn(
      `INSERT INTO audit_logs (actor_id, action, target_table, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorId || null, action, targetTable, targetId || null, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error(`[Audit Log Failed] ${action} on ${targetTable}:`, err.message);
  }
};

/**
 * List audit logs for administrator review (FR-AUD-05: Admin only).
 * Uses idx_aud_metadata_gin GIN index for JSONB metadata filtering.
 */
const listAuditLogs = async (query = {}) => {
  const actionFilter = query.action || null;
  const tableFilter = query.target_table || null;
  const actorFilter = query.actor_id ? parseInt(query.actor_id, 10) : null;

  let sql = `
    SELECT a.id, a.actor_id, a.action, a.target_table, a.target_id, a.metadata, a.created_at,
           u.name AS actor_name, u.email AS actor_email
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actor_id
    WHERE 1=1
  `;

  const params = [];
  if (actionFilter) {
    params.push(actionFilter);
    sql += ` AND a.action = $${params.length}`;
  }
  if (tableFilter) {
    params.push(tableFilter);
    sql += ` AND a.target_table = $${params.length}`;
  }
  if (actorFilter) {
    params.push(actorFilter);
    sql += ` AND a.actor_id = $${params.length}`;
  }

  sql += ` ORDER BY a.created_at DESC LIMIT 100`;

  const { rows } = await db.query(sql, params);
  return { data: rows };
};

module.exports = {
  logAudit,
  listAuditLogs,
};
