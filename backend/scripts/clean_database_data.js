'use strict';
require('dotenv').config();
const db = require('../src/config/db');

async function cleanData() {
  console.log('--- Starting clean database wipe for children and test parents ---');

  // 1. Clear child-related dependent tables
  await db.query('DELETE FROM guardian_verification_events');
  await db.query('DELETE FROM biometric_references');
  await db.query('DELETE FROM attendance');
  await db.query('DELETE FROM daily_reports');
  await db.query('DELETE FROM health_records');
  await db.query('DELETE FROM emergency_contacts');
  await db.query('DELETE FROM care_instructions');
  await db.query('DELETE FROM guardian_links');
  console.log('Cleared all child dependent records.');

  // 2. Clear all children
  const delChildren = await db.query('DELETE FROM children RETURNING id, full_name');
  console.log(`Deleted ${delChildren.rowCount} children.`);

  // Reset children sequence so new children start with ID 1
  await db.query('ALTER SEQUENCE children_id_seq RESTART WITH 1');
  console.log('Reset children ID sequence to 1');

  // 3. Clear payments, order items, orders, messages, alerts, audit_logs
  await db.query('DELETE FROM payments');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM messages');
  await db.query('DELETE FROM alerts');
  await db.query('DELETE FROM audit_logs');
  console.log('Cleared payments, orders, messages, alerts, and audit logs.');

  // 4. Clear non-essential test parents (keep admin and staff accounts)
  const delUsers = await db.query(`
    DELETE FROM users 
    WHERE role_id = 3 AND email NOT IN ('admin@gmail.com', 'demo@gmail.com')
    RETURNING id, name, email
  `);
  console.log(`Deleted ${delUsers.rowCount} parent test accounts.`);

  // 5. Verify admin and caregiver still exist
  const staff = await db.query(`
    SELECT u.id, u.name, u.email, r.name AS role 
    FROM users u 
    JOIN roles r ON r.id = u.role_id 
    WHERE u.email IN ('admin@gmail.com', 'demo@gmail.com')
  `);
  console.log('Active staff accounts verified:');
  console.table(staff.rows);

  const remainingChildren = await db.query('SELECT count(*) FROM children');
  console.log('Remaining children in database:', remainingChildren.rows[0].count);

  const remainingUsers = await db.query('SELECT count(*) FROM users');
  console.log('Remaining users in database:', remainingUsers.rows[0].count);

  console.log('--- Cleanup completed successfully ---');
}

cleanData().then(() => process.exit(0)).catch(err => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
