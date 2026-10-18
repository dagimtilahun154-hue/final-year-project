'use strict';

// No configured database or provider is loaded. These regression tests use the
// real payment routes, controller, service and error handler with inert dependencies.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const databaseCalls = [];
let allowPaymentRead = false;
const existingPayment = {
  id: 7, order_id: 9, parent_id: 4, method: 'pay_at_daycare',
  status: 'paid', total: '100.00', order_status: 'collected',
};
const database = {
  async query(sql, params) {
    databaseCalls.push({ sql, params });
    assert.ok(allowPaymentRead, 'Deferred payment operation must not query the database');
    assert.match(sql, /^\s*SELECT /);
    return { rows: [{ ...existingPayment }] };
  },
  async connect() {
    databaseCalls.push({ connect: true });
    throw new Error('Deferred payment operation must not start a database transaction');
  },
};

function loadPayments() {
  const stubs = new Map([
    [require.resolve('../src/config/db'), database],
    [require.resolve('../src/config/logger'), { error() {} }],
    [require.resolve('../src/middleware/auth'), (req, res, next) => {
      if (req.headers.authorization !== 'Bearer synthetic-parent') {
        return res.status(401).json({ error: 'Authentication required' });
      }
      req.user = { id: 4, role: 'parent' };
      next();
    }],
  ]);
  const previous = new Map();
  for (const [id, value] of stubs) {
    previous.set(id, require.cache[id]);
    require.cache[id] = { id, filename: id, loaded: true, exports: value };
  }
  try {
    return {
      service: require('../src/modules/payments/payments.service'),
      router: require('../src/modules/payments/payments.routes'),
      errorHandler: require('../src/middleware/errorHandler'),
    };
  } finally {
    for (const [id, entry] of previous) {
      if (entry) require.cache[id] = entry;
      else delete require.cache[id];
    }
  }
}

const { service, router, errorHandler } = loadPayments();
const isUnavailable = (error) => error.statusCode === 503 && error.code === 'PAYMENTS_UNAVAILABLE';

test.beforeEach(() => {
  databaseCalls.length = 0;
  allowPaymentRead = false;
});

for (const payload of [
  { tx_ref: 'synthetic-existing-reference' },
  { tx_ref: 'synthetic-existing-reference', status: 'success' },
  { gateway_ref: 'synthetic-existing-reference', status: 'failed' },
  {}, null,
]) {
  test(`webhook rejects ${JSON.stringify(payload)} before accessing payment data`, async () => {
    await assert.rejects(service.handleWebhook(payload), isUnavailable);
    assert.deepEqual(databaseCalls, []);
  });
}

for (const method of ['digital', 'pay_at_daycare']) {
  test(`${method} initiation cannot create a checkout or reset a paid order`, async () => {
    await assert.rejects(service.initiatePayment({ order_id: 9, method }, { id: 4, role: 'parent' }), isUnavailable);
    assert.deepEqual(databaseCalls, []);
  });
}

test('existing payment status remains readable by its parent', async () => {
  allowPaymentRead = true;
  assert.deepEqual(await service.getPaymentByOrder('9', { id: 4, role: 'parent' }), existingPayment);
  assert.equal(databaseCalls.length, 1);
});

test('reading a payment still rejects another parent', async () => {
  allowPaymentRead = true;
  await assert.rejects(service.getPaymentByOrder('9', { id: 5, role: 'parent' }),
    (error) => error.statusCode === 403);
});

test('mounted endpoints return unavailable instead of acknowledging a payment', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', router);
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  function request(path, body, authorization) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1', port: server.address().port,
        path: `/api/payments${path}`, method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authorization ? { authorization } : {}) },
      }, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.end(JSON.stringify(body));
    });
  }

  try {
    for (const body of [{ tx_ref: 'synthetic-existing-reference' }, { tx_ref: 'synthetic-existing-reference', status: 'success' }]) {
      const result = await request('/webhook', body);
      assert.equal(result.status, 503);
      assert.deepEqual(result.body, { error: 'Payment processing is not available yet.' });
    }
    for (const method of ['digital', 'pay_at_daycare']) {
      const result = await request('/initiate', { order_id: 9, method }, 'Bearer synthetic-parent');
      assert.equal(result.status, 503);
      assert.deepEqual(result.body, { error: 'Payment processing is not available yet.' });
    }
    const unauthenticated = await request('/initiate', { order_id: 9, method: 'digital' });
    assert.equal(unauthenticated.status, 401);
    assert.deepEqual(databaseCalls, []);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
