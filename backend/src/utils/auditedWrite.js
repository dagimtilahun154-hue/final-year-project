'use strict';
const db = require('../config/db');
async function writeAudit(client, actorId, action, table, id, metadata = {}) {
  if (!actorId) return;
  await client.query('INSERT INTO audit_logs(actor_id,action,target_table,target_id,metadata) VALUES($1,$2,$3,$4,$5)', [actorId, action, table, id, JSON.stringify(metadata)]);
}
async function auditedWrite(actorId, action, table, work, metadata = {}) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const record = await work(client);
    await writeAudit(client, actorId, action, table, record.id, metadata);
    await client.query('COMMIT');
    return record;
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
module.exports = { auditedWrite, writeAudit };
