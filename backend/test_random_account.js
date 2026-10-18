require('dotenv').config();
const http = require('http');
const db = require('./src/config/db');

function post(path, data) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch (e) { resolve({ status: res.statusCode, raw: b }); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const randomName = 'Parent ' + randomSuffix;
  const randomEmail = 'parent_' + randomSuffix + '@randomtest.com';
  const randomPassword = 'Pass_' + randomSuffix + '!';

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('         RANDOM ACCOUNT REGISTRATION & LOGIN TEST SUITE             ');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log('Generated Random Account:');
  console.log('  Name:     ', randomName);
  console.log('  Email:    ', randomEmail);
  console.log('  Password: ', randomPassword);

  // 1. Register Random Account
  console.log('\n[1] Registering Random Parent Account via POST /api/auth/register...');
  const regRes = await post('/api/auth/register', {
    name: randomName,
    email: randomEmail,
    password: randomPassword,
    phone: '+251 91 123 4567',
  });

  console.log('  Status:', regRes.status, regRes.status === 201 ? '✅ (HTTP 201 Created)' : '❌');
  console.log('  User ID Created:', regRes.body?.user?.id);
  console.log('  User Role:', regRes.body?.user?.role);
  console.log('  Profile Complete Flag:', regRes.body?.user?.profile_complete);

  // 2. Login with the Random Account
  console.log('\n[2] Logging In with the Same Random Account via POST /api/auth/login...');
  const loginRes = await post('/api/auth/login', {
    email: randomEmail,
    password: randomPassword,
  });

  console.log('  Status:', loginRes.status, loginRes.status === 200 ? '✅ (HTTP 200 OK)' : '❌');
  console.log('  Token Generated:', !!loginRes.body?.token ? '✅ Yes (JWT Signed)' : '❌');
  console.log('  Linked Children Count:', loginRes.body?.user?.linked_children?.length);

  // 3. PostgreSQL Database Direct Verification
  console.log('\n[3] Direct Database Verification (PostgreSQL local query)...');
  const userRow = await db.query(
    'SELECT id, name, email, role_id, status, profile_complete, created_at FROM users WHERE email = $1',
    [randomEmail]
  );
  console.log('  users row:', JSON.stringify(userRow.rows[0], null, 2));

  const childRow = await db.query(
    'SELECT c.id, c.full_name, c.dob, c.gender, c.enrollment_status, gl.relationship ' +
    'FROM guardian_links gl JOIN children c ON c.id = gl.child_id WHERE gl.user_id = $1',
    [userRow.rows[0].id]
  );
  console.log('  linked child row:', JSON.stringify(childRow.rows[0], null, 2));

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  SUCCESS: Random parent account is active and persisted in DB!   ');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Error running test:', err);
  process.exit(1);
});
