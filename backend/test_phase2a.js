'use strict';
require('dotenv').config();
const http = require('http');
const db = require('./src/config/db');

const API = 'http://localhost:5000';

let adminToken = null;
let caregiverToken = null;
let caregiverUserId = null;
let parentToken = null;
let unlinkedParentToken = null;
let testChildId = null;

const req = (method, path, body = null, token = null) => {
  return new Promise((resolve) => {
    const url = new URL(path, API);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const request = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          if (data) json = JSON.parse(data);
        } catch (e) {
          json = { text: data };
        }
        resolve({ status: res.statusCode, body: json });
      });
    });

    request.on('error', (err) => resolve({ status: 0, error: err.message }));
    if (body) request.write(JSON.stringify(body));
    request.end();
  });
};

let pass = 0;
let fail = 0;

const ok = (msg) => {
  pass++;
  console.log(`  ✅ [PASS] ${msg}`);
};

const bad = (msg, err = '') => {
  fail++;
  console.error(`  ❌ [FAIL] ${msg} — ${err}`);
};

const run = async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ANKELBA PHASE 2A TEST SUITE — ATTENDANCE & REPORTS');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Authentication & Test Data Setup
  console.log('[1] Setup & Authentication');
  let r = await req('POST', '/api/auth/login', { email: 'admin@ankelba.dev', password: 'Admin@123!' });
  adminToken = r.body?.token;
  if (adminToken) ok('Admin logged in'); else bad('Admin login failed', JSON.stringify(r.body));

  r = await req('POST', '/api/auth/login', { email: 'caregiver@ankelba.dev', password: 'Care@123!' });
  caregiverToken = r.body?.token;
  caregiverUserId = r.body?.user?.id;
  if (caregiverToken) ok(`Caregiver logged in (ID: ${caregiverUserId})`); else bad('Caregiver login failed', JSON.stringify(r.body));

  r = await req('POST', '/api/auth/login', { email: 'parent@ankelba.dev', password: 'Parent@123!' });
  parentToken = r.body?.token;
  if (parentToken) ok('Linked Parent logged in'); else bad('Parent login failed', JSON.stringify(r.body));

  const unlinkedEmail = `unlinked_2a_${Date.now()}@ankelba.dev`;
  await req('POST', '/api/users', { name: 'Unlinked Parent 2A', email: unlinkedEmail, password: 'Parent@123!', role: 'parent' }, adminToken);
  r = await req('POST', '/api/auth/login', { email: unlinkedEmail, password: 'Parent@123!' });
  unlinkedParentToken = r.body?.token;
  if (unlinkedParentToken) ok('Unlinked Parent logged in'); else bad('Unlinked parent setup failed', JSON.stringify(r.body));

  // Find assigned child ID for caregiver
  r = await req('GET', '/api/children', null, caregiverToken);
  if (r.status === 200 && r.body.data?.length > 0) {
    testChildId = r.body.data[0].id;
    ok(`Found test child assigned to caregiver (ID: ${testChildId})`);
  } else {
    bad('No child assigned to caregiver for testing', JSON.stringify(r.body));
    return;
  }

  // Pre-test DB cleanup for idempotent execution
  await db.query(`DELETE FROM report_activities WHERE report_id IN (SELECT id FROM daily_reports WHERE child_id = $1)`, [testChildId]);
  await db.query(`DELETE FROM report_meals WHERE report_id IN (SELECT id FROM daily_reports WHERE child_id = $1)`, [testChildId]);
  await db.query(`DELETE FROM daily_reports WHERE child_id = $1`, [testChildId]);
  await db.query(`DELETE FROM attendance WHERE child_id = $1`, [testChildId]);

  // 2. Attendance State Machine & Events
  console.log('\n[2] Attendance State Machine');
  r = await req('POST', '/api/attendance', { child_id: testChildId, event_type: 'checkin', notes: 'Arrived via bus' }, caregiverToken);
  if (r.status === 201) ok('Recorded checkin → 201 Created');
  else bad('Checkin failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Duplicate checkin -> 422
  r = await req('POST', '/api/attendance', { child_id: testChildId, event_type: 'checkin' }, caregiverToken);
  r.status === 422 ? ok('Duplicate checkin blocked → 422 Unprocessable Entity') : bad('Duplicate checkin allowed', r.status);

  // Absent after checkin -> 422
  r = await req('POST', '/api/attendance', { child_id: testChildId, event_type: 'absent' }, caregiverToken);
  r.status === 422 ? ok('Absent after checkin blocked → 422 Unprocessable Entity') : bad('Absent after checkin allowed', r.status);

  // Checkout -> 201
  r = await req('POST', '/api/attendance', { child_id: testChildId, event_type: 'checkout', notes: 'Picked up by parent' }, caregiverToken);
  r.status === 201 ? ok('Recorded checkout → 201 Created') : bad('Checkout failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // 3. Attendance Queries
  console.log('\n[3] Attendance Queries & Admin Grid');
  r = await req('GET', `/api/attendance/child/${testChildId}`, null, parentToken);
  if (r.status === 200 && Array.isArray(r.body.data) && r.body.data.length >= 2) {
    ok(`Linked parent fetched child attendance history (${r.body.data.length} events)`);
  } else {
    bad('Linked parent attendance fetch failed', `${r.status} — ${JSON.stringify(r.body)}`);
  }

  // Unlinked parent -> 403
  r = await req('GET', `/api/attendance/child/${testChildId}`, null, unlinkedParentToken);
  r.status === 403 ? ok('Unlinked parent attendance fetch blocked → 403') : bad('Unlinked parent fetched attendance!', r.status);

  // Admin live attendance grid & summary counts
  r = await req('GET', '/api/attendance', null, adminToken);
  if (r.status === 200 && r.body.summary && Array.isArray(r.body.grid)) {
    ok(`Admin attendance grid returns ${r.body.grid.length} rows; total_enrolled: ${r.body.summary.total_enrolled}`);
  } else {
    bad('Admin attendance grid failed', `${r.status} — ${JSON.stringify(r.body)}`);
  }

  // 4. Daily Activity Reports (POST /api/reports/daily)
  console.log('\n[4] Daily Activity Reporting (Transactions & 3-Query Assembly)');
  const todayStr = new Date().toISOString().split('T')[0];
  r = await req('POST', '/api/reports/daily', {
    child_id: testChildId,
    report_date: todayStr,
    sleep_duration_min: 90,
    mood: 'happy',
    behavior_notes: 'Well behaved during group play',
    general_observations: 'Ate all lunch',
    meals: [
      { meal_type: 'lunch', description: 'Rice and chicken porridge', portion: 'good' }
    ],
    activities: [
      { activity_type: 'learning', description: 'Alphabet building blocks', location: 'indoor' },
      { activity_type: 'play', description: 'Sand sandbox fun', location: 'outdoor' }
    ]
  }, caregiverToken);

  let newReportId = r.body?.id;
  if (r.status === 201 && newReportId) {
    ok(`Daily report created in transaction (ID: ${newReportId})`);
    if (r.body.meals?.length === 1 && r.body.activities?.length === 2) {
      ok('Meals and activities arrays returned in creation response');
    } else bad('Meals/activities missing in creation response');
  } else {
    bad('POST /api/reports/daily failed', `${r.status} — ${JSON.stringify(r.body)}`);
  }

  // Duplicate report for same child & date -> 409
  r = await req('POST', '/api/reports/daily', {
    child_id: testChildId,
    report_date: todayStr,
    mood: 'calm'
  }, caregiverToken);
  r.status === 409 ? ok('Duplicate report for same day → 409 Conflict') : bad('Duplicate daily report allowed!', r.status);

  // 5. Report Retrieval (3-Query Pattern)
  console.log('\n[5] Report Retrieval & Authorization');
  r = await req('GET', `/api/reports/daily/${newReportId}`, null, parentToken);
  if (r.status === 200 && r.body.id === newReportId) {
    ok('Linked parent fetched detailed report → 200 OK');
    if (Array.isArray(r.body.meals) && Array.isArray(r.body.activities) && r.body.caregiver_name) {
      ok('3-query pattern correctly assembled report header, meals, activities, & caregiver name');
    } else bad('3-query report assembly incomplete', JSON.stringify(r.body));
  } else {
    bad('Linked parent failed to fetch report', `${r.status} — ${JSON.stringify(r.body)}`);
  }

  // Unlinked parent -> 403
  r = await req('GET', `/api/reports/daily/${newReportId}`, null, unlinkedParentToken);
  r.status === 403 ? ok('Unlinked parent report fetch blocked → 403') : bad('Unlinked parent fetched report!', r.status);

  // Get child reports history
  r = await req('GET', `/api/reports/daily/child/${testChildId}`, null, parentToken);
  if (r.status === 200 && Array.isArray(r.body.data) && r.body.data.length >= 1) {
    ok(`Linked parent fetched child reports history list (${r.body.data.length} reports)`);
  } else bad('Child reports history list failed', `${r.status}`);

  // Admin Caregiver Completion Monitor
  console.log('\n[6] Admin Completion Monitor');
  r = await req('GET', '/api/reports/daily', null, adminToken);
  if (r.status === 200 && Array.isArray(r.body.monitor)) {
    ok(`Admin caregiver completion monitor returned ${r.body.monitor.length} caregiver stats`);
  } else bad('Admin completion monitor failed', `${r.status} — ${JSON.stringify(r.body)}`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  TOTAL: ${pass + fail}   PASS: ${pass}   FAIL: ${fail}`);
  if (fail === 0) {
    console.log('  SCORE: 100% — PHASE 2A IMPLEMENTATION COMPLETE! 🎉');
  } else {
    console.log('  SCORE: FAILED ❌');
  }
  console.log('═══════════════════════════════════════════════════════\n');
  process.exit(fail === 0 ? 0 : 1);
};

run();
