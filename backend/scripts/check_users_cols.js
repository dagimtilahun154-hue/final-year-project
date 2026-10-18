'use strict';
require('dotenv').config();
const db = require('../src/config/db');
db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'").then(r => {
  console.log(r.rows.map(x => x.column_name));
  process.exit(0);
});
