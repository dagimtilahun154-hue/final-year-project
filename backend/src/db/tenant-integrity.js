'use strict';

// Shared by migration and read-only preflight. Identifiers are code-owned constants.
const tables = ['children', 'groups', 'front_desk_assignments', 'attendance', 'daily_reports',
  'health_records', 'announcements', 'messages', 'alerts', 'events', 'products', 'orders'];
const edges = [
  ['children','group_id','groups'], ['children','caregiver_id','users'],
  ['front_desk_assignments','staff_id','users'], ['front_desk_assignments','group_id','groups'],
  ['front_desk_assignments','assigned_by','users'],
  ['attendance','child_id','children'], ['attendance','recorded_by','users'],
  ['daily_reports','child_id','children'], ['daily_reports','caregiver_id','users'],
  ['health_records','child_id','children'], ['health_records','recorded_by','users'],
  ['announcements','author_id','users'], ['announcements','target_group_id','groups'],
  ['messages','sender_id','users'], ['messages','recipient_id','users'],
  ['alerts','author_id','users'], ['alerts','target_user_id','users'],
  ['events','created_by','users'], ['products','created_by','users'], ['orders','parent_id','users'],
];
async function inspect(query) {
  const findings = [];
  for (const table of tables) {
    const result = await query(`SELECT count(*)::int AS count FROM ${table} WHERE daycare_id IS NULL`);
    if (result.rows[0].count) findings.push({ table, problem: 'missing_daycare', count: result.rows[0].count });
  }
  const users = await query('SELECT count(*)::int AS count FROM users WHERE role_id <> 0 AND daycare_id IS NULL');
  if (users.rows[0].count) findings.push({ table: 'users', problem: 'missing_daycare', count: users.rows[0].count });
  for (const [table, column, parent] of edges) {
    const result = await query(`SELECT count(*)::int AS count FROM ${table} a LEFT JOIN ${parent} b ON b.id=a.${column}
      WHERE a.${column} IS NOT NULL AND (b.id IS NULL OR a.daycare_id IS DISTINCT FROM b.daycare_id)`);
    if (result.rows[0].count) findings.push({ table, column, problem: 'tenant_relationship', count: result.rows[0].count });
  }
  for (const [table, firstColumn, firstTable, secondColumn, secondTable] of [
    ['guardian_links','child_id','children','user_id','users'],
    ['order_items','order_id','orders','product_id','products'],
  ]) {
    const result = await query(`SELECT count(*)::int AS count FROM ${table} x
      JOIN ${firstTable} a ON a.id=x.${firstColumn} JOIN ${secondTable} b ON b.id=x.${secondColumn}
      WHERE a.daycare_id IS NULL OR a.daycare_id IS DISTINCT FROM b.daycare_id`);
    if (result.rows[0].count) findings.push({ table, problem: 'tenant_relationship', count: result.rows[0].count });
  }
  return findings;
}
module.exports = { tables, edges, inspect };
