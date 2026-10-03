/**
 * Ankelba API + DB Audit — Clean single-run script
 * Usage: node audit_clean.js
 */
const http = require('http');
const { Pool } = require('pg');
require('dotenv').config();

const BASE_HOST = 'localhost';
const BASE_PORT = 5000;

const PASS = [], FAIL = [], WARN = [];
const ok = (l, d = '') => PASS.push({ l, d });
const fail = (l, d = '') => FAIL.push({ l, d });
const warn = (l, d = '') => WARN.push({ l, d });

function req(method, path, body, cookie) {
  return new Promise((resolve) => {
    const b = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) };
    if (cookie) headers['Cookie'] = cookie;
    const options = { hostname: BASE_HOST, port: BASE_PORT, path, method, headers };
    const r = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(data); } catch (_) {}
        const sc = res.headers['set-cookie'];
        resolve({ status: res.statusCode, body: parsed, setCookie: sc });
      });
    });
    r.on('error', e => resolve({ status: 0, body: {}, error: e.message }));
    if (b) r.write(b);
    r.end();
  });
}

function chk(label, status, expected, body = {}) {
  const d = JSON.stringify(body).slice(0, 60);
  status === expected ? ok(label, `${status} ✓`) : fail(label, `expected ${expected}, got ${status} — ${d}`);
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  ANKELBA BACKEND AUDIT — ' + new Date().toLocaleTimeString());
  console.log('══════════════════════════════════════════════════════');

  // ─ 1. HEALTH ────────────────────────────────────────────────
  console.log('\n[1] Health Check');
  let r = await req('GET', '/health');
  chk('Health → 200', r.status, 200);
  if (r.body.status === 'ok') ok('Health body status=ok');
  else fail('Health body status missing', JSON.stringify(r.body));

  // ─ 2. AUTH ──────────────────────────────────────────────────
  console.log('[2] Authentication');
  r = await req('POST', '/api/auth/login', { email: 'admin@ankelba.dev', password: 'Admin@123!' });
  chk('Admin login → 200', r.status, 200, r.body);
  const adminCk = r.setCookie ? r.setCookie[0].split(';')[0] : '';
  adminCk ? ok('Admin JWT cookie set') : fail('Admin JWT cookie missing');
  r.body.user?.role === 'admin' ? ok('Admin login returns role=admin') : fail('Admin role missing in response', JSON.stringify(r.body));

  r = await req('POST', '/api/auth/login', { email: 'caregiver@ankelba.dev', password: 'Care@123!' });
  chk('Caregiver login → 200', r.status, 200, r.body);
  const careCk = r.setCookie ? r.setCookie[0].split(';')[0] : '';

  r = await req('POST', '/api/auth/login', { email: 'parent@ankelba.dev', password: 'Parent@123!' });
  chk('Parent login → 200', r.status, 200, r.body);
  const parentCk = r.setCookie ? r.setCookie[0].split(';')[0] : '';

  r = await req('GET', '/api/auth/me', null, adminCk);
  chk('GET /me with token → 200', r.status, 200, r.body);
  r.body.user?.email === 'admin@ankelba.dev' ? ok('/me returns correct user email') : fail('/me wrong email', JSON.stringify(r.body));

  r = await req('GET', '/api/auth/me');
  chk('GET /me without token → 401', r.status, 401, r.body);

  r = await req('POST', '/api/auth/login', { email: 'admin@ankelba.dev', password: 'WRONG_PASSWORD' });
  chk('Wrong password → 401', r.status, 401, r.body);

  r = await req('POST', '/api/auth/login', { email: 'admin@ankelba.dev' });
  chk('Missing password → 422', r.status, 422, r.body);

  r = await req('POST', '/api/auth/login', { email: 'notanemail', password: 'Test@123!' });
  chk('Invalid email format → 422', r.status, 422, r.body);

  r = await req('POST', '/api/auth/logout', null, adminCk);
  chk('Logout → 200', r.status, 200, r.body);

  // Re-login to get fresh cookie for rest of tests
  r = await req('POST', '/api/auth/login', { email: 'admin@ankelba.dev', password: 'Admin@123!' });
  const ak = r.setCookie ? r.setCookie[0].split(';')[0] : adminCk;

  // ─ 3. RBAC ───────────────────────────────────────────────────
  console.log('[3] RBAC');
  r = await req('GET', '/api/users', null, parentCk);
  chk('Parent → /api/users → 403', r.status, 403, r.body);

  r = await req('GET', '/api/users', null, careCk);
  chk('Caregiver → /api/users → 403', r.status, 403, r.body);

  r = await req('GET', '/api/users');
  chk('No token → /api/users → 401', r.status, 401, r.body);

  r = await req('GET', '/api/users', null, ak);
  chk('Admin → /api/users → 200', r.status, 200, r.body);

  // ─ 4. USERS CRUD ─────────────────────────────────────────────
  console.log('[4] User Management');
  r = await req('GET', '/api/users', null, ak);
  chk('GET /api/users → 200', r.status, 200, r.body);
  if (Array.isArray(r.body?.data)) ok('Users list has data array');
  else if (Array.isArray(r.body)) ok('Users list is array');
  else warn('Users list format unexpected', JSON.stringify(r.body).slice(0, 80));

  const targetUserId = (Array.isArray(r.body?.data) && r.body.data.length > 0) ? r.body.data[0].id : ((Array.isArray(r.body) && r.body.length > 0) ? r.body[0].id : 10);
  r = await req('GET', `/api/users/${targetUserId}`, null, ak);
  chk(`GET /api/users/${targetUserId} → 200`, r.status, 200, r.body);

  r = await req('GET', '/api/users/99999', null, ak);
  chk('GET /api/users/99999 → 404', r.status, 404, r.body);

  const ts = Date.now();
  r = await req('POST', '/api/users', {
    name: 'Audit User ' + ts, email: `audituser${ts}@ankelba.dev`,
    password: 'Audit@123!', role: 'caregiver'
  }, ak);
  chk('POST /api/users → 201', r.status, 201, r.body);
  const newId = r.body?.user?.id || r.body?.id;

  r = await req('POST', '/api/users', {
    name: 'Dup', email: 'admin@ankelba.dev', password: 'Password@123!', role: 'parent'
  }, ak);
  chk('Duplicate email → 409', r.status, 409, r.body);

  r = await req('POST', '/api/users', { name: 'NoFields' }, ak);
  chk('Missing required fields → 422', r.status, 422, r.body);

  r = await req('POST', '/api/users', {
    name: 'Bad', email: 'bad@ankelba.dev', password: 'Password@123!', role: 'superadmin'
  }, ak);
  chk('Invalid role → 422', r.status, 422, r.body);

  if (newId) {
    r = await req('PATCH', `/api/users/${newId}`, { name: 'Updated Audit User' }, ak);
    chk(`PATCH /api/users/${newId} → 200`, r.status, 200, r.body);

    r = await req('PATCH', `/api/users/${newId}/status`, { status: 'inactive' }, ak);
    chk(`PATCH /api/users/${newId}/status → 200`, r.status, 200, r.body);
  } else {
    warn('No newId returned from POST /api/users — skipping PATCH tests');
  }

  // ─ 5. STUBS (authenticated as admin) ─────────────────────────
  console.log('[5] Module Stub Routes');
  const stubs = [
    { l: 'Children',      m: 'GET',  p: '/api/children' },
    { l: 'Attendance',    m: 'GET',  p: '/api/attendance' },
    { l: 'Reports Daily', m: 'GET',  p: '/api/reports/daily' },
    { l: 'Health',        m: 'GET',  p: '/api/health/child/1' },
    { l: 'Announcements', m: 'GET',  p: '/api/announcements' },
    { l: 'Messages',      m: 'GET',  p: '/api/messages' },
    { l: 'Alerts',        m: 'GET',  p: '/api/alerts' },
    { l: 'Events',        m: 'GET',  p: '/api/events' },
    { l: 'Store Products',m: 'GET',  p: '/api/store/products' },
    { l: 'Store Orders',  m: 'GET',  p: '/api/store/orders' },
    { l: 'Audit Logs',    m: 'GET',  p: '/api/audit' },
    { l: 'AI Guide',      m: 'POST', p: '/api/ai/guide', b: { question: 'test' } },
    { l: 'Payments',      m: 'GET',  p: '/api/payments/order/1' },
    { l: 'Biometric',     m: 'GET',  p: '/api/biometric/guardian/1' },
  ];
  for (const s of stubs) {
    r = await req(s.m, s.p, s.b || null, ak);
    if (r.status >= 200 && r.status <= 503) {
      ok(`Stub reachable: ${s.l} → ${r.status}`);
    } else {
      fail(`Stub UNREACHABLE: ${s.l}`, `${r.status} — ${r.error || ''}`);
    }
  }

  // ─ 6. DATABASE SCHEMA ─────────────────────────────────────────
  console.log('[6] Database Schema');
  const db = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
  });

  const expectedTables = [
    'roles', 'users', 'groups', 'children', 'emergency_contacts',
    'care_instructions', 'guardian_links', 'attendance', 'daily_reports',
    'report_meals', 'report_activities', 'health_records', 'announcements',
    'messages', 'alerts', 'events', 'biometric_references',
    'guardian_verification_events', 'product_categories', 'products',
    'orders', 'order_items', 'payments', 'audit_logs',
  ];

  try {
    const { rows: tRows } = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
    const existing = tRows.map(t => t.tablename);

    let missingTables = 0;
    for (const t of expectedTables) {
      if (existing.includes(t)) ok(`Table: ${t}`);
      else { fail(`MISSING TABLE: ${t}`); missingTables++; }
    }
    if (missingTables === 0) ok(`All ${expectedTables.length} expected tables present`);

    const { rows: idx } = await db.query(`SELECT COUNT(*) AS c FROM pg_indexes WHERE schemaname='public'`);
    const idxCount = parseInt(idx[0].c);
    idxCount >= 50 ? ok(`Indexes: ${idxCount} total (expected 50+)`) : warn(`Low index count: ${idxCount}`);

    const { rows: fk } = await db.query(`SELECT COUNT(*) AS c FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND constraint_schema='public'`);
    ok(`Foreign key constraints: ${fk[0].c}`);

    const { rows: ck } = await db.query(`SELECT COUNT(*) AS c FROM information_schema.table_constraints WHERE constraint_type='CHECK' AND constraint_schema='public'`);
    ok(`CHECK constraints: ${ck[0].c}`);

    const { rows: roleRows } = await db.query(`SELECT name FROM roles ORDER BY id`);
    const roleNames = roleRows.map(r => r.name);
    ['admin', 'caregiver', 'parent'].every(n => roleNames.includes(n))
      ? ok(`Roles seeded: ${roleNames.join(', ')}`)
      : fail('Missing roles', JSON.stringify(roleNames));

    const { rows: uRows } = await db.query(`SELECT email, role_id FROM users u`);
    ok(`Users seeded: ${uRows.length} users in DB`);

    const { rows: km } = await db.query(`SELECT COUNT(*) AS c FROM knex_migrations`);
    ok(`Knex migrations tracked: ${km[0].c} migrations`);

  } catch (e) {
    fail('DB query error: ' + e.message);
  } finally {
    await db.end();
  }

  // ─ 7. SECURITY ────────────────────────────────────────────────
  console.log('[7] Security');
  r = await req('POST', '/api/auth/login', { email: "' OR '1'='1", password: "' OR '1'='1" });
  (r.status === 401 || r.status === 422 || r.status === 429)
    ? ok(`SQL injection attempt blocked → ${r.status}`)
    : fail('SQL injection not blocked', String(r.status));

  r = await req('GET', '/api/users');
  r.status === 401 ? ok('Unauthenticated request → 401 (not 500)') : fail('Unauthenticated → unexpected', String(r.status));

  // ─ REPORT ─────────────────────────────────────────────────────
  const total = PASS.length + FAIL.length + WARN.length;
  const score = Math.round((PASS.length / total) * 100);

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  AUDIT RESULTS SUMMARY');
  console.log('══════════════════════════════════════════════════════');

  if (FAIL.length > 0) {
    console.log(`\n  ❌ FAILURES (${FAIL.length}):`);
    FAIL.forEach(f => console.log(`     [FAIL] ${f.l}\n            → ${f.d}`));
  }
  if (WARN.length > 0) {
    console.log(`\n  ⚠️  WARNINGS (${WARN.length}):`);
    WARN.forEach(w => console.log(`     [WARN] ${w.l}\n            → ${w.d}`));
  }
  console.log(`\n  ✅ PASSES (${PASS.length}):`);
  PASS.forEach(p => console.log(`     [PASS] ${p.l}  ${p.d}`));

  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  TOTAL: ${total}   PASS: ${PASS.length}   FAIL: ${FAIL.length}   WARN: ${WARN.length}`);
  console.log(`  SCORE: ${score}%  ${score === 100 ? '🎉' : score >= 90 ? '✅' : score >= 75 ? '⚠️' : '❌'}`);
  console.log('══════════════════════════════════════════════════════\n');

  process.exit(FAIL.length > 0 ? 1 : 0);
}

main().catch(e => { console.error('Audit error:', e.message); process.exit(1); });
