'use strict';
require('dotenv').config();
const db = require('../src/config/db');

async function check() {
  const { rows } = await db.query(`
    SELECT c.id, c.full_name, c.dob, c.gender, c.enrollment_status, c.created_at,
           u.id AS parent_id, u.name AS parent_name, u.email AS parent_email
    FROM children c
    LEFT JOIN guardian_links gl ON gl.child_id = c.id
    LEFT JOIN users u ON u.id = gl.user_id
    ORDER BY c.id ASC
  `);
  console.log('Total children rows:', rows.length);
  console.table(rows);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
