/**
 * Ankelba Backend Audit Script
 * Tests all live endpoints: health, auth, users, RBAC, stubs, DB schema
 * Run: node audit.js
 */

const http = require('http');

const BASE = 'http://localhost:5000';
const results = [];
let adminCookie = '';
let caregiverCookie = '';
let parentCookie = '';

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function request(method, path, body, cookie) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost', port: 5000,
      path, method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(data); } catch (_) {}
        // Capture Set-Cookie header
        const setCookie = res.headers['set-cookie'];
        resolve({ status: res.statusCode, body: parsed, raw: data, setCookie });
      });
    });
    req.on('error', (e) => resolve({ status: 0, body: {}, error: e.message }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function pass(label, detail = '') { results.push({ r: 'PASS', label, detail }); }
function fail(label, detail = '') { results.push({ r: 'FAIL', label, detail }); }
function warn(label, detail = '') { results.push({ r: 'WARN', label, detail }); }

function check(label, status, expected, body, detail = '') {
  const preview = detail || (typeof body === 'object' ? JSON.stringify(body).slice(0, 80) : String(body).slice(0, 80));
  if (status === expected) pass(label, preview);
  else fail(label, `Expected ${expected}, got ${status} — ${preview}`);
}

// ─── AUDIT CATEGORIES ─────────────────────────────────────────────────────────

async function auditHealth() {
  console.log('\n[1] Health & Connectivity');
  const r = await request('GET', '/health');
  check('Health endpoint returns 200', r.status, 200, r.body);
  if (r.body.status === 'ok' && r.body.service === 'ankelba-backend') pass('Health body has status:ok + service name');
  else fail('Health body missing status/service fields', JSON.stringify(r.body));
}

async function auditAuth() {
  console.log('\n[2] Authentication');

  // 2.1 Admin login
  const adminLogin = await request('POST', '/api/auth/login', { email: 'admin@ankelba.dev', password: 'Admin@123!' });
  check('Admin login → 200', adminLogin.status, 200, adminLogin.body);
  if (adminLogin.body.user?.role === 'admin') pass('Admin login returns role=admin');
  else fail('Admin login missing role in response', JSON.stringify(adminLogin.body));
  if (adminLogin.setCookie) { adminCookie = adminLogin.setCookie[0].split(';')[0]; pass('Admin JWT cookie set in response'); }
  else fail('Admin login did not set JWT cookie');

  // 2.2 Caregiver login
  const careLogin = await request('POST', '/api/auth/login', { email: 'caregiver@ankelba.dev', password: 'Care@123!' });
  check('Caregiver login → 200', careLogin.status, 200, careLogin.body);
  if (careLogin.setCookie) caregiverCookie = careLogin.setCookie[0].split(';')[0];

  // 2.3 Parent login
  const parentLogin = await request('POST', '/api/auth/login', { email: 'parent@ankelba.dev', password: 'Parent@123!' });
  check('Parent login → 200', parentLogin.status, 200, parentLogin.body);
  if (parentLogin.setCookie) parentCookie = parentLogin.setCookie[0].split(';')[0];

  // 2.4 Wrong password
  const badLogin = await request('POST', '/api/auth/login', { email: 'admin@ankelba.dev', password: 'WrongPass!' });
  check('Wrong password → 401', badLogin.status, 401, badLogin.body);

  // 2.5 Missing fields
  const missingLogin = await request('POST', '/api/auth/login', { email: 'admin@ankelba.dev' });
  check('Login missing password → 422', missingLogin.status, 422, missingLogin.body);

  // 2.6 Invalid email format
  const badEmail = await request('POST', '/api/auth/login', { email: 'notanemail', password: 'Test@123!' });
  check('Login invalid email format → 422', badEmail.status, 422, badEmail.body);

  // 2.7 GET /me with valid token
  const me = await request('GET', '/api/auth/me', null, adminCookie);
  check('GET /me with token → 200', me.status, 200, me.body);
  if (me.body.user?.email === 'admin@ankelba.dev') pass('/me returns correct user email');
  else fail('/me does not return expected email', JSON.stringify(me.body));

  // 2.8 GET /me without token
  const meUnauth = await request('GET', '/api/auth/me');
  check('GET /me without token → 401', meUnauth.status, 401, meUnauth.body);

  // 2.9 Logout
  const logout = await request('POST', '/api/auth/logout', null, adminCookie);
  check('Logout → 200', logout.status, 200, logout.body);

  // 2.10 Re-login admin for subsequent tests
  const reLogin = await request('POST', '/api/auth/login', { email: 'admin@ankelba.dev', password: 'Admin@123!' });
  if (reLogin.setCookie) adminCookie = reLogin.setCookie[0].split(';')[0];
}

async function auditRBAC() {
  console.log('\n[3] Role-Based Access Control (RBAC)');

  // Parent → admin route
  const p1 = await request('GET', '/api/users', null, parentCookie);
  check('Parent → GET /api/users → 403', p1.status, 403, p1.body);

  // Caregiver → admin route
  const p2 = await request('GET', '/api/users', null, caregiverCookie);
  check('Caregiver → GET /api/users → 403', p2.status, 403, p2.body);

  // No token → protected route
  const p3 = await request('GET', '/api/users');
  check('No token → GET /api/users → 401', p3.status, 401, p3.body);

  // Admin → admin route (should succeed)
  const p4 = await request('GET', '/api/users', null, adminCookie);
  check('Admin → GET /api/users → 200', p4.status, 200, p4.body);
}

async function auditUsers() {
  console.log('\n[4] User Management Module');

  // List users
  const list = await request('GET', '/api/users', null, adminCookie);
  check('GET /api/users → 200, returns array', list.status, 200, list.body);
  if (Array.isArray(list.body?.data || list.body)) pass('Users list is an array');
  else warn('Users list format unexpected', JSON.stringify(list.body).slice(0, 80));

  // Get user by ID
  const getOne = await request('GET', '/api/users/1', null, adminCookie);
  check('GET /api/users/1 → 200', getOne.status, 200, getOne.body);

  // Get non-existent user
  const get404 = await request('GET', '/api/users/99999', null, adminCookie);
  check('GET /api/users/99999 → 404', get404.status, 404, get404.body);

  // Create user (valid)
  const create = await request('POST', '/api/users', {
    name: 'Audit Test User', email: 'audit_test_' + Date.now() + '@ankelba.dev',
    password: 'Audit@123!', role: 'caregiver'
  }, adminCookie);
  check('POST /api/users (valid) → 201', create.status, 201, create.body);
  const newUserId = create.body?.user?.id || create.body?.id;

  // Create user — duplicate email
  const dupEmail = await request('POST', '/api/users', {
    name: 'Dup', email: 'admin@ankelba.dev', password: 'Test@123!', role: 'parent'
  }, adminCookie);
  check('POST /api/users duplicate email → 409', dupEmail.status, 409, dupEmail.body);

  // Create user — missing required fields
  const missing = await request('POST', '/api/users', { name: 'NoEmail' }, adminCookie);
  check('POST /api/users missing email → 422', missing.status, 422, missing.body);

  // Create user — invalid role
  const badRole = await request('POST', '/api/users', {
    name: 'Bad', email: 'badrole@ankelba.dev', password: 'Test@123!', role: 'superadmin'
  }, adminCookie);
  check('POST /api/users invalid role → 422', badRole.status, 422, badRole.body);

  // PATCH user
  if (newUserId) {
    const patch = await request('PATCH', `/api/users/${newUserId}`, { name: 'Audit User Updated' }, adminCookie);
    check(`PATCH /api/users/${newUserId} → 200`, patch.status, 200, patch.body);

    // PATCH status  
    const status = await request('PATCH', `/api/users/${newUserId}/status`, { status: 'inactive' }, adminCookie);
    check(`PATCH /api/users/${newUserId}/status → 200`, status.status, 200, status.body);
  } else {
    warn('User create did not return ID — skipping PATCH tests');
  }

  // Pagination
  const paginated = await request('GET', '/api/users?page=1&limit=5', null, adminCookie);
  check('GET /api/users?page=1&limit=5 → 200', paginated.status, 200, paginated.body);
  if (paginated.body?.total !== undefined) pass('Pagination returns total field');
  else warn('Pagination response missing total field', JSON.stringify(paginated.body).slice(0, 80));
}

async function auditStubs() {
  console.log('\n[5] Module Stubs (routes wired, business logic pending)');

  const stubs = [
    { label: 'Children',      method: 'GET',  path: '/api/children' },
    { label: 'Attendance',    method: 'GET',  path: '/api/attendance' },
    { label: 'Reports',       method: 'GET',  path: '/api/reports/daily' },
    { label: 'Health',        method: 'GET',  path: '/api/health/child/1' },
    { label: 'Announcements', method: 'GET',  path: '/api/announcements' },
    { label: 'Messages',      method: 'GET',  path: '/api/messages' },
    { label: 'Alerts',        method: 'GET',  path: '/api/alerts' },
    { label: 'Events',        method: 'GET',  path: '/api/events' },
    { label: 'Store Products',method: 'GET',  path: '/api/store/products' },
    { label: 'Store Orders',  method: 'GET',  path: '/api/store/orders' },
    { label: 'Audit Logs',    method: 'GET',  path: '/api/audit' },
    { label: 'AI Guide',      method: 'POST', path: '/api/ai/guide', body: { question: 'test' } },
    { label: 'Payments list', method: 'GET',  path: '/api/payments/order/1' },
    { label: 'Biometric guardian', method: 'GET', path: '/api/biometric/guardian/1' },
  ];

  for (const s of stubs) {
    const r = await request(s.method, s.path, s.body || null, adminCookie);
    const reachable = r.status >= 200 && r.status <= 499;
    if (reachable) pass(`Stub reachable: ${s.label} → ${r.status}`, `${s.method} ${s.path}`);
    else fail(`Stub UNREACHABLE: ${s.label} → ${r.status}`, `${s.method} ${s.path}`);
  }
}

async function auditDatabase() {
  console.log('\n[6] Database Schema Verification');
  const { Pool } = require('pg');
  require('dotenv').config();
  const db = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const expectedTables = [
    'roles','users','groups','children','emergency_contacts','care_instructions',
    'guardian_links','attendance','daily_reports','report_meals','report_activities',
    'health_records','announcements','messages','alerts','events',
    'biometric_references','guardian_verification_events',
    'product_categories','products','orders','order_items','payments','audit_logs'
  ];

  try {
    const { rows } = await db.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const existing = rows.map(r => r.tablename);

    for (const t of expectedTables) {
      if (existing.includes(t)) pass(`Table exists: ${t}`);
      else fail(`Table MISSING: ${t}`);
    }

    // Check knex_migrations table
    if (existing.includes('knex_migrations')) pass('Knex migrations table present');
    else fail('Knex migrations table missing');

    // Check index count
    const { rows: idxRows } = await db.query(
      `SELECT COUNT(*) AS cnt FROM pg_indexes WHERE schemaname = 'public'`
    );
    const idxCount = parseInt(idxRows[0].cnt);
    if (idxCount >= 50) pass(`Index count adequate: ${idxCount} indexes`);
    else warn(`Index count lower than expected: ${idxCount} (expected 50+)`);

    // Check seed data
    const { rows: roleRows } = await db.query(`SELECT COUNT(*) AS cnt FROM roles`);
    if (parseInt(roleRows[0].cnt) >= 3) pass('Roles seeded (3 roles present)');
    else fail(`Roles insufficient: ${roleRows[0].cnt} found`);

    const { rows: userRows } = await db.query(`SELECT COUNT(*) AS cnt FROM users`);
    if (parseInt(userRows[0].cnt) >= 3) pass(`Users seeded (${userRows[0].cnt} users found)`);
    else fail(`Users insufficient: ${userRows[0].cnt} found`);

    // Check foreign keys present
    const { rows: fkRows } = await db.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND constraint_schema='public'`
    );
    if (parseInt(fkRows[0].cnt) >= 15) pass(`Foreign keys present: ${fkRows[0].cnt} FK constraints`);
    else warn(`FK count lower than expected: ${fkRows[0].cnt}`);

    // Check CHECK constraints
    const { rows: ckRows } = await db.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.table_constraints WHERE constraint_type='CHECK' AND constraint_schema='public'`
    );
    if (parseInt(ckRows[0].cnt) >= 10) pass(`CHECK constraints present: ${ckRows[0].cnt}`);
    else warn(`CHECK constraint count: ${ckRows[0].cnt}`);

  } catch (e) {
    fail('Database connection failed: ' + e.message);
  } finally {
    await db.end();
  }
}

async function auditSecurity() {
  console.log('\n[7] Security Controls');

  // Rate limiter present (auth route)
  const promises = [];
  for (let i = 0; i < 8; i++) {
    promises.push(request('POST', '/api/auth/login', { email: 'x@x.com', password: 'pass' }));
  }
  const responses = await Promise.all(promises);
  const got429 = responses.some(r => r.status === 429);
  if (got429) pass('Auth rate limiter fires after burst (429 received)');
  else warn('Rate limiter did not fire at 8 rapid requests — may be configured for higher limit');

  // SQL injection attempt
  const sqli = await request('POST', '/api/auth/login', { email: "' OR '1'='1", password: "' OR '1'='1" });
  if (sqli.status === 401 || sqli.status === 422) pass('SQL injection attempt safely rejected');
  else fail('SQL injection attempt returned unexpected status: ' + sqli.status);

  // No token on protected route
  const noToken = await request('GET', '/api/users');
  check('No token → 401 (not 500)', noToken.status, 401, {});

  // Oversized payload
  const bigPayload = await request('POST', '/api/auth/login', { email: 'a'.repeat(5000) + '@x.com', password: 'x' });
  if (bigPayload.status === 422 || bigPayload.status === 413) pass('Oversized email rejected safely');
  else warn(`Oversized payload status: ${bigPayload.status} — verify body size limit`);
}

// ─── MAIN RUNNER ──────────────────────────────────────────────────────────────
async function run() {
  console.log('════════════════════════════════════════════════════');
  console.log('  ANKELBA BACKEND AUDIT — ' + new Date().toISOString());
  console.log('════════════════════════════════════════════════════');

  await auditHealth();
  await auditAuth();
  await auditRBAC();
  await auditUsers();
  await auditStubs();
  await auditDatabase();
  await auditSecurity();

  // ── REPORT ─────────────────────────────────────────────────────
  const PASS = results.filter(r => r.r === 'PASS');
  const FAIL = results.filter(r => r.r === 'FAIL');
  const WARN = results.filter(r => r.r === 'WARN');

  console.log('\n════════════════════════════════════════════════════');
  console.log('  AUDIT RESULTS');
  console.log('════════════════════════════════════════════════════');

  if (FAIL.length > 0) {
    console.log('\n  ❌ FAILURES:');
    FAIL.forEach(r => console.log(`     [FAIL] ${r.label}\n            ${r.detail}`));
  }
  if (WARN.length > 0) {
    console.log('\n  ⚠️  WARNINGS:');
    WARN.forEach(r => console.log(`     [WARN] ${r.label}\n            ${r.detail}`));
  }
  if (PASS.length > 0) {
    console.log('\n  ✅ PASSED:');
    PASS.forEach(r => console.log(`     [PASS] ${r.label}`));
  }

  console.log('\n════════════════════════════════════════════════════');
  console.log(`  TOTAL: ${results.length}   PASS: ${PASS.length}   FAIL: ${FAIL.length}   WARN: ${WARN.length}`);
  const score = Math.round((PASS.length / results.length) * 100);
  console.log(`  SCORE: ${score}%`);
  console.log('════════════════════════════════════════════════════');

  process.exit(FAIL.length > 0 ? 1 : 0);
}

run().catch(e => { console.error('Audit script error:', e); process.exit(1); });
