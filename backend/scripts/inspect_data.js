'use strict';
require('dotenv').config();
const db = require('../src/config/db');

async function check() {
  const cols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'care_instructions'");
  console.log('care_instructions columns:');
  console.table(cols.rows);

  const care = await db.query("SELECT * FROM care_instructions LIMIT 5");
  console.log('care_instructions rows:');
  console.table(care.rows);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
