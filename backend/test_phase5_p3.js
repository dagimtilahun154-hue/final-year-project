'use strict';
/**
 * Automated Verification Suite for Phase 5 Priority 3
 * Tests:
 * 1. Global Multi-Entity Search (GET /api/search?q=)
 * 2. Attendance Summary Aggregation (GET /api/attendance/summary)
 * 3. Dedicated Meal Plan Endpoint (GET /api/announcements/meal-plan)
 */
require('dotenv').config();
const http = require('http');
const API = 'http://localhost:5000';

let adminToken = null;
let parentToken = null;
let careToken = null;
let testChildId = null;

const req = (method, path, body = null, token = null) => new Promise(resolve => {
  const url = new URL(path, API);
  const opts = {
    method,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  const r = http.request(opts, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        resolve({ status: res.statusCode, body: JSON.parse(d || '{}') });
      } catch (e) {
        resolve({ status: res.statusCode, body: { text: d } });
      }
    });
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
  console.log('  ANKELBA PHASE 5 (P3) — PRIORITY 3 FEATURES TEST SUITE');
  console.log('═══════════════════════════════════════════════════════\n');

  // [0] Setup & Auth
  console.log('[0] Setup & Authentication');
  let r = await req('POST', '/api/auth/login', { email: 'admin@ankelba.dev', password: 'Admin@123!' });
  adminToken = r.body?.token;
  if (adminToken) ok('Admin logged in'); else { bad('Admin login failed', r.status); process.exit(1); }

  r = await req('POST', '/api/auth/login', { email: 'caregiver@ankelba.dev', password: 'Care@123!' });
  careToken = r.body?.token;
  if (careToken) ok('Caregiver logged in'); else bad('Caregiver login failed', r.status);

  r = await req('POST', '/api/auth/login', { email: 'parent@ankelba.dev', password: 'Parent@123!' });
  parentToken = r.body?.token;
  if (parentToken) ok('Parent logged in'); else bad('Parent login failed', r.status);

  // Look up parent's linked child
  r = await req('GET', '/api/users/profile/me', null, parentToken);
  testChildId = r.body?.linked_children?.[0]?.id;
  if (testChildId) ok(`Found parent linked child (ID: ${testChildId})`); else bad('No linked child found for parent', JSON.stringify(r.body));

  // ── 1. Global Multi-Entity Search (GET /api/search?q=) ────────────────────
  console.log('\n[1] Global Search (GET /api/search?q=)');

  // Admin search for 'admin' -> finds users
  r = await req('GET', '/api/search?q=admin', null, adminToken);
  if (r.status === 200 && r.body.results?.users?.length > 0) {
    ok(`Admin search returned ${r.body.results.users.length} users`);
  } else bad('Admin search for "admin" failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Parent search for 'admin' -> users array MUST be empty (security scoping)
  r = await req('GET', '/api/search?q=admin', null, parentToken);
  if (r.status === 200 && r.body.results?.users?.length === 0) {
    ok('Parent search securely returned 0 users (user directory restricted to admin)');
  } else bad('Parent search leaked user records!', `${r.status}`);

  // Short query rejected (< 2 chars) -> 422
  r = await req('GET', '/api/search?q=a', null, adminToken);
  r.status === 422 ? ok('Single-character search query rejected → 422') : bad('Short query accepted!', r.status);

  // Unauthenticated blocked -> 401
  r = await req('GET', '/api/search?q=test');
  r.status === 401 ? ok('Unauthenticated search blocked → 401') : bad('Unauthenticated search allowed!', r.status);

  // Search for store products
  r = await req('GET', '/api/search?q=item', null, parentToken);
  if (r.status === 200 && Array.isArray(r.body.results?.products)) {
    ok(`Product search returned ${r.body.results.products.length} products`);
  } else bad('Product search failed', `${r.status}`);

  // ── 2. Attendance Summary Aggregation (GET /api/attendance/summary) ───────
  console.log('\n[2] Attendance Summary Aggregation (FR-ATT-04)');

  // Admin center-wide summary
  r = await req('GET', '/api/attendance/summary', null, adminToken);
  if (r.status === 200 && r.body.center_summary?.total_active_children !== undefined) {
    ok(`Center-wide summary: ${r.body.center_summary.total_active_children} active children, ${r.body.center_summary.overall_attendance_rate_percent}% overall attendance rate`);
  } else bad('Center-wide attendance summary failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Parent forbidden from center-wide summary -> 403
  r = await req('GET', '/api/attendance/summary', null, parentToken);
  r.status === 403 ? ok('Parent forbidden from center-wide summary → 403') : bad('Parent accessed center summary!', r.status);

  // Parent gets own child summary
  r = await req('GET', `/api/attendance/summary?child_id=${testChildId}`, null, parentToken);
  if (r.status === 200 && r.body.attendance_rate_percent !== undefined && r.body.child_id === testChildId) {
    ok(`Child attendance summary: ${r.body.child_name}, ${r.body.attendance_rate_percent}% rate, ${r.body.present_days} present days`);
  } else bad('Child attendance summary failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Parent forbidden from unlinked child summary -> 403
  r = await req('GET', `/api/attendance/summary?child_id=99999`, null, parentToken);
  (r.status === 403 || r.status === 404) ? ok('Non-existent or unlinked child summary blocked → 403/404') : bad('Unlinked child summary allowed!', r.status);

  // ── 3. Dedicated Meal Plan Endpoint (GET /api/announcements/meal-plan) ────
  console.log('\n[3] Dedicated Meal Plan Endpoint (FR-COM-02)');

  // Admin creates a meal plan announcement
  const mealPlanTitle = 'Weekly Nutrition Plan ' + Date.now();
  r = await req('POST', '/api/announcements', {
    title: mealPlanTitle,
    body: 'Monday: Oatmeal & Fruit; Tuesday: Lentil Soup with Injera; Wednesday: Veggie Rice',
    announcement_type: 'meal_plan',
    audience: 'all',
  }, adminToken);
  if (r.status === 201) {
    ok(`Meal plan announcement created: "${mealPlanTitle}" → 201`);
  } else bad('Create meal plan failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Parent retrieves meal plans via dedicated endpoint
  r = await req('GET', '/api/announcements/meal-plan', null, parentToken);
  const foundMealPlan = r.body?.data?.find(m => m.title === mealPlanTitle);
  if (r.status === 200 && foundMealPlan) {
    ok(`Parent retrieved meal plans via /announcements/meal-plan (${r.body.data.length} meal plans found)`);
  } else bad('Parent meal plan lookup failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // ── Results Summary ──────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  TOTAL: ${pass + fail}   PASS: ${pass}   FAIL: ${fail}`);
  if (fail === 0) {
    console.log('  SCORE: 100% — PHASE 5 PRIORITY 3 COMPLETE! 🎉');
  } else {
    console.log(`  SCORE: ${Math.round((pass / (pass + fail)) * 100)}% — ${fail} FAILURES ❌`);
  }
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(fail > 0 ? 1 : 0);
};

run().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
