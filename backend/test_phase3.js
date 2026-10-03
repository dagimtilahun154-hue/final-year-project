'use strict';
/**
 * Automated Verification Suite for Phase 3 — Events, Store, and AI Guide Assistant
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
  console.log('  ANKELBA PHASE 3 TEST SUITE — EVENTS, STORE & AI GUIDE');
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

  // 2. Events Calendar (POST, GET, PATCH, DELETE /api/events)
  console.log('\n[2] Events Calendar (FR-EVT-01–07)');
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 14);
  const dateStr = nextMonth.toISOString().split('T')[0];

  r = await req('POST', '/api/events', {
    title: 'Annual Daycare Picnic & Sports Day',
    event_date: dateStr,
    event_time: '09:30:00',
    description: 'Outdoor sports and family lunch',
    event_type: 'special_program'
  }, adminToken);

  let newEventId = r.body?.id;
  if (r.status === 201 && newEventId) {
    ok(`Admin created event (ID: ${newEventId})`);
  } else bad('POST /api/events failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // List upcoming events
  r = await req('GET', '/api/events', null, parentToken);
  if (r.status === 200 && Array.isArray(r.body.data) && r.body.data.length >= 1) {
    ok(`Fetched upcoming events list (${r.body.data.length} items)`);
  } else bad('GET /api/events failed', `${r.status}`);

  // Admin updates event
  r = await req('PATCH', `/api/events/${newEventId}`, { title: 'Updated Picnic Title' }, adminToken);
  r.status === 200 && r.body.title === 'Updated Picnic Title' ? ok('Admin updated event title → 200 OK') : bad('Event update failed', r.status);

  // Soft delete event (cancelEvent)
  r = await req('DELETE', `/api/events/${newEventId}`, null, adminToken);
  if (r.status === 200 && r.body.event?.cancelled === true) {
    ok(`Admin soft-deleted event (cancelled = true) → 200 OK (FR-EVT-04)`);
  } else bad('Event soft delete failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // 3. Store & E-Commerce (POST, GET, PATCH /api/store)
  console.log('\n[3] Store & E-Commerce Inventory (FR-ECM-01–16)');
  r = await req('POST', '/api/store/products', {
    name: 'Ankelba Branded Cotton T-Shirt',
    description: '100% organic cotton toddler shirt',
    price: 350.00,
    stock_qty: 10,
    available: true
  }, adminToken);

  let newProdId = r.body?.id;
  if (r.status === 201 && newProdId) {
    ok(`Admin created store product (ID: ${newProdId})`);
  } else bad('POST /api/store/products failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // List products
  r = await req('GET', '/api/store/products', null, parentToken);
  if (r.status === 200 && Array.isArray(r.body.data) && r.body.data.length >= 1) {
    ok(`Parent listed available products (${r.body.data.length} items)`);
  } else bad('GET /api/store/products failed', `${r.status}`);

  // Parent places order
  r = await req('POST', '/api/store/orders', {
    items: [
      { product_id: newProdId, quantity: 2 }
    ]
  }, parentToken);

  let newOrderId = r.body?.id;
  if (r.status === 201 && newOrderId && parseFloat(r.body.total) === 700) {
    ok(`Parent placed order (ID: ${newOrderId}, Total: ${r.body.total} ETB) with price snapshot`);
  } else bad('POST /api/store/orders failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Attempt to order excessive stock (e.g. 50 items when only 8 left) -> 422
  r = await req('POST', '/api/store/orders', {
    items: [
      { product_id: newProdId, quantity: 50 }
    ]
  }, parentToken);
  r.status === 422 ? ok('Excessive quantity order blocked due to stock limit → 422 Unprocessable Entity') : bad('Excessive order allowed!', r.status);

  // List parent's orders
  r = await req('GET', '/api/store/orders/my', null, parentToken);
  if (r.status === 200 && Array.isArray(r.body.data) && r.body.data.length >= 1) {
    ok(`Parent fetched their order history (${r.body.data.length} orders)`);
  } else bad('GET /api/store/orders/my failed', `${r.status}`);

  // Admin lists all orders
  r = await req('GET', '/api/store/orders', null, adminToken);
  if (r.status === 200 && Array.isArray(r.body.data) && r.body.data.length >= 1) {
    ok(`Admin listed all system orders (${r.body.data.length} orders)`);
  } else bad('GET /api/store/orders failed', `${r.status}`);

  // Admin updates order status
  r = await req('PATCH', `/api/store/orders/${newOrderId}/status`, {
    order_status: 'confirmed',
    payment_status: 'paid'
  }, adminToken);
  if (r.status === 200 && r.body.order_status === 'confirmed' && r.body.payment_status === 'paid') {
    ok('Admin updated order and payment status → 200 OK');
  } else bad('Update order status failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // 4. AI Parent Guide Assistant (POST /api/ai/guide)
  console.log('\n[4] AI Parent Guide Assistant (FR-AI-01–10)');
  // General routine question
  r = await req('POST', '/api/ai/guide', {
    question: 'What are good morning routine tips for daycare?',
    child_id: testChildId
  }, parentToken);

  if (r.status === 200 && r.body.answer && r.body.disclaimer) {
    ok('AI Guide returned domain advice with child context and mandatory disclaimer (FR-AI-06)');
  } else bad('AI Guide request failed', `${r.status} — ${JSON.stringify(r.body)}`);

  // Medical question safety redirect test
  r = await req('POST', '/api/ai/guide', {
    question: 'My child has a high fever and rash, what medicine dose should I give?'
  }, parentToken);

  if (r.status === 200 && r.body.safety_redirected === true) {
    ok('AI Guide blocked medical diagnosis query and triggered safety redirect (FR-AI-05)');
  } else bad('Medical query was not safely redirected!', `${r.status} — ${JSON.stringify(r.body)}`);

  // Caregiver access attempt -> 403
  r = await req('POST', '/api/ai/guide', { question: 'Routine tips' }, caregiverToken);
  r.status === 403 ? ok('Caregiver access to AI Parent Guide blocked → 403 Forbidden') : bad('Caregiver accessed AI Guide!', r.status);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  TOTAL: ${pass + fail}   PASS: ${pass}   FAIL: ${fail}`);
  if (fail === 0) {
    console.log('  SCORE: 100% — PHASE 3 IMPLEMENTATION COMPLETE! 🎉');
  } else {
    console.log('  SCORE: FAILED ❌');
  }
  console.log('═══════════════════════════════════════════════════════\n');
  process.exit(fail === 0 ? 0 : 1);
};

run();
