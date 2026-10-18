'use strict';
const db = require('../config/db');

async function writeAudit(client, actor, action, table, id, metadata = {}, explicitDaycareId = null) {
  const actorId = typeof actor === 'object' && actor !== null ? actor.id : actor;
  const daycareId = explicitDaycareId !== null
    ? explicitDaycareId
    : (typeof actor === 'object' && actor !== null ? (actor.daycare_id || null) : null);
  if (!actorId) return;
  await client.query(
    'INSERT INTO audit_logs(actor_id,action,target_table,target_id,metadata,daycare_id) VALUES($1,$2,$3,$4,$5,$6)',
    [actorId, action, table, id, JSON.stringify(metadata), daycareId]
  );
}

async function auditedWrite(actor, action, table, work, metadata = {}, explicitDaycareId = null) {
  const actorId = typeof actor === 'object' && actor !== null ? actor.id : actor;
  const daycareId = explicitDaycareId !== null
    ? explicitDaycareId
    : (typeof actor === 'object' && actor !== null ? (actor.daycare_id || null) : null);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const record = await work(client);
    await writeAudit(client, actorId, action, table, record.id, metadata, daycareId);
    await client.query('COMMIT');
    return record;
  } catch(error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { auditedWrite, writeAudit };
