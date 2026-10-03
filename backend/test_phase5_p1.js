'use strict';
/**
 * Automated Verification Suite for Phase 5 Priority 1
 * Tests: Password Reset Flow, Groups CRUD, Admin Dashboard Stats, Emergency Contact & Care Instruction CRUD
 */
require('dotenv').config();
const http = require('http');
const API = 'http://localhost:5000';

let adminToken = null;
let testChildId = null;
let testContactId = null;
let testInstructionId = null;
let testGroupId = null;
let resetToken = null;
let freshParentToken = null;

const req = (method, path, body = null, token = null) => new Promise(resolve => {
  const url = new URL(path, API);
  const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  const r = http.request(opts, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d || '{}') }); } catch(e) { resolve({ status: res.statusCode, body: { text: d } }); } });
  });
  r.on('error', e => resolve({ status: 0, error: e.message }));
  if (body) r.write(JSON.stringify(body));
  r.end();
});

let pass = 0, fail = 0;
const ok  = (msg)      => { pass++; console.log(`  ✅ [PASS] ${msg}`); };
const bad = (msg, err) => { fail++; console.error(`  ❌ [FAIL] ${msg} — ${err}`); };

const run = async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ANKELBA PHASE 5 (P1) — PRIORITY 1 FEATURES TEST SUITE');
  console.log('═══════════════════════════════════════════════════════\n');

  // Setup
  console.log('[0] Setup');
  let r = await req('POST', '/api/auth/login', { email: 'admin@ankelba.dev', password: 'Admin@123!' });
  adminToken = r.body?.token;
  if (adminToken) ok(`Admin logged in`); else { bad('Admin login failed', JSON.stringify(r.body)); process.exit(1); }

  r = await req('GET', '/api/children', null, adminToken);
  testChildId = r.body?.data?.[0]?.id;
  if (testChildId) ok(`Found test child (ID: ${testChildId})`); else bad('Child lookup failed', r.status);

  // ── 1. Password Reset Flow ──────────────────────────────────────────────
  console.log('\n[1] Password Reset Flow (FR-UAM-07, NFR-SEC-03)');

  // Forgot password — issues token
  r = await req('POST', '/api/auth/forgot-password', { email: 'parent@ankelba.dev' });
  resetToken = r.body?.reset_token;
  if (r.status === 200 && resetToken) {
    ok('Forgot password issued reset token → 200 OK');
  } else bad('Forgot password failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Fake email — still returns 200 (no enumeration)
  r = await req('POST', '/api/auth/forgot-password', { email: 'notexist@fake.dev' });
  r.status === 200 ? ok('Non-existent email returns same 200 (no email enumeration)') : bad('Email enumeration risk!', r.status);

  // Reset password using token
  r = await req('POST', '/api/auth/reset-password', { token: resetToken, new_password: 'Parent@456!' });
  r.status === 200 && r.body.message ? ok('Password reset with token → 200 OK') : bad('Reset password failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Verify new password works
  r = await req('POST', '/api/auth/login', { email: 'parent@ankelba.dev', password: 'Parent@456!' });
  const newParentToken = r.body?.token;
  newParentToken ? ok('New password login verified → 200 OK') : bad('New password login failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Reuse expired token → 400
  r = await req('POST', '/api/auth/reset-password', { token: resetToken, new_password: 'Should@Fail1' });
  r.status === 400 ? ok('Reused reset token rejected → 400') : bad('Token reuse not blocked!', `${r.status} — ${JSON.stringify(r.body)}`);

  // Change password (authenticated)
  r = await req('PATCH', '/api/auth/change-password', { current_password: 'Parent@456!', new_password: 'Parent@123!' }, newParentToken);
  r.status === 200 ? ok('Change password (authenticated) → 200 OK') : bad('Change password failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Wrong current password → 401 (login again since password was reset to Parent@123!)
  freshParentToken = (await req('POST', '/api/auth/login', { email: 'parent@ankelba.dev', password: 'Parent@123!' })).body?.token;
  r = await req('PATCH', '/api/auth/change-password', { current_password: 'WrongPass!', new_password: 'Other@123!' }, freshParentToken);
  r.status === 401 ? ok('Wrong current password rejected → 401') : bad('Wrong password accepted!', r.status);

  // ── 2. Groups CRUD ─────────────────────────────────────────────────────
  console.log('\n[2] Groups Management API (FR-CH-05)');

  // List groups
  r = await req('GET', '/api/groups', null, adminToken);
  if (r.status === 200 && Array.isArray(r.body.data)) {
    ok(`Listed groups (${r.body.data.length} groups with active_children_count)`);
  } else bad('GET /api/groups failed', `${r.status}`);

  // Create group
  r = await req('POST', '/api/groups', { name: 'Test Group Phase5', description: 'Auto-created by test' }, adminToken);
  testGroupId = r.body?.id;
  testGroupId && r.status === 201 ? ok(`Created group (ID: ${testGroupId}) → 201`) : bad('Group creation failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Duplicate group name → 409
  r = await req('POST', '/api/groups', { name: 'Test Group Phase5' }, adminToken);
  r.status === 409 ? ok('Duplicate group name → 409 Conflict') : bad('Duplicate not blocked!', r.status);

  // Update group
  r = await req('PATCH', `/api/groups/${testGroupId}`, { description: 'Updated description' }, adminToken);
  r.status === 200 && r.body.description === 'Updated description' ? ok('Group updated → 200 OK') : bad('Group update failed', `${r.status}`);

  // Delete empty group
  r = await req('DELETE', `/api/groups/${testGroupId}`, null, adminToken);
  r.status === 200 && r.body.message ? ok('Empty group deleted → 200 OK') : bad('Group delete failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // ── 3. Admin Dashboard Stats ────────────────────────────────────────────
  console.log('\n[3] Admin Dashboard Stats (GET /api/dashboard)');
  r = await req('GET', '/api/dashboard', null, adminToken);
  const d = r.body;
  if (r.status === 200 &&
      d.enrollment && d.attendance_today && d.reports_today &&
      d.health && d.orders && d.messages) {
    ok(`Dashboard stats returned: ${d.enrollment.active} active children, ${d.attendance_today.checked_in} checked in today`);
  } else bad('GET /api/dashboard failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Non-admin blocked
  r = await req('GET', '/api/dashboard', null, freshParentToken);
  r.status === 403 ? ok('Parent blocked from dashboard stats → 403') : bad('Parent accessed dashboard!', r.status);

  // ── 4. Emergency Contact CRUD ───────────────────────────────────────────
  console.log('\n[4] Emergency Contact CRUD (FR-CH-03)');

  // Add contact
  r = await req('POST', `/api/children/${testChildId}/contacts`, { name: 'Test Uncle', relationship: 'Uncle', phone: '+251912345678' }, adminToken);
  testContactId = r.body?.id;
  testContactId && r.status === 201 ? ok(`Emergency contact added (ID: ${testContactId}) → 201`) : bad('Add contact failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Update contact
  r = await req('PATCH', `/api/children/contacts/${testContactId}`, { phone: '+251987654321' }, adminToken);
  r.status === 200 && r.body.phone === '+251987654321' ? ok('Contact phone updated → 200 OK') : bad('Contact update failed', `${r.status}`);

  // Delete contact
  r = await req('DELETE', `/api/children/contacts/${testContactId}`, null, adminToken);
  r.status === 200 && r.body.message ? ok('Emergency contact deleted → 200 OK') : bad('Contact delete failed', `${r.status}`);

  // ── 5. Care Instruction CRUD ────────────────────────────────────────────
  console.log('\n[5] Care Instruction CRUD (FR-CH-03)');

  // Add instruction
  r = await req('POST', `/api/children/${testChildId}/instructions`, { category: 'general', instruction_text: 'Needs nap after lunch' }, adminToken);
  testInstructionId = r.body?.id;
  testInstructionId && r.status === 201 ? ok(`Care instruction added (ID: ${testInstructionId}) → 201`) : bad('Add instruction failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Update instruction
  r = await req('PATCH', `/api/children/instructions/${testInstructionId}`, { instruction_text: 'Needs 30-min nap after lunch' }, adminToken);
  r.status === 200 && r.body.instruction_text === 'Needs 30-min nap after lunch' ? ok('Instruction updated → 200 OK') : bad('Instruction update failed', `${r.status}`);

  // Delete instruction
  r = await req('DELETE', `/api/children/instructions/${testInstructionId}`, null, adminToken);
  r.status === 200 && r.body.message ? ok('Care instruction deleted → 200 OK') : bad('Instruction delete failed', `${r.status}`);

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  TOTAL: ${pass + fail}   PASS: ${pass}   FAIL: ${fail}`);
  if (fail === 0) {
    console.log('  SCORE: 100% — PHASE 5 PRIORITY 1 COMPLETE! 🎉');
  } else {
    console.log(`  SCORE: ${Math.round((pass / (pass + fail)) * 100)}% — ${fail} FAILURES ❌`);
  }
  console.log('═══════════════════════════════════════════════════════\n');
  process.exit(fail === 0 ? 0 : 1);
};

run();
