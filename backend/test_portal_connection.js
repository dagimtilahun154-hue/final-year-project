'use strict';
require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const db = require('./src/config/db');

let server;
let port;
let baseUrl;

const req = (method, path, body = null, token = null) => new Promise((resolve, reject) => {
  const url = new URL(path, baseUrl);
  const opts = {
    method,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;

  const r = http.request(opts, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        resolve({ status: res.statusCode, body: JSON.parse(d || '{}'), headers: res.headers });
      } catch (e) {
        resolve({ status: res.statusCode, body: { raw: d }, headers: res.headers });
      }
    });
  });
  r.on('error', reject);
  if (body) r.write(JSON.stringify(body));
  r.end();
});

let passed = 0;
let failed = 0;
const assert = (condition, name, details = '') => {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${name} — ${details}`);
  }
};

async function runPortalTests() {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('      ANKELBA ADMIN & STAFF WEB PORTAL POSTGRESQL VERIFICATION SUITE       ');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  server = app.listen(0);
  port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`Test server running on port ${port}...\n`);

  let adminToken = null;
  let caregiverToken = null;
  let parentToken = null;

  try {
    // -------------------------------------------------------------
    // Step 1: Authentication for Roles
    // -------------------------------------------------------------
    console.log('[1] Authenticating Portal Roles:');
    let res = await req('POST', '/api/auth/login', {
      email: 'admin@ankelba.dev',
      password: 'Admin@123!',
    });
    assert(res.status === 200, 'Admin login succeeded (admin@ankelba.dev)');
    adminToken = res.body?.token;

    res = await req('POST', '/api/auth/login', {
      email: 'caregiver@ankelba.dev',
      password: 'Care@123!',
    });
    assert(res.status === 200, 'Caregiver login succeeded (caregiver@ankelba.dev)');
    caregiverToken = res.body?.token;

    res = await req('POST', '/api/auth/login', {
      email: 'parent@ankelba.dev',
      password: 'Parent@123!',
    });
    assert(res.status === 200, 'Parent login succeeded (parent@ankelba.dev)');
    parentToken = res.body?.token;

    // -------------------------------------------------------------
    // Step 2: Admin Snapshot from Live PostgreSQL (GET /api/portal/snapshot)
    // -------------------------------------------------------------
    console.log('\n[2] Testing Admin Portal Snapshot (GET /api/portal/snapshot):');
    const today = new Date().toISOString().split('T')[0];
    res = await req('GET', `/api/portal/snapshot?date=${today}&days=30`, null, adminToken);
    assert(res.status === 200, 'Admin snapshot returned HTTP 200 OK', `Status: ${res.status}`);

    const snapshot = res.body;
    assert(Array.isArray(snapshot?.children), 'Snapshot contains children array', `Length: ${snapshot?.children?.length}`);
    assert(snapshot?.children?.length >= 4, `Children loaded from DB (count: ${snapshot?.children?.length})`);
    assert(Array.isArray(snapshot?.groups), 'Snapshot contains groups array', `Count: ${snapshot?.groups?.length}`);
    assert(Array.isArray(snapshot?.users), 'Snapshot contains users array', `Count: ${snapshot?.users?.length}`);
    assert(Array.isArray(snapshot?.attendance), 'Snapshot contains attendance records', `Count: ${snapshot?.attendance?.length}`);
    assert(Array.isArray(snapshot?.guardians), 'Snapshot contains guardians list', `Count: ${snapshot?.guardians?.length}`);
    assert(Array.isArray(snapshot?.announcements), 'Snapshot contains announcements', `Count: ${snapshot?.announcements?.length}`);
    assert(Array.isArray(snapshot?.events), 'Snapshot contains calendar events', `Count: ${snapshot?.events?.length}`);
    assert(Array.isArray(snapshot?.products), 'Snapshot contains store products', `Count: ${snapshot?.products?.length}`);
    assert(Array.isArray(snapshot?.orders), 'Snapshot contains store orders', `Count: ${snapshot?.orders?.length}`);
    assert(Array.isArray(snapshot?.audit), 'Snapshot contains audit log entries', `Count: ${snapshot?.audit?.length}`);

    // Verify embedded contacts and instructions in child records
    const childWithDetails = snapshot?.children?.find(c => c.emergency_contacts?.length > 0 || c.care_instructions?.length > 0);
    assert(!!childWithDetails, 'Children include embedded emergency_contacts and care_instructions');

    // -------------------------------------------------------------
    // Step 3: RBAC Protections on Admin Snapshot
    // -------------------------------------------------------------
    console.log('\n[3] Testing RBAC Protection on Admin Snapshot:');
    res = await req('GET', `/api/portal/snapshot?date=${today}&days=30`, null, caregiverToken);
    assert(res.status === 403, 'Caregiver cannot access Admin snapshot → 403 Forbidden', `Status: ${res.status}`);

    res = await req('GET', `/api/portal/snapshot?date=${today}&days=30`, null, parentToken);
    assert(res.status === 403, 'Parent cannot access Admin snapshot → 403 Forbidden', `Status: ${res.status}`);

    // -------------------------------------------------------------
    // Step 4: Staff Workspace Endpoint (GET /api/portal/workspace)
    // -------------------------------------------------------------
    console.log('\n[4] Testing Staff Workspace (GET /api/portal/workspace):');
    res = await req('GET', `/api/portal/workspace`, null, caregiverToken);
    assert(res.status === 200, 'Caregiver can access staff workspace → 200 OK', `Status: ${res.status}`);
    assert(Array.isArray(res.body?.duties), 'Workspace returns duty shifts array');
    assert(Array.isArray(res.body?.attendance), 'Workspace returns attendance array');

    res = await req('GET', `/api/portal/workspace`, null, parentToken);
    assert(res.status === 403, 'Parent cannot access staff workspace → 403 Forbidden', `Status: ${res.status}`);

    // -------------------------------------------------------------
    // Step 5: Live Database Mutations & Audit Logging
    // -------------------------------------------------------------
    console.log('\n[5] Testing Live Database Mutation & Audit Tracking:');
    // Test Group creation (simulating Admin adding a class group)
    const uniqueGroupName = `Test Room ${Date.now()}`;
    res = await req('POST', '/api/groups', {
      name: uniqueGroupName,
      description: 'Temporary verification classroom',
    }, adminToken);
    assert(res.status === 201, `Admin created classroom group "${uniqueGroupName}" → 201 Created`, `Status: ${res.status}`);
    const createdGroupId = res.body?.id;

    // Verify it exists in PostgreSQL
    const dbCheckGroup = await db.query('SELECT * FROM groups WHERE id = $1', [createdGroupId]);
    assert(dbCheckGroup.rows.length === 1, 'Classroom group immediately persisted to PostgreSQL groups table');

    // Test Front-Desk Shift Assignment
    const shiftStart = new Date(Date.now() + 3600000).toISOString();
    const shiftEnd = new Date(Date.now() + 7200000).toISOString();
    // Get caregiver ID
    const cgRes = await db.query("SELECT id FROM users WHERE email = 'caregiver@ankelba.dev'");
    const caregiverId = cgRes.rows[0]?.id;

    res = await req('POST', '/api/portal/assignments', {
      staff_id: caregiverId,
      group_id: createdGroupId,
      starts_at: shiftStart,
      ends_at: shiftEnd,
      can_attendance: true,
      can_pickup: true,
    }, adminToken);
    assert(res.status === 200, 'Admin assigned front-desk shift via /api/portal/assignments → 200 OK', `Status: ${res.status}`);
    const dutyId = res.body?.id;

    // Verify shift in PostgreSQL
    const dbCheckDuty = await db.query('SELECT * FROM front_desk_assignments WHERE id = $1', [dutyId]);
    assert(dbCheckDuty.rows.length === 1 && dbCheckDuty.rows[0].status === 'active', 'Duty shift persisted with active status in PostgreSQL');

    // Test Revoking Shift
    res = await req('PATCH', `/api/portal/assignments/${dutyId}/revoke`, null, adminToken);
    assert(res.status === 200, `Admin revoked front-desk shift ${dutyId} → 200 OK`);

    const dbCheckRevoked = await db.query('SELECT status FROM front_desk_assignments WHERE id = $1', [dutyId]);
    assert(dbCheckRevoked.rows[0]?.status === 'revoked', 'Shift status updated to revoked in PostgreSQL');

    // Verify Audit Log Entry
    const auditRes = await db.query(
      "SELECT * FROM audit_logs WHERE target_table = 'front_desk_assignments' AND target_id = $1 ORDER BY created_at DESC LIMIT 1",
      [dutyId]
    );
    assert(auditRes.rows.length === 1, `Audit log entry created for shift action (${auditRes.rows[0]?.action})`);

    // -------------------------------------------------------------
    // Step 6: Attendance Check-in & Verified Pickup Flow (FR-ATT-01, FR-ATT-02, 4.10)
    // -------------------------------------------------------------
    console.log('\n[6] Testing Live Attendance & Verified Pickup Flow:');
    // Record Check-in
    res = await req('POST', '/api/portal/attendance', {
      child_id: 1,
      event_type: 'checkin',
      notes: 'Automated test morning check-in',
    }, adminToken);
    assert(res.status === 200, 'Admin recorded child check-in via /api/portal/attendance → 200 OK', `Status: ${res.status}`);
    const checkinId = res.body?.id;

    // Verify Check-in in PostgreSQL
    const attCheck = await db.query('SELECT * FROM attendance WHERE id = $1', [checkinId]);
    assert(attCheck.rows.length === 1 && attCheck.rows[0].event_type === 'checkin', 'Check-in event persisted in PostgreSQL attendance table');

    // Record Verified Pickup / Checkout
    res = await req('POST', '/api/portal/checkout', {
      child_id: 1,
      guardian_user_id: 24,
      method: 'manual',
      identity_confirmed: true,
      reason: 'Verified father ID and credentials in person at reception',
    }, adminToken);
    assert(res.status === 200, 'Admin recorded verified checkout via /api/portal/checkout → 200 OK', `Status: ${res.status}`);
    const checkoutAttId = res.body?.attendance?.id;
    const verificationId = res.body?.verification?.id;

    // Verify Checkout and Guardian Verification in PostgreSQL
    const coCheck = await db.query('SELECT * FROM attendance WHERE id = $1', [checkoutAttId]);
    assert(coCheck.rows.length === 1 && coCheck.rows[0].event_type === 'checkout', 'Checkout event persisted in PostgreSQL attendance table');

    const gvCheck = await db.query('SELECT * FROM guardian_verification_events WHERE id = $1', [verificationId]);
    assert(gvCheck.rows.length === 1 && gvCheck.rows[0].method === 'manual', 'Guardian verification event persisted in PostgreSQL');

    // Clean up test attendance records
    await db.query('DELETE FROM guardian_verification_events WHERE id = $1', [verificationId]);
    await db.query('DELETE FROM attendance WHERE id IN ($1, $2)', [checkinId, checkoutAttId]);
    await db.query('DELETE FROM audit_logs WHERE target_table = $1 AND target_id IN ($2, $3)', ['attendance', checkinId, checkoutAttId]);
    console.log('  🧹 Cleaned up temporary attendance and verification records.');

    // Clean up shift test records
    await db.query('DELETE FROM front_desk_assignments WHERE id = $1', [dutyId]);
    await db.query('DELETE FROM audit_logs WHERE target_table = $1 AND target_id = $2', ['front_desk_assignments', dutyId]);
    await db.query('DELETE FROM groups WHERE id = $1', [createdGroupId]);
    console.log('  🧹 Cleaned up temporary group and duty records.');

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log(`  PORTAL VERIFICATION RESULTS:  ${passed} PASSED  |  ${failed} FAILED`);
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    if (server) server.close();
    await db.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runPortalTests();
