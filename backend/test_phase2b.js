'use strict';
/**
 * Automated Verification Suite for Phase 2B — Health Records & Communication
 */
require('dotenv').config();
const http = require('http');

const API = 'http://localhost:5000';

let adminToken = null;
let adminUserId = null;
let caregiverToken = null;
let caregiverUserId = null;
let parentToken = null;
let parentUserId = null;
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
  console.log('  ANKELBA PHASE 2B TEST SUITE — HEALTH & COMMUNICATION');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Setup & Authentication
  console.log('[1] Setup & Authentication');
  let r = await req('POST', '/api/auth/login', { email: 'admin@ankelba.dev', password: 'Admin@123!' });
  adminToken = r.body?.token;
  adminUserId = r.body?.user?.id;
  if (adminToken) ok(`Admin logged in (ID: ${adminUserId})`); else bad('Admin login failed', JSON.stringify(r.body));

  r = await req('POST', '/api/auth/login', { email: 'caregiver@ankelba.dev', password: 'Care@123!' });
  caregiverToken = r.body?.token;
  caregiverUserId = r.body?.user?.id;
  if (caregiverToken) ok(`Caregiver logged in (ID: ${caregiverUserId})`); else bad('Caregiver login failed', JSON.stringify(r.body));

  r = await req('POST', '/api/auth/login', { email: 'parent@ankelba.dev', password: 'Parent@123!' });
  parentToken = r.body?.token;
  parentUserId = r.body?.user?.id;
  if (parentToken) ok(`Linked Parent logged in (ID: ${parentUserId})`); else bad('Parent login failed', JSON.stringify(r.body));

  const unlinkedEmail = `unlinked_2b_${Date.now()}@ankelba.dev`;
  await req('POST', '/api/users', { name: 'Unlinked Parent 2B', email: unlinkedEmail, password: 'Parent@123!', role: 'parent' }, adminToken);
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

  // 2. Health & Incident Reporting (POST /api/health)
  console.log('\n[2] Health & Incident Records (FR-HIR-01–06)');
  r = await req('POST', '/api/health', {
    child_id: testChildId,
    record_type: 'health',
    description: 'Mild temperature of 37.8C observed at 11am',
    severity: 'low',
    parent_notified: false
  }, caregiverToken);

  let newHealthId = r.body?.id;
  if (r.status === 201 && newHealthId) {
    ok(`Created health record (ID: ${newHealthId})`);
    if (typeof r.body.disclaimer === 'string' && r.body.disclaimer.includes('medical diagnosis')) {
      ok('Medical disclaimer attached to creation response (FR-HIR-06)');
    } else bad('Medical disclaimer missing from creation response', JSON.stringify(r.body));
  } else bad('POST /api/health failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Fetch health history as linked parent
  r = await req('GET', `/api/health/child/${testChildId}`, null, parentToken);
  if (r.status === 200 && Array.isArray(r.body.data) && r.body.data.length >= 1) {
    ok(`Linked parent fetched health history (${r.body.data.length} records)`);
    if (r.body.disclaimer) ok('Medical disclaimer attached to history fetch response');
  } else bad('Linked parent health history fetch failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Fetch health history as unlinked parent -> 403
  r = await req('GET', `/api/health/child/${testChildId}`, null, unlinkedParentToken);
  r.status === 403 ? ok('Unlinked parent health history blocked → 403') : bad('Unlinked parent fetched health history!', r.status);

  // Mark parent notified -> 200
  r = await req('PATCH', `/api/health/${newHealthId}/notify`, null, caregiverToken);
  r.status === 200 && r.body.parent_notified === true ? ok('Marked parent_notified = true → 200 OK') : bad('Mark notified failed', r.status);

  // 3. Announcements (POST & GET /api/announcements)
  console.log('\n[3] Announcements Module (FR-COM-02)');
  r = await req('POST', '/api/announcements', {
    title: 'Daycare Field Trip Announcement',
    body: 'We are visiting the National Museum next Friday.',
    announcement_type: 'general',
    audience: 'all'
  }, adminToken);

  let newAnnId = r.body?.id;
  if (r.status === 201 && newAnnId) {
    ok(`Admin created announcement (ID: ${newAnnId})`);
  } else bad('Admin failed to create announcement', `${r.status} — ${JSON.stringify(r.body)}`);

  // Non-admin POST -> 403
  r = await req('POST', '/api/announcements', { title: 'Illegal', body: 'Hack' }, caregiverToken);
  r.status === 403 ? ok('Caregiver forbidden to create announcement → 403') : bad('Caregiver published announcement!', r.status);

  // List announcements as parent
  r = await req('GET', '/api/announcements', null, parentToken);
  if (r.status === 200 && Array.isArray(r.body.data) && r.body.data.length >= 1) {
    ok(`Parent fetched announcements list (${r.body.data.length} items)`);
  } else bad('Parent failed to fetch announcements', `${r.status}`);

  // 4. Direct Messages (POST, GET, PATCH /api/messages)
  console.log('\n[4] Structured In-App Messaging (FR-COM-01)');
  // Parent sends message to Caregiver
  r = await req('POST', '/api/messages', {
    recipient_id: caregiverUserId,
    subject: 'Question regarding lunch',
    body: 'Hi, did Abebe finish his vegetable porridge today?'
  }, parentToken);

  let newMsgId = r.body?.id;
  if (r.status === 201 && newMsgId) {
    ok(`Parent sent direct message (ID: ${newMsgId}) to Caregiver ${caregiverUserId}`);
  } else bad('POST /api/messages failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Caregiver lists messages with parent
  r = await req('GET', `/api/messages?with_user_id=${parentUserId}`, null, caregiverToken);
  if (r.status === 200 && Array.isArray(r.body.data) && r.body.data.length >= 1) {
    ok(`Caregiver fetched conversation thread with parent (${r.body.data.length} messages)`);
  } else bad('Caregiver failed to fetch message thread', `${r.status}`);

  // Caregiver marks message as read
  r = await req('PATCH', `/api/messages/${newMsgId}/read`, null, caregiverToken);
  if (r.status === 200 && r.body.read_at) {
    ok(`Caregiver marked message ${newMsgId} as read → 200 OK`);
  } else bad('Mark message as read failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // 5. Urgent Alerts (POST & GET /api/alerts)
  console.log('\n[5] Urgent Alerts (FR-COM-03)');
  r = await req('POST', '/api/alerts', {
    title: 'Severe Weather Warning',
    urgency: 'high',
    recipient_scope: 'all'
  }, adminToken);

  let newAlertId = r.body?.id;
  if (r.status === 201 && newAlertId) {
    ok(`Admin created urgent alert (ID: ${newAlertId})`);
  } else bad('POST /api/alerts failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Parent fetches alerts
  r = await req('GET', '/api/alerts', null, parentToken);
  if (r.status === 200 && Array.isArray(r.body.data) && r.body.data.length >= 1) {
    ok(`Parent received active alerts list (${r.body.data.length} alerts)`);
  } else bad('Parent failed to fetch alerts', `${r.status}`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  TOTAL: ${pass + fail}   PASS: ${pass}   FAIL: ${fail}`);
  if (fail === 0) {
    console.log('  SCORE: 100% — PHASE 2B IMPLEMENTATION COMPLETE! 🎉');
  } else {
    console.log('  SCORE: FAILED ❌');
  }
  console.log('═══════════════════════════════════════════════════════\n');
  process.exit(fail === 0 ? 0 : 1);
};

run();
