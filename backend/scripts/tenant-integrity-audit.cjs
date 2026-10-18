'use strict';
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const db = require('../src/config/db');
const { inspect } = require('../src/db/tenant-integrity');
(async () => {
  const findings = await inspect(sql => db.query(sql));
  const role = (await db.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
  console.log(JSON.stringify({ findings, runtime_role_bypasses_rls: role.rolsuper || role.rolbypassrls }, null, 2));
  if (findings.length) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.end());
