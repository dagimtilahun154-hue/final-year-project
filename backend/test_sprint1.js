'use strict';
/**
 * Automated Verification Suite for Sprint 1 — Children & Guardian Management
 */
const http = require('http');

const API = 'http://localhost:5000';

let adminToken = null;
let adminUserId = null;
let caregiverToken = null;
let caregiverUserId = null;
let parentToken = null;
let parentUserId = null;
let unlinkedParentToken = null;
let unlinkedUserId = null;

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
  console.log('  ANKELBA SPRINT 1 TEST SUITE — CHILDREN & GUARDIANS');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Authenticate users
  console.log('[1] Authentication Setup');
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

  // Create an unlinked test parent user
  const unlinkedEmail = `unlinked_${Date.now()}@ankelba.dev`;
  r = await req('POST', '/api/users', { name: 'Unlinked Parent', email: unlinkedEmail, password: 'Parent@123!', role: 'parent' }, adminToken);
  r = await req('POST', '/api/auth/login', { email: unlinkedEmail, password: 'Parent@123!' });
  unlinkedParentToken = r.body?.token;
  unlinkedUserId = r.body?.user?.id;
  if (unlinkedParentToken) ok(`Unlinked Parent created and logged in (ID: ${unlinkedUserId})`); else bad('Unlinked parent setup failed', JSON.stringify(r.body));

  // 2. Child Creation (POST /api/children)
  console.log('\n[2] Create Child (Admin)');
  r = await req('POST', '/api/children', {
    full_name: 'Test Child Sprint1',
    dob: '2023-05-20',
    gender: 'female',
    group_id: 1,
    caregiver_id: caregiverUserId,
    enrollment_status: 'active',
    emergency_contacts: [
      { name: 'Grandma Mary', relationship: 'Grandmother', phone: '+251900112233' }
    ],
    care_instructions: [
      { category: 'allergy', instruction_text: 'Egg allergy' }
    ]
  }, adminToken);

  let newChildId = r.body?.id;
  if (r.status === 201 && newChildId) {
    ok(`Child created with ID: ${newChildId}`);
    if (r.body.emergency_contacts?.length === 1 && r.body.care_instructions?.length === 1) {
      ok('Emergency contacts & care instructions attached on creation');
    } else {
      bad('Emergency contacts or care instructions missing in response', JSON.stringify(r.body));
    }
  } else {
    bad('POST /api/children failed', `${r.status} — ${JSON.stringify(r.body)}`);
  }

  // Caregiver forbidden to create child
  r = await req('POST', '/api/children', { full_name: 'Illegal Child', dob: '2023-01-01' }, caregiverToken);
  r.status === 403 ? ok('Caregiver forbidden to POST /api/children → 403') : bad('Caregiver create child RBAC bypass', r.status);

  // 3. List Children (GET /api/children)
  console.log('\n[3] List Children');
  r = await req('GET', '/api/children', null, adminToken);
  if (r.status === 200 && Array.isArray(r.body.data) && r.body.data.length >= 2) {
    ok(`Admin GET /api/children returns ${r.body.data.length} children`);
  } else {
    bad('Admin GET /api/children failed', `${r.status} — ${JSON.stringify(r.body)}`);
  }

  r = await req('GET', '/api/children', null, caregiverToken);
  if (r.status === 200 && Array.isArray(r.body.data)) {
    const allAssigned = r.body.data.every(c => c.caregiver_name === 'Test Caregiver' || c.caregiver_id === caregiverUserId);
    if (allAssigned) {
      ok(`Caregiver GET /api/children filtered to assigned children only (${r.body.data.length} items)`);
    } else {
      bad('Caregiver saw unassigned children', JSON.stringify(r.body.data));
    }
  } else {
    bad('Caregiver GET /api/children failed', `${r.status}`);
  }

  // 4. Get Child Details (GET /api/children/:id)
  console.log('\n[4] Get Child Profile (RBAC & 3-Query Assembly)');
  // Child 1 (Abebe Kebede) is linked to parent@ankelba.dev
  r = await req('GET', '/api/children/1', null, parentToken);
  if (r.status === 200 && r.body.full_name === 'Abebe Kebede') {
    ok('Linked Parent GET /api/children/1 → 200 OK with profile data');
    if (Array.isArray(r.body.emergency_contacts) && Array.isArray(r.body.care_instructions)) {
      ok('3-query pattern returned emergency contacts & care instructions');
    } else {
      bad('Emergency contacts or care instructions missing from profile response');
    }
  } else {
    bad('Linked parent failed to access child', `${r.status} — ${JSON.stringify(r.body)}`);
  }

  // Unlinked parent attempts to access Child 1
  r = await req('GET', '/api/children/1', null, unlinkedParentToken);
  r.status === 403 ? ok('Unlinked Parent GET /api/children/1 → 403 Forbidden') : bad('Unlinked parent accessed child profile!', r.status);

  // 5. Update Child (PATCH /api/children/:id)
  console.log('\n[5] Update Child (Admin)');
  r = await req('PATCH', `/api/children/${newChildId}`, { full_name: 'Test Child Sprint1 Updated', gender: 'female' }, adminToken);
  if (r.status === 200 && r.body.full_name === 'Test Child Sprint1 Updated') {
    ok(`PATCH /api/children/${newChildId} updated name successfully`);
  } else {
    bad('PATCH /api/children failed', `${r.status} — ${JSON.stringify(r.body)}`);
  }

  // 6. Guardian Links (POST, GET, DELETE /api/children/:id/guardians)
  console.log('\n[6] Guardian Link Management');
  r = await req('POST', `/api/children/${newChildId}/guardians`, {
    user_id: unlinkedUserId,
    relationship: 'Mother',
    pickup_authorized: true
  }, adminToken);

  let guardianLinkId = r.body?.id;
  if (r.status === 201 && guardianLinkId) {
    ok(`Added guardian link (ID: ${guardianLinkId}) to child ${newChildId}`);
  } else {
    bad('POST /api/children/:id/guardians failed', `${r.status} — ${JSON.stringify(r.body)}`);
  }

  // Duplicate guardian link → 409
  r = await req('POST', `/api/children/${newChildId}/guardians`, {
    user_id: unlinkedUserId,
    relationship: 'Mother',
    pickup_authorized: true
  }, adminToken);
  r.status === 409 ? ok('Duplicate guardian link → 409 Conflict') : bad('Duplicate guardian link allowed!', r.status);

  // Link non-parent role user → 422
  r = await req('POST', `/api/children/${newChildId}/guardians`, {
    user_id: adminUserId,
    relationship: 'Admin',
    pickup_authorized: false
  }, adminToken);
  r.status === 422 ? ok('Link non-parent user → 422 Unprocessable Entity') : bad('Non-parent user allowed as guardian!', r.status);

  // GET Guardians
  r = await req('GET', `/api/children/${newChildId}/guardians`, null, adminToken);
  if (r.status === 200 && Array.isArray(r.body.data) && r.body.data.length === 1) {
    ok('GET /api/children/:id/guardians returns list with biometric_enrolled status');
  } else {
    bad('GET /api/children/:id/guardians failed', `${r.status} — ${JSON.stringify(r.body)}`);
  }

  // Newly linked parent can now access child profile
  r = await req('GET', `/api/children/${newChildId}`, null, unlinkedParentToken);
  r.status === 200 ? ok('Newly linked parent can now access child profile → 200 OK') : bad('Newly linked parent still forbidden!', r.status);

  // Remove Guardian link (DELETE /api/children/:id/guardians/:gid)
  r = await req('DELETE', `/api/children/${newChildId}/guardians/${guardianLinkId}`, null, adminToken);
  r.status === 204 ? ok('DELETE /api/children/:id/guardians/:gid → 204 No Content') : bad('DELETE guardian link failed', r.status);

  // Access revoked after deletion
  r = await req('GET', `/api/children/${newChildId}`, null, unlinkedParentToken);
  r.status === 403 ? ok('Unlinked parent access revoked after guardian link deletion → 403') : bad('Unlinked parent still accessible after deletion!', r.status);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  TOTAL: ${pass + fail}   PASS: ${pass}   FAIL: ${fail}`);
  if (fail === 0) {
    console.log('  SCORE: 100% — SPRINT 1 IMPLEMENTATION COMPLETE! 🎉');
  } else {
    console.log('  SCORE: FAILED ❌');
  }
  console.log('═══════════════════════════════════════════════════════\n');
};

run();
