'use strict';
/**
 * Automated Verification Suite for Phase 4 — Payments, Biometric Verification, and Audit Trail
 */
require('dotenv').config();
const http = require('http');

const API = 'http://localhost:5000';

let adminToken = null;
let adminUserId = null;
let caregiverToken = null;
let parentToken = null;
let parentUserId = null;
let testChildId = null;
let testGuardianLinkId = null;
let testOrderId = null;

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
  console.log('  ANKELBA PHASE 4 TEST SUITE — PAYMENTS, BIOMETRIC & AUDIT');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Setup & Authentication
  console.log('[1] Setup & Authentication');
  let r = await req('POST', '/api/auth/login', { email: 'admin@ankelba.dev', password: 'Admin@123!' });
  adminToken = r.body?.token;
  adminUserId = r.body?.user?.id;
  if (adminToken) ok(`Admin logged in (ID: ${adminUserId})`); else bad('Admin login failed', JSON.stringify(r.body));

  r = await req('POST', '/api/auth/login', { email: 'caregiver@ankelba.dev', password: 'Care@123!' });
  caregiverToken = r.body?.token;
  if (caregiverToken) ok('Caregiver logged in'); else bad('Caregiver login failed', JSON.stringify(r.body));

  r = await req('POST', '/api/auth/login', { email: 'parent@ankelba.dev', password: 'Parent@123!' });
  parentToken = r.body?.token;
  parentUserId = r.body?.user?.id;
  if (parentToken) ok(`Linked Parent logged in (ID: ${parentUserId})`); else bad('Parent login failed', JSON.stringify(r.body));

  r = await req('GET', '/api/children', null, caregiverToken);
  if (r.status === 200 && r.body.data?.length > 0) {
    testChildId = r.body.data[0].id;
    ok(`Found test child (ID: ${testChildId})`);
  } else bad('Child search failed', `${r.status}`);

  // Get guardian link ID for test child and parent
  r = await req('GET', `/api/children/${testChildId}/guardians`, null, adminToken);
  if (r.status === 200 && Array.isArray(r.body.data) && r.body.data.length > 0) {
    testGuardianLinkId = r.body.data[0].guardian_link_id;
    ok(`Found guardian link (ID: ${testGuardianLinkId})`);
  } else bad('Guardian link search failed', `${r.status}`);

  // Create store product & place order for payments testing
  r = await req('POST', '/api/store/products', {
    name: 'Daycare Blanket 4B',
    price: 450.00,
    stock_qty: 20,
    available: true
  }, adminToken);
  const testProdId = r.body?.id;

  r = await req('POST', '/api/store/orders', {
    items: [{ product_id: testProdId, quantity: 1 }]
  }, parentToken);
  testOrderId = r.body?.id;
  if (testOrderId) ok(`Created order for payment test (ID: ${testOrderId})`); else bad('Order creation failed', JSON.stringify(r.body));

  // 2. Payments Module (POST /api/payments/initiate, POST /api/payments/webhook, GET /api/payments/order/:id)
  console.log('\n[2] Payments Module (FR-ECM-07–10, TBD-02)');
  // Initiate Pay at Daycare
  r = await req('POST', '/api/payments/initiate', {
    order_id: testOrderId,
    method: 'pay_at_daycare'
  }, parentToken);
  if (r.status === 200 && r.body.method === 'pay_at_daycare' && r.body.status === 'pending') {
    ok('Initiated Pay at Daycare payment → 200 OK');
  } else bad('Pay at Daycare initiation failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Initiate Digital Payment
  r = await req('POST', '/api/payments/initiate', {
    order_id: testOrderId,
    method: 'digital'
  }, parentToken);
  let digitalGatewayRef = r.body?.gateway_ref;
  if (r.status === 200 && digitalGatewayRef && r.body.checkout_url) {
    ok(`Initiated Digital Chapa Payment (Ref: ${digitalGatewayRef})`);
  } else bad('Digital payment initiation failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Webhook verification callback
  r = await req('POST', '/api/payments/webhook', {
    tx_ref: digitalGatewayRef,
    status: 'success'
  });
  if (r.status === 200 && r.body.payment_status === 'paid') {
    ok('Webhook backend payment verification updated order to paid/confirmed → 200 OK (FR-ECM-09)');
  } else bad('Payment webhook failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Get Payment details by Order ID
  r = await req('GET', `/api/payments/order/${testOrderId}`, null, parentToken);
  if (r.status === 200 && r.body.status === 'paid') {
    ok('Parent fetched verified payment record by order ID');
  } else bad('Get payment by order failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // 3. Biometric Verification Module (POST /api/biometric/enroll, POST /api/biometric/verify)
  console.log('\n[3] Biometric Guardian Verification (FR-BIO-01–10)');
  r = await req('POST', '/api/biometric/enroll', {
    guardian_link_id: testGuardianLinkId,
    reference_data: 'FINGERPRINT_TEMPLATE_HASH_V1_MOCK'
  }, adminToken);
  if (r.status === 201 && r.body.id) {
    ok(`Admin enrolled biometric reference for guardian link ${testGuardianLinkId} (FR-BIO-01, FR-BIO-02)`);
  } else bad('Biometric enrollment failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Biometric Pickup Verification
  r = await req('POST', '/api/biometric/verify', {
    child_id: testChildId,
    guardian_user_id: parentUserId,
    method: 'biometric'
  }, caregiverToken);
  if (r.status === 200 && r.body.verified === true && r.body.result === 'success') {
    ok('Caregiver verified biometric pickup for child → 200 OK (FR-BIO-04, FR-BIO-05)');
  } else bad('Biometric verification failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Manual Pickup Verification Fallback
  r = await req('POST', '/api/biometric/verify', {
    child_id: testChildId,
    guardian_user_id: parentUserId,
    method: 'manual'
  }, caregiverToken);
  if (r.status === 200 && r.body.verified === true && r.body.result === 'manual_fallback') {
    ok('Caregiver completed manual fallback guardian verification → 200 OK (FR-BIO-08)');
  } else bad('Manual verification fallback failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Unauthorized guardian verification attempt -> 403
  const fakeGuardianId = 999999;
  r = await req('POST', '/api/biometric/verify', {
    child_id: testChildId,
    guardian_user_id: fakeGuardianId,
    method: 'manual'
  }, caregiverToken);
  r.status === 403 ? ok('Unlinked guardian pickup attempt blocked → 403 Forbidden') : bad('Unlinked guardian verified!', r.status);

  // 4. Audit Trail Module (GET /api/audit)
  console.log('\n[4] Security & Accountability Audit Trail (FR-AUD-01–05)');
  r = await req('GET', '/api/audit', null, adminToken);
  if (r.status === 200 && Array.isArray(r.body.data) && r.body.data.length >= 1) {
    ok(`Admin fetched security audit log trail (${r.body.data.length} records logged)`);
  } else bad('GET /api/audit failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Non-admin audit log access attempt -> 403
  r = await req('GET', '/api/audit', null, parentToken);
  r.status === 403 ? ok('Parent forbidden to view audit logs → 403 (FR-AUD-05)') : bad('Parent accessed audit logs!', r.status);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  TOTAL: ${pass + fail}   PASS: ${pass}   FAIL: ${fail}`);
  if (fail === 0) {
    console.log('  SCORE: 100% — PHASE 4 IMPLEMENTATION COMPLETE! 🎉');
  } else {
    console.log('  SCORE: FAILED ❌');
  }
  console.log('═══════════════════════════════════════════════════════\n');
  process.exit(fail === 0 ? 0 : 1);
};

run();
