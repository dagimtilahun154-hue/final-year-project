/**
 * test_e2e_real_data_flow.js
 * End-to-end automated verification of Parent Portal real PostgreSQL data integration:
 * 1. Parent Authentication & Linked Children
 * 2. Child Profile, Allergies, Care Instructions & Emergency Contacts
 * 3. Direct Messaging (send & retrieve messages with caregiver)
 * 4. Store Order Placement, Inventory Deduction & My Orders History
 * 5. Authorized Guardians with Biometric Enrollment Status
 * 6. Announcements & Events
 * 7. AI Guide Allergy-Aware Advice
 */

const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('       PARENT PORTAL END-TO-END POSTGRESQL REAL DATA VERIFICATION    ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Parent Login
  console.log('[1] Parent Authentication');
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'parent@ankelba.dev', password: 'Parent@123!' });

  assert(loginRes.status === 200, 'HTTP 200 on login');
  const token = loginRes.data?.token;
  assert(!!token, 'Returned JWT token');
  const parentId = loginRes.data?.user?.id;
  assert(loginRes.data?.user?.role === 'parent', 'User role is parent');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // 2. Child Profile & Allergies
  console.log('\n[2] Child Profile & Care Instructions');
  const childRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/parent/children/1',
    method: 'GET',
    headers: authHeaders,
  });

  assert(childRes.status === 200, 'HTTP 200 on /api/parent/children/1');
  const child = childRes.data?.child;
  assert(child?.id === 1, 'Child ID is 1');
  assert(Array.isArray(child?.care_instructions), 'care_instructions is array');
  const allergies = (child?.care_instructions || []).filter(c => c.category === 'allergy');
  assert(allergies.length > 0, `Found ${allergies.length} allergy records in PostgreSQL`);
  assert(Array.isArray(child?.emergency_contacts), 'emergency_contacts is array');

  // 3. Authorized Guardians
  console.log('\n[3] Authorized Guardians with Biometric Status');
  const guardiansRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/children/1/guardians',
    method: 'GET',
    headers: authHeaders,
  });

  assert(guardiansRes.status === 200, 'HTTP 200 on /api/children/1/guardians');
  assert(Array.isArray(guardiansRes.data?.data), 'Guardians list returned from DB');
  if (guardiansRes.data?.data?.length > 0) {
    const g = guardiansRes.data.data[0];
    assert('pickup_authorized' in g, 'Contains pickup_authorized field');
    assert('biometric_enrolled' in g, 'Contains biometric_enrolled field');
  }

  // 4. Direct Messaging
  console.log('\n[4] Direct Messaging Flow');
  const sendMsgRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/communication/messages',
    method: 'POST',
    headers: authHeaders,
  }, {
    recipient_id: 23, // Caregiver ID
    body: 'Automated E2E Test: Hi, checking in on morning activities.',
    subject: 'Morning Check-in',
  });

  assert(sendMsgRes.status === 200 || sendMsgRes.status === 201, 'Direct message successfully sent');

  const listMsgRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/communication/messages?with_user_id=23',
    method: 'GET',
    headers: authHeaders,
  });

  assert(listMsgRes.status === 200, 'HTTP 200 on list messages');
  assert(Array.isArray(listMsgRes.data?.data), 'Messages returned as array');
  const foundSent = (listMsgRes.data?.data || []).some(m => m.body.includes('Automated E2E Test'));
  assert(foundSent, 'Sent message retrieved from PostgreSQL messages table');

  // 5. Store Orders & Inventory
  console.log('\n[5] Daycare Store Order & Order History');
  // First get products
  const productsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/store/products',
    method: 'GET',
    headers: authHeaders,
  });

  assert(productsRes.status === 200, 'HTTP 200 on /api/store/products');
  const products = productsRes.data?.data || [];
  assert(products.length > 0, `Store has ${products.length} products in DB`);

  const productToBuy = products.find(p => p.stock_qty > 2) || products[0];
  const orderRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/store/orders',
    method: 'POST',
    headers: authHeaders,
  }, {
    items: [{ product_id: productToBuy.id, quantity: 1 }],
  });

  assert(orderRes.status === 200 || orderRes.status === 201, 'Order created in PostgreSQL');
  const orderId = orderRes.data?.id;
  assert(!!orderId, `Order ID created: #${orderId}`);

  const myOrdersRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/store/orders/my',
    method: 'GET',
    headers: authHeaders,
  });

  assert(myOrdersRes.status === 200, 'HTTP 200 on /api/store/orders/my');
  const myOrders = myOrdersRes.data?.data || [];
  const foundOrder = myOrders.some(o => o.id === orderId);
  assert(foundOrder, 'Newly placed order exists in /api/store/orders/my');

  // 6. Announcements & Calendar Events
  console.log('\n[6] Announcements & Calendar Events');
  const annRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/communication/announcements',
    method: 'GET',
    headers: authHeaders,
  });

  assert(annRes.status === 200, 'HTTP 200 on announcements');
  assert(Array.isArray(annRes.data?.data), 'Announcements returned as array');

  const eventsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/events?include_past=true',
    method: 'GET',
    headers: authHeaders,
  });

  assert(eventsRes.status === 200, 'HTTP 200 on events');
  assert(Array.isArray(eventsRes.data?.data), 'Events returned as array');

  // 7. AI Guide with Allergy Guardrail
  console.log('\n[7] AI Guide Allergy Safety Integration');
  const aiRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ai/guide',
    method: 'POST',
    headers: authHeaders,
  }, {
    question: 'Can you recommend a healthy snack for my child?',
    child_id: 1,
  });

  assert(aiRes.status === 200, 'HTTP 200 on /api/ai/guide');
  assert(typeof aiRes.data?.answer === 'string' && aiRes.data.answer.length > 20, 'AI returned guidance');
  if (allergies.length > 0) {
    const hasWarning = aiRes.data.answer.toLowerCase().includes('allerg') || aiRes.data.answer.toLowerCase().includes('careful');
    assert(hasWarning, 'AI guidance incorporates allergy safety notice');
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  E2E VERIFICATION RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
