'use strict';
require('dotenv').config();
const db = require('./src/config/db');
const bcrypt = require('bcryptjs');

async function main() {
  const hash = await bcrypt.hash('Parent@123!', 10);
  const uRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id, status, profile_complete)
     VALUES ('Sara Tesfaye', 'newparent@ankelba.dev', $1, 3, 'active', false)
     ON CONFLICT (email) DO UPDATE SET profile_complete = false, password_hash = $1
     RETURNING id`,
    [hash]
  );
  const uid = uRes.rows[0].id;

  const gRes = await db.query(
    `SELECT id FROM guardian_links WHERE user_id = $1 AND child_id = 1`,
    [uid]
  );
  if (gRes.rows.length === 0) {
    await db.query(
      `INSERT INTO guardian_links (child_id, user_id, relationship, pickup_authorized, created_by, created_at)
       VALUES (1, $1, 'Mother', true, 22, NOW())`,
      [uid]
    );
  }
  console.log('SUCCESS: newparent@ankelba.dev is ready with id:', uid);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
