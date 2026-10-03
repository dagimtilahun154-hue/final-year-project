'use strict';
/**
 * Automated Verification Suite for Phase 5 Priority 2
 * Tests:
 * 1. Notifications Inbox Aggregator (GET /api/notifications)
 * 2. Product Categories Management (CRUD /api/store/categories)
 * 3. Low-Stock Automatic Alert Engine
 * 4. User Self-Service Profile (GET & PATCH /api/users/profile/me)
 */
require('dotenv').config();
const http = require('http');
const API = 'http://localhost:5000';

let adminToken = null;
let parentToken = null;
let careToken = null;
let testCategoryId = null;
let lowStockProductId = null;

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
  console.log('  ANKELBA PHASE 5 (P2) — PRIORITY 2 FEATURES TEST SUITE');
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

  // ── 1. Notifications Inbox (GET /api/notifications) ──────────────────────
  console.log('\n[1] Notifications Inbox Aggregation (GET /api/notifications)');

  // Admin view
  r = await req('GET', '/api/notifications', null, adminToken);
  if (r.status === 200 && typeof r.body.total_badges === 'number' && r.body.unread_messages && r.body.alerts) {
    ok(`Admin notifications fetched: ${r.body.total_badges} total badges, ${r.body.alerts.count} alerts`);
  } else bad('Admin notifications failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Parent view
  r = await req('GET', '/api/notifications', null, parentToken);
  if (r.status === 200 && r.body.unpaid_orders !== undefined) {
    ok(`Parent notifications fetched: ${r.body.unpaid_orders.count} unpaid orders`);
  } else bad('Parent notifications failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Caregiver view
  r = await req('GET', '/api/notifications', null, careToken);
  if (r.status === 200 && r.body.unnotified_health_records !== undefined) {
    ok(`Caregiver notifications fetched: ${r.body.unnotified_health_records.count} unnotified health records`);
  } else bad('Caregiver notifications failed', `${r.status}`);

  // Unauthenticated blocked
  r = await req('GET', '/api/notifications');
  r.status === 401 ? ok('Unauthenticated notifications call blocked → 401') : bad('Unauthenticated call allowed!', r.status);

  // ── 2. Product Categories API (/api/store/categories) ─────────────────────
  console.log('\n[2] Product Categories API (FR-ECM-01)');

  // List categories
  r = await req('GET', '/api/store/categories', null, parentToken);
  if (r.status === 200 && Array.isArray(r.body.data)) {
    ok(`Listed categories (${r.body.data.length} categories found)`);
  } else bad('GET /api/store/categories failed', `${r.status}`);

  // Create category (Admin)
  const catName = 'Test Cat ' + Date.now();
  r = await req('POST', '/api/store/categories', { name: catName }, adminToken);
  testCategoryId = r.body?.id;
  testCategoryId && r.status === 201 ? ok(`Created category "${catName}" (ID: ${testCategoryId}) → 201`) : bad('Create category failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Duplicate category name → 409
  r = await req('POST', '/api/store/categories', { name: catName }, adminToken);
  r.status === 409 ? ok('Duplicate category name rejected → 409 Conflict') : bad('Duplicate category allowed!', r.status);

  // Non-admin blocked from creating category → 403
  r = await req('POST', '/api/store/categories', { name: 'Forbidden Cat' }, parentToken);
  r.status === 403 ? ok('Parent blocked from creating category → 403 Forbidden') : bad('Parent allowed to create category!', r.status);

  // Update category
  const updatedCatName = catName + ' Renamed';
  r = await req('PATCH', `/api/store/categories/${testCategoryId}`, { name: updatedCatName }, adminToken);
  r.status === 200 && r.body.name === updatedCatName ? ok('Category updated/renamed → 200 OK') : bad('Update category failed', `${r.status}`);

  // Delete category
  r = await req('DELETE', `/api/store/categories/${testCategoryId}`, null, adminToken);
  r.status === 200 && r.body.message ? ok('Category deleted successfully → 200 OK') : bad('Delete category failed', `${r.status}`);

  // ── 3. Low-Stock Automatic Alert Engine (FR-ECM-06) ───────────────────────
  console.log('\n[3] Low-Stock Auto-Alert Engine (FR-ECM-06)');

  // Create a test product with stock_qty = 6
  r = await req('POST', '/api/store/products', {
    name: 'Stock Alert Test Item ' + Date.now(),
    price: 15.00,
    stock_qty: 6,
    available: true,
  }, adminToken);
  lowStockProductId = r.body?.id;
  if (lowStockProductId && r.status === 201) {
    ok(`Test product created with stock = 6 (ID: ${lowStockProductId})`);
  } else bad('Create product for stock test failed', `${r.status}`);

  // Parent orders quantity = 2 (bringing stock to 4, which is <= 5)
  r = await req('POST', '/api/store/orders', {
    items: [{ product_id: lowStockProductId, quantity: 2 }]
  }, parentToken);
  r.status === 201 ? ok('Order placed, stock reduced from 6 to 4 (<= 5)') : bad('Order placement failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Check that an alert was generated in alerts
  r = await req('GET', '/api/alerts', null, adminToken);
  const foundAlert = r.body?.data?.find(a => a.title.includes('Low stock alert') && a.title.includes('Stock Alert Test Item'));
  foundAlert ? ok(`Low stock alert auto-generated: "${foundAlert.title}"`) : bad('Low stock alert was not created!', JSON.stringify(r.body));

  // ── 4. User Self-Service Profile (GET & PATCH /api/users/profile/me) ──────
  console.log('\n[4] User Self-Service Profile (FR-UAM-02)');

  // Parent gets own profile
  r = await req('GET', '/api/users/profile/me', null, parentToken);
  if (r.status === 200 && r.body.email === 'parent@ankelba.dev' && Array.isArray(r.body.linked_children)) {
    ok(`Parent profile fetched with ${r.body.linked_children.length} linked children`);
  } else bad('Parent GET /profile/me failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Caregiver gets own profile
  r = await req('GET', '/api/users/profile/me', null, careToken);
  if (r.status === 200 && r.body.email === 'caregiver@ankelba.dev' && Array.isArray(r.body.assigned_children)) {
    ok(`Caregiver profile fetched with ${r.body.assigned_children.length} assigned children`);
  } else bad('Caregiver GET /profile/me failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Parent updates own name
  const updatedName = 'Updated Parent Name ' + Date.now();
  r = await req('PATCH', '/api/users/profile/me', { name: updatedName }, parentToken);
  r.status === 200 && r.body.name === updatedName ? ok('Parent updated own name → 200 OK') : bad('Parent update name failed', `${r.status}`);

  // Restore original parent name
  r = await req('PATCH', '/api/users/profile/me', { name: 'Parent User' }, parentToken);
  r.status === 200 ? ok('Parent name restored → 200 OK') : bad('Restore parent name failed', `${r.status}`);

  // Duplicate email on profile update rejected → 409
  r = await req('PATCH', '/api/users/profile/me', { email: 'admin@ankelba.dev' }, parentToken);
  r.status === 409 ? ok('Duplicate email update rejected → 409 Conflict') : bad('Duplicate email was allowed!', r.status);

  // ── Results Summary ──────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  TOTAL: ${pass + fail}   PASS: ${pass}   FAIL: ${fail}`);
  if (fail === 0) {
    console.log('  SCORE: 100% — PHASE 5 PRIORITY 2 COMPLETE! 🎉');
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
