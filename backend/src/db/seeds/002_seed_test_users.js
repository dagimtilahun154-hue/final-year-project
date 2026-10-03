'use strict';
/**
 * Seed 002 — Test Users
 * Creates one test account per role for development and testing (NFR-TST-02).
 *
 * CREDENTIALS (for dev/test ONLY — NEVER use in production):
 *   admin@ankelba.dev    /  Admin@123!
 *   caregiver@ankelba.dev /  Care@123!
 *   parent@ankelba.dev   /  Parent@123!
 *
 * Passwords are bcrypt-hashed (cost factor 10) — plain text is never stored (NFR-SEC-03).
 */
const bcrypt = require('bcryptjs');

exports.seed = async (knex) => {
  // Remove dependent records first
  await knex('report_activities').del();
  await knex('report_meals').del();
  await knex('daily_reports').del();
  await knex('attendance').del();
  await knex('health_records').del();
  await knex('guardian_links').del();

  // Remove test users (seed is idempotent)
  await knex('users')
    .whereIn('email', ['admin@ankelba.dev', 'caregiver@ankelba.dev', 'parent@ankelba.dev'])
    .del();

  const SALT_ROUNDS = 10;

  const [adminHash, caregiverHash, parentHash] = await Promise.all([
    bcrypt.hash('Admin@123!', SALT_ROUNDS),
    bcrypt.hash('Care@123!', SALT_ROUNDS),
    bcrypt.hash('Parent@123!', SALT_ROUNDS),
  ]);

  await knex('users').insert([
    {
      name:          'System Administrator',
      email:         'admin@ankelba.dev',
      password_hash: adminHash,
      role_id:       1,   // admin
      status:        'active',
    },
    {
      name:          'Test Caregiver',
      email:         'caregiver@ankelba.dev',
      password_hash: caregiverHash,
      role_id:       2,   // caregiver
      status:        'active',
    },
    {
      name:          'Test Parent',
      email:         'parent@ankelba.dev',
      password_hash: parentHash,
      role_id:       3,   // parent
      status:        'active',
    },
  ]);

  console.log('✅ Test users seeded:');
  console.log('   admin@ankelba.dev     /  Admin@123!');
  console.log('   caregiver@ankelba.dev /  Care@123!');
  console.log('   parent@ankelba.dev    /  Parent@123!');
};
