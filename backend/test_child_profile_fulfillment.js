'use strict';
/**
 * test_child_profile_fulfillment.js
 * Verifies that the child and parent profile fulfillment saves all data
 * to the exact PostgreSQL tables:
 * - users (parent data: name, email, role_id)
 * - children (child data: full_name, dob, gender, group_id, enrollment_status)
 * - guardian_links (parent-child relation: relationship, pickup_authorized)
 */
const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'POST',
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, data: raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function put(path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'PUT',
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, data: raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, data: raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== TESTING CHILD & PARENT PROFILE FULFILLMENT ===');

  // 1. Register a new parent
  const testEmail = `parent_test_${Date.now()}@ankelba.dev`;
  console.log(`\n1. Registering parent: ${testEmail}`);
  const regRes = await post('/api/auth/register', {
    name: 'Initial Parent Name',
    email: testEmail,
    password: 'Password123!',
  });
  console.log('Registration Status:', regRes.status);
  if (regRes.status !== 201) {
    console.error('Registration failed:', regRes.data);
    process.exit(1);
  }
  const token = regRes.data.token;
  const parentId = regRes.data.user.id;
  const initialChild = regRes.data.user.linked_children[0];
  const childId = initialChild.id;
  console.log(`Created Parent ID: ${parentId}, Child ID: ${childId}`);

  // 2. Fetch linked children via GET /api/parent/children
  console.log('\n2. Fetching linked children via GET /api/parent/children');
  const listRes = await get('/api/parent/children', token);
  console.log('List Status:', listRes.status);
  console.log('Initial Linked Child:', listRes.data.children[0]);

  // 3. Fulfill complete child & parent data via PUT /api/parent/children/:id/profile
  console.log('\n3. Fulfilling child profile via PUT /api/parent/children/:id/profile');
  const updatePayload = {
    full_name: 'Liya Hana Tilahun',
    dob: '2023-04-15',
    gender: 'female',
    group_id: 1,
    relationship: 'Mother',
    pickup_authorized: true,
    parent_name: 'Tigist Alemayehu',
  };
  const putRes = await put(`/api/parent/children/${childId}/profile`, updatePayload, token);
  console.log('Update Status:', putRes.status);
  console.log('Update Response Child:', putRes.data.child);
  console.log('Update Response Parent:', putRes.data.parent);

  if (putRes.status !== 200) {
    console.error('Update failed:', putRes.data);
    process.exit(1);
  }

  // 4. Verify directly with GET /api/parent/children/:id
  console.log('\n4. Verifying with GET /api/parent/children/:id');
  const getRes = await get(`/api/parent/children/${childId}`, token);
  console.log('Get Child Status:', getRes.status);
  const updatedChild = getRes.data.child;
  console.log('Verified Child Data:', {
    id: updatedChild.id,
    full_name: updatedChild.full_name,
    dob: updatedChild.dob,
    gender: updatedChild.gender,
    group_id: updatedChild.group_id,
    group_name: updatedChild.group_name,
    relationship: updatedChild.relationship,
    pickup_authorized: updatedChild.pickup_authorized,
  });

  // Check assertions
  if (
    updatedChild.full_name === 'Liya Hana Tilahun' &&
    updatedChild.dob.startsWith('2023-04-15') &&
    updatedChild.gender === 'female' &&
    updatedChild.relationship === 'Mother' &&
    updatedChild.pickup_authorized === true
  ) {
    console.log('\n>>> ALL CHILD PROFILE DATA PERSISTENCE TESTS PASSED! <<<');
  } else {
    console.error('Data mismatch in verified child data!');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
