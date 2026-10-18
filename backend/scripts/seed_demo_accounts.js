'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

async function seed() {
  const hash = await bcrypt.hash('1234', 10);
  console.log('Hash generated for 1234:', hash);

  // Upsert admin@gmail.com (role: admin)
  await db.query(`
    INSERT INTO users (name, email, password_hash, role_id, status, profile_complete)
    VALUES ('System Admin', 'admin@gmail.com', $1, 1, 'active', true)
    ON CONFLICT (email) DO UPDATE 
    SET password_hash = $1, role_id = 1, status = 'active', profile_complete = true;
  `, [hash]);
  console.log('Successfully upserted admin@gmail.com (Admin, pass: 1234)');

  // Upsert demo@gmail.com (role: caregiver)
  await db.query(`
    INSERT INTO users (name, email, password_hash, role_id, status, profile_complete)
    VALUES ('Demo Caregiver', 'demo@gmail.com', $1, 2, 'active', true)
    ON CONFLICT (email) DO UPDATE 
    SET password_hash = $1, role_id = 2, status = 'active', profile_complete = true;
  `, [hash]);
  console.log('Successfully upserted demo@gmail.com (Caregiver, pass: 1234)');

  // Verify by querying both users back
  const { rows } = await db.query(`
    SELECT u.id, u.name, u.email, r.name AS role, u.status
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.email IN ('admin@gmail.com', 'demo@gmail.com')
  `);
  console.log('Verified database rows:', rows);

  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
