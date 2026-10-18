'use strict';
const { Pool } = require('pg');

const db = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'ankelba_dev',
  user: 'postgres',
  password: 'mistre',
});

async function migrate() {
  await db.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT false`
  );
  console.log('[1/3] Column profile_complete ensured on users table.');

  const r1 = await db.query(
    `UPDATE users SET profile_complete = true WHERE email = $1`,
    ['parent@ankelba.dev']
  );
  console.log(`[2/3] Demo parent marked complete: ${r1.rowCount} row(s).`);

  const result = await db.query(`SELECT id, email, role_id, profile_complete FROM users ORDER BY id`);
  console.log('[3/3] Current users:');
  result.rows.forEach(u => console.log(`  id=${u.id} email=${u.email} role_id=${u.role_id} profile_complete=${u.profile_complete}`));

  await db.end();
  console.log('\nMigration complete.');
}

migrate().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
