'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { once } = require('node:events');
const http = require('node:http');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { withIsolatedDatabase, assertTestDatabaseName, ownedDatabases } = require('./helpers/auth-test-database.cjs');
const { createDaycareAuth } = require('../src/modules/daycare-auth');
const { createDaycareUsers } = require('../src/modules/daycare-users');
const { loadDaycareAuthConfig } = require('../src/config/daycare-auth');
const { securityConfig, securityEnvironment, finishMfa } = require('./helpers/auth-security-fixtures.cjs');

const password = 'Test-only-password-482!';
const passwordHash = bcrypt.hashSync(password, 4);
const hash = value => createHash('sha256').update(value).digest('hex');
const randomHash = () => randomBytes(32).toString('hex');
const origin = 'http://localhost:8081';

function assertNoSecrets(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of ['password_hash', 'token_hash', 'secret_ciphertext', 'password_reset_tokens']) {
    assert.equal(serialized.includes(forbidden), false, `Response disclosed ${forbidden}`);
  }
  assert.equal(serialized.includes(password), false, 'Response disclosed a fixture password');
}

async function fixtures(db) {
  const suffix = randomBytes(5).toString('hex');
  await db('roles').insert([{ id: 1, name: 'admin' }, { id: 2, name: 'caregiver' }, { id: 3, name: 'parent' }]).onConflict('id').ignore();
  const [daycareA, daycareB] = await db('daycares').insert([
    { name: `Alpha ${suffix}`, slug: `alpha-${suffix}`, login_code: `alpha-${suffix}`, contact_email: `alpha-${suffix}@example.invalid`, status: 'active' },
    { name: `Beta ${suffix}`, slug: `beta-${suffix}`, login_code: `beta-${suffix}`, contact_email: `beta-${suffix}@example.invalid`, status: 'active' },
  ]).returning('*');
  const [adminA, adminB, parentA, parentB, caregiverA, unscoped] = await db('users').insert([
    { name: 'Admin A', email: `admin-a-${suffix}@example.invalid`, role_id: 1, daycare_id: daycareA.id },
    { name: 'Admin B', email: `admin-b-${suffix}@example.invalid`, role_id: 1, daycare_id: daycareB.id },
    { name: 'Parent A', email: `parent-a-${suffix}@example.invalid`, role_id: 3, daycare_id: daycareA.id },
    { name: 'Parent B', email: `parent-b-${suffix}@example.invalid`, role_id: 3, daycare_id: daycareB.id },
    { name: 'Caregiver A', email: `caregiver-a-${suffix}@example.invalid`, role_id: 2, daycare_id: daycareA.id },
    { name: 'Unscoped parent', email: `unscoped-${suffix}@example.invalid`, role_id: 3, daycare_id: null },
  ].map(user => ({ ...user, password_hash: passwordHash, status: 'active', profile_complete: true }))).returning('*');
  const [owner] = await db('users').insert({ name: 'Fixture platform owner', email: `owner-${suffix}@example.invalid`, role_id: 0, daycare_id: null, password_hash: passwordHash, status: 'active' }).returning('*');
  return { suffix, daycareA, daycareB, adminA, adminB, parentA, parentB, caregiverA, unscoped, owner };
}

async function withApplication(pool, work, overrides = {}) {
  const auth = createDaycareAuth({ pool, config: securityConfig({
    cookieName: 'daycare_session', sessionTtlSeconds: 28800,
    allowedOrigins: [origin], secureCookies: false,
  }) });
  const users = createDaycareUsers({ pool, authenticate: auth.authenticate });
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', auth.router);
  app.use('/api/users', users.router);
  app.get('/api/protected', auth.authenticate, (req, res) => res.json({ user: req.user }));
  // Controllers and middleware receive the real pool. Deliberate internal faults
  // get the same sanitized response without importing application DB/log config.
  app.use((error, req, res, next) => {
    const status = error.statusCode || error.status || (error.isJoi ? 422 : 500);
    res.status(status).json({ error: status === 500 ? 'Internal server error' : error.message });
  });
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (method, route, body, headers = {}) => {
    const response = await fetch(`${base}${route}`, {
      method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: 'manual',
    });
    const text = await response.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    return { status: response.status, body: json, text, headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const login = async (user, daycare, transport = 'bearer', additional = {}) => finishMfa(request,
    await request('POST', '/api/auth/login', {
      daycare_code: daycare.login_code, email: user.email, password, transport, ...additional,
    }), `${daycare.id}:${user.email}`, transport);
  try { await work({ request, login, auth, users, ...overrides }); }
  finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

function bearer(login) {
  assert.equal(login.status, 200, login.text);
  assert.match(login.body.token, /^dc1\.[A-Za-z0-9_-]{43}$/);
  return { Authorization: `Bearer ${login.body.token}` };
}

test('authentication database guard refuses application, maintenance and unowned database names', () => {
  for (const name of ['postgres', process.env.DB_NAME || 'ankelba_dev', 'ankelba_auth_test_other', 'ankelba_auth_test_1_1_deadbeef']) {
    assert.throws(() => assertTestDatabaseName(name));
  }
  assert.equal(ownedDatabases.size, 0);
});

test('authentication preview defaults off and rejects unsafe activation or origin configuration', () => {
  assert.equal(loadDaycareAuthConfig({}).enabled, false);
  assert.equal(loadDaycareAuthConfig({ NODE_ENV: 'production' }).enabled, false);
  assert.throws(() => loadDaycareAuthConfig({ NODE_ENV: 'production', DAYCARE_AUTH_ENABLED: 'true' }));
  assert.throws(() => loadDaycareAuthConfig({ DAYCARE_AUTH_ENABLED: 'yes' }));
  const enabled = { NODE_ENV: 'test', DAYCARE_AUTH_ENABLED: 'true', ...securityEnvironment };
  assert.equal(loadDaycareAuthConfig(enabled).enabled, true);
  for (const value of ['*', 'https://trusted.example.invalid/path', 'https://user:secret@example.invalid', 'https://example.invalid?query=1', 'file:///tmp']) {
    assert.throws(() => loadDaycareAuthConfig({ ...enabled, DAYCARE_AUTH_ALLOWED_ORIGINS: value }));
  }
  for (const value of ['1', '86401', '-1', 'NaN', '300.5']) {
    assert.throws(() => loadDaycareAuthConfig({ ...enabled, DAYCARE_SESSION_TTL_SECONDS: value }));
  }
});

test('daycare authentication and provisioning isolate accounts and revoke access', { timeout: 180000 }, async t => {
  await withIsolatedDatabase(async ({ db, pool }) => {
    await withApplication(pool, async ({ request, login, users }) => {
      await t.test('login binds normalized daycare code and email to an opaque hashed session', async () => {
        const f = await fixtures(db);
        const result = await login(f.parentA, f.daycareA, 'bearer', {
          daycare_code: `  ${f.daycareA.login_code.toUpperCase()}  `, email: `  ${f.parentA.email.toUpperCase()}  `,
        });
        const headers = bearer(result);
        assert.equal(result.body.user.id, f.parentA.id);
        assert.equal(result.body.user.daycare_id, f.daycareA.id);
        assert.equal(result.body.user.role, 'parent');
        assert.equal(result.body.user.principal_kind, 'daycare');
        assertNoSecrets(result.body);
        const sessions = await db('auth_sessions').where({ user_id: f.parentA.id });
        assert.equal(sessions.length, 1);
        assert.equal(sessions[0].daycare_id, f.daycareA.id);
        assert.equal(sessions[0].platform_account_id, null);
        assert.equal(sessions[0].token_hash, hash(result.body.token));
        assert.ok(new Date(sessions[0].expires_at) > new Date(sessions[0].created_at));
        assert.equal((await request('GET', '/api/auth/me', undefined, headers)).body.user.id, f.parentA.id);
      });

      await t.test('unknown credentials and wrong daycare share a generic denial without new sessions', async () => {
        const f = await fixtures(db);
        const valid = { daycare_code: f.daycareA.login_code, email: f.parentA.email, password, transport: 'bearer' };
        const results = [];
        for (const payload of [
          { ...valid, password: 'Wrong-password-583!' }, { ...valid, daycare_code: f.daycareB.login_code },
          { ...valid, daycare_code: 'unknown-daycare-code' }, { ...valid, email: 'unknown@example.invalid' },
          { ...valid, email: f.owner.email }, { ...valid, email: f.unscoped.email },
        ]) results.push(await request('POST', '/api/auth/login', payload));
        for (const result of results) { assert.equal(result.status, 401, result.text); assert.deepEqual(result.body, results[0].body); assertNoSecrets(result.body); }
        const missing = await request('POST', '/api/auth/login', { email: f.parentA.email, password });
        assert.equal(missing.status, 422);
        assert.equal((await db('auth_sessions').whereIn('user_id', [f.parentA.id, f.owner.id, f.unscoped.id])).length, 0);
      });

      await t.test('provisioning and recovery cannot use public legacy paths', async () => {
        const before = Number((await db('users').count('* AS n').first()).n);
        const resets = Number((await db('password_reset_tokens').count('* AS n').first()).n);
        for (const route of ['/api/auth/register', '/api/auth/forgot-password', '/api/auth/reset-password']) {
          const result = await request('POST', route, { email: 'test@example.invalid', password, token: 'never-a-real-token' });
          assert.ok([401, 403, 404, 405, 422].includes(result.status), `${route}: ${result.status}`);
          assertNoSecrets(result.body);
          assert.equal(result.text.includes('never-a-real-token'), false);
        }
        assert.equal(Number((await db('users').count('* AS n').first()).n), before);
        assert.equal(Number((await db('password_reset_tokens').count('* AS n').first()).n), resets);
      });

      await t.test('legacy JWTs, malformed credentials and conflicting transports never authenticate', async () => {
        const f = await fixtures(db);
        const valid = await login(f.parentA, f.daycareA);
        const cookieLogin = await login(f.parentA, f.daycareA, 'cookie');
        assert.equal(cookieLogin.status, 200);
        const legacy = jwt.sign({ id: f.parentA.id, role: 'admin', daycare_id: f.daycareB.id }, 'synthetic-test-secret');
        for (const headers of [
          { Authorization: `Bearer ${legacy}` }, { Authorization: 'Bearer broken', Cookie: cookieLogin.cookie },
          { Authorization: `Basic ${valid.body.token}`, Cookie: cookieLogin.cookie },
          { ...bearer(valid), Cookie: cookieLogin.cookie },
        ]) assert.equal((await request('GET', '/api/auth/me', undefined, headers)).status, 401);
      });

      await t.test('cookie sessions withhold raw tokens and enforce origin and CSRF for mutations', async () => {
        const f = await fixtures(db);
        const signedIn = await login(f.parentA, f.daycareA, 'cookie');
        assert.equal(signedIn.status, 200, signedIn.text);
        assert.equal(Object.hasOwn(signedIn.body, 'token'), false);
        assert.match(signedIn.body.csrf_token, /^[a-f0-9]{64}$/);
        assert.match(signedIn.headers.get('set-cookie'), /HttpOnly/i);
        assert.match(signedIn.headers.get('set-cookie'), /SameSite=Strict/i);
        const cookie = { Cookie: signedIn.cookie };
        const me = await request('GET', '/api/auth/me', undefined, cookie);
        assert.equal(me.status, 200);
        assert.equal(me.body.csrf_token, signedIn.body.csrf_token);
        for (const headers of [cookie, { ...cookie, 'X-CSRF-Token': '0'.repeat(64), Origin: origin },
          { ...cookie, 'X-CSRF-Token': signedIn.body.csrf_token, Origin: 'https://attacker.example.invalid' }]) {
          assert.equal((await request('PATCH', '/api/users/profile/me', { name: 'Must not save' }, headers)).status, 403);
        }
        assert.equal((await db('users').where({ id: f.parentA.id }).first()).name, f.parentA.name);
        const changed = await request('PATCH', '/api/users/profile/me', { name: 'Allowed profile name' }, {
          ...cookie, 'X-CSRF-Token': signedIn.body.csrf_token, Origin: origin,
        });
        assert.equal(changed.status, 200, changed.text);
        assert.equal((await db('users').where({ id: f.parentA.id }).first()).name, 'Allowed profile name');
        const deniedOrigin = await request('POST', '/api/auth/login', {
          daycare_code: f.daycareA.login_code, email: f.parentA.email, password,
        }, { Origin: 'https://attacker.example.invalid' });
        assert.equal(deniedOrigin.status, 403);
      });

      await t.test('logout revokes server state and is safe to repeat after revocation or expiry', async () => {
        const f = await fixtures(db);
        const signedIn = await login(f.parentA, f.daycareA);
        const headers = bearer(signedIn);
        assert.equal((await request('POST', '/api/auth/logout', {}, headers)).status, 200);
        assert.ok((await db('auth_sessions').where({ token_hash: hash(signedIn.body.token) }).first()).revoked_at);
        assert.equal((await request('GET', '/api/auth/me', undefined, headers)).status, 401);
        assert.equal((await request('POST', '/api/auth/logout', {}, headers)).status, 200);
        const expired = await login(f.parentA, f.daycareA);
        await db('auth_sessions').where({ token_hash: hash(expired.body.token) }).update({ created_at: new Date(Date.now() - 120000), expires_at: new Date(Date.now() - 60000) });
        assert.equal((await request('GET', '/api/auth/me', undefined, bearer(expired))).status, 401);
        assert.equal((await request('POST', '/api/auth/logout', {}, bearer(expired))).status, 200);
      });

      await t.test('current account and daycare status are rechecked on every request', async () => {
        const f = await fixtures(db);
        const signedIn = await login(f.parentA, f.daycareA);
        const headers = bearer(signedIn);
        for (const status of ['inactive', 'pending', 'suspended']) {
          await db('users').where({ id: f.parentA.id }).update({ status });
          assert.ok([401, 403].includes((await request('GET', '/api/auth/me', undefined, headers)).status));
          assert.equal((await login(f.parentA, f.daycareA)).status, 401);
        }
        await db('users').where({ id: f.parentA.id }).update({ status: 'active' });
        for (const status of ['pending', 'suspended', 'rejected']) {
          await db('daycares').where({ id: f.daycareA.id }).update({ status });
          assert.ok([401, 403].includes((await request('GET', '/api/auth/me', undefined, headers)).status));
          assert.equal((await login(f.parentA, f.daycareA)).status, 401);
        }
        await db('daycares').where({ id: f.daycareA.id }).update({ status: 'active' });
        await db('users').where({ id: f.parentA.id }).update({ role_id: 0 });
        assert.equal((await request('GET', '/api/auth/me', undefined, headers)).status, 401);
      });

      await t.test('untrusted daycare selectors cannot switch session scope', async () => {
        const f = await fixtures(db);
        const headers = bearer(await login(f.adminA, f.daycareA));
        assert.equal((await request('GET', `/api/auth/me?daycare_id=${f.daycareB.id}`, undefined, headers)).status, 403);
        const attack = await request('PATCH', '/api/users/profile/me', { name: 'Cross daycare', daycare_id: f.daycareB.id }, headers);
        assert.ok([403, 422].includes(attack.status));
        assert.equal((await db('users').where({ id: f.adminA.id }).first()).name, f.adminA.name);
      });

      await t.test('admin list, counts and direct target access remain inside one daycare', async () => {
        const f = await fixtures(db);
        const headers = bearer(await login(f.adminA, f.daycareA));
        const list = await request('GET', '/api/users?page=1&limit=100', undefined, headers);
        assert.equal(list.status, 200, list.text);
        assert.equal(list.body.total, 3);
        assert.equal(list.body.data.length, 3);
        assert.ok(list.body.data.every(user => user.daycare_id === f.daycareA.id));
        assertNoSecrets(list.body);
        const filtered = await request('GET', '/api/users?role=parent', undefined, headers);
        assert.equal(filtered.status, 200);
        assert.equal(filtered.body.total, 1);
        assert.equal(filtered.body.data[0].id, f.parentA.id);
        const same = await request('GET', `/api/users/${f.parentA.id}`, undefined, headers);
        assert.equal(same.status, 200);
        for (const method of ['GET', 'PATCH']) {
          const result = await request(method, `/api/users/${f.parentB.id}`, method === 'PATCH' ? { name: 'Forbidden' } : undefined, headers);
          assert.equal(result.status, 404, result.text);
        }
        assert.equal((await request('PATCH', `/api/users/${f.parentB.id}/status`, { status: 'inactive' }, headers)).status, 404);
        assert.equal((await db('users').where({ id: f.parentB.id }).first()).status, 'active');
      });

      await t.test('only daycare admins provision caregiver and parent accounts, with no role or tenant override', async () => {
        const f = await fixtures(db);
        const adminHeaders = bearer(await login(f.adminA, f.daycareA));
        for (const user of [f.parentA, f.caregiverA]) {
          const headers = bearer(await login(user, f.daycareA));
          for (const [method, route, body] of [
            ['GET', '/api/users', undefined], ['POST', '/api/users', { name: 'No access', email: `denied-${f.suffix}@example.invalid`, password, role: 'parent' }],
            ['PATCH', `/api/users/${f.parentA.id}`, { name: 'No access' }], ['PATCH', `/api/users/${f.parentA.id}/status`, { status: 'inactive' }],
          ]) assert.equal((await request(method, route, body, headers)).status, 403);
        }
        const create = { name: 'New parent', email: `new-${f.suffix}@example.invalid`, password, role: 'parent' };
        for (const body of [{ ...create, role: 'admin' }, { ...create, role: 'super_admin' },
          { ...create, daycare_id: f.daycareB.id }, { ...create, role_id: 1 }, { ...create, status: 'active' }]) {
          assert.ok([403, 422].includes((await request('POST', '/api/users', body, adminHeaders)).status));
        }
        const created = await request('POST', '/api/users', create, adminHeaders);
        assert.equal(created.status, 201, created.text);
        const stored = await db('users').where({ email: create.email }).first();
        assert.equal(stored.daycare_id, f.daycareA.id);
        assert.equal(stored.role_id, 3);
        assert.ok(await bcrypt.compare(password, stored.password_hash));
        assertNoSecrets(created.body);
        const duplicate = await request('POST', '/api/users', { ...create, email: f.parentB.email }, adminHeaders);
        assert.equal(duplicate.status, 409, duplicate.text);
        assert.equal(duplicate.text.includes(f.parentB.email), false);
        assert.equal(duplicate.text.includes('users_email_unique'), false);
      });

      await t.test('daycare admins cannot edit or deactivate admin accounts', async () => {
        const f = await fixtures(db);
        const headers = bearer(await login(f.adminA, f.daycareA));
        for (const [route, body] of [[`/api/users/${f.adminA.id}`, { name: 'Forbidden admin edit' }],
          [`/api/users/${f.adminA.id}/status`, { status: 'inactive' }]]) {
          assert.equal((await request('PATCH', route, body, headers)).status, 403);
        }
        assert.equal((await db('users').where({ id: f.adminA.id }).first()).name, f.adminA.name);
        assert.equal((await db('users').where({ id: f.adminA.id }).first()).status, 'active');
      });

      await t.test('invalid IDs, pagination and unknown mutation fields fail validation safely', async () => {
        const f = await fixtures(db);
        const headers = bearer(await login(f.adminA, f.daycareA));
        for (const route of ['/api/users/0', '/api/users/-1', '/api/users/1.5', '/api/users/2147483648',
          '/api/users/not-a-number', '/api/users?page=0', '/api/users?limit=101', '/api/users?page=NaN', '/api/users?unexpected=1']) {
          const result = await request('GET', route, undefined, headers);
          assert.equal(result.status, 422, `${route}: ${result.text}`);
          assertNoSecrets(result.body);
        }
        for (const body of [{}, { password }, { role: 'admin' }, { email: 'invalid-email' }, { name: 'Test', extra: 1 }]) {
          assert.equal((await request('PATCH', `/api/users/${f.parentA.id}`, body, headers)).status, 422);
        }
      });

      await t.test('self profiles contain only safe metadata and email changes revoke sessions and old reset tokens', async () => {
        const f = await fixtures(db);
        const signedIn = await login(f.parentA, f.daycareA);
        const second = await login(f.parentA, f.daycareA);
        const other = await login(f.parentB, f.daycareB);
        const headers = bearer(signedIn);
        const profile = await request('GET', '/api/users/profile/me', undefined, headers);
        assert.equal(profile.status, 200);
        assertNoSecrets(profile.body);
        const allowedKeys = ['id', 'name', 'email', 'role', 'status', 'daycare_id', 'created_at', 'updated_at'];
        assert.ok(Object.keys(profile.body).every(key => allowedKeys.includes(key)));
        await db('password_reset_tokens').insert({ user_id: f.parentA.id, token_hash: randomHash(), expires_at: new Date(Date.now() + 3600000) });
        const result = await request('PATCH', '/api/users/profile/me', { email: `changed-${f.suffix}@example.invalid` }, headers);
        assert.equal(result.status, 200, result.text);
        assert.equal(result.body.reauthentication_required, true);
        for (const session of [signedIn, second]) assert.equal((await request('GET', '/api/auth/me', undefined, bearer(session))).status, 401);
        assert.equal((await request('GET', '/api/auth/me', undefined, bearer(other))).status, 200);
        const oldReset = await db('password_reset_tokens').where({ user_id: f.parentA.id });
        assert.ok(oldReset.length === 0 || oldReset.every(token => token.used));
      });

      await t.test('status changes revoke sessions and recovery links permanently through reactivation', async () => {
        const f = await fixtures(db);
        const admin = bearer(await login(f.adminA, f.daycareA));
        const signedIn = await login(f.parentA, f.daycareA);
        const second = await login(f.parentA, f.daycareA);
        const resetToken = `dr1.${randomBytes(32).toString('base64url')}`;
        await db('daycare_password_reset_tokens').insert({ daycare_id: f.daycareA.id, user_id: f.parentA.id,
          token_hash: hash(resetToken), expires_at: new Date(Date.now() + 1800000) });
        await db('password_reset_tokens').insert({ user_id: f.parentA.id, token_hash: randomHash(), expires_at: new Date(Date.now() + 1800000) });
        assert.equal((await request('PATCH', `/api/users/${f.parentA.id}/status`, { status: 'inactive' }, admin)).status, 200);
        assert.ok((await db('auth_sessions').where({ user_id: f.parentA.id })).every(session => session.revoked_at));
        assert.equal((await request('PATCH', `/api/users/${f.parentA.id}/status`, { status: 'active' }, admin)).status, 200);
        for (const session of [signedIn, second]) assert.equal((await request('GET', '/api/auth/me', undefined, bearer(session))).status, 401);
        assert.equal((await login(f.parentA, f.daycareA)).status, 200);
        assert.ok((await db('daycare_password_reset_tokens').where({ user_id: f.parentA.id }).first()).consumed_at);
        assert.ok((await db('password_reset_tokens').where({ user_id: f.parentA.id }).first()).used);
        assert.equal((await request('POST', '/api/auth/reset-password', {
          daycare_code: f.daycareA.login_code, token: resetToken, new_password: 'Must-not-be-applied-382!',
        })).status, 400);
      });

      await t.test('direct user service calls revalidate actor role, status and daycare instead of trusting claims', async () => {
        const f = await fixtures(db);
        const actor = { id: f.adminA.id, daycare_id: f.daycareA.id, role: 'admin', principal_kind: 'daycare' };
        const rejects = work => assert.rejects(work, error => [401, 403, 404].includes(error.statusCode || error.status));
        await rejects(() => users.service.listUsers({ ...actor, id: f.parentA.id }, {}));
        await rejects(() => users.service.listUsers({ ...actor, daycare_id: f.daycareB.id }, {}));
        await db('users').where({ id: f.adminA.id }).update({ status: 'inactive' });
        await rejects(() => users.service.getUserById(actor, f.parentA.id));
        await db('users').where({ id: f.adminA.id }).update({ status: 'active' });
        await db('daycares').where({ id: f.daycareA.id }).update({ status: 'suspended' });
        await rejects(() => users.service.getMyProfile(actor));
      });

      await t.test('tenant audit records exclude credentials and share the user mutation transaction', async () => {
        const f = await fixtures(db);
        const actor = { id: f.adminA.id, daycare_id: f.daycareA.id, role: 'admin', principal_kind: 'daycare' };
        const signedIn = await login(f.parentA, f.daycareA);
        await users.service.updateUser(actor, f.parentA.id, { name: 'Audited change' });
        const events = await db('audit_logs').where({ actor_id: f.adminA.id });
        assert.ok(events.length > 0);
        assert.ok(events.every(event => event.daycare_id === f.daycareA.id));
        assertNoSecrets(events.map(event => event.metadata));
        assert.equal(JSON.stringify(events).includes(signedIn.body.token), false);

        // Force only audit INSERTs to fail inside a real transaction. All other
        // SQL executes normally against the isolated DB, proving atomic rollback.
        const failingPool = {
          query: (...args) => pool.query(...args),
          connect: async () => {
            const client = await pool.connect();
            return {
              query: (...args) => {
                const sql = typeof args[0] === 'string' ? args[0] : args[0].text;
                if (/insert\s+into\s+"?audit_logs"?/i.test(sql)) return Promise.reject(new Error('Synthetic audit failure'));
                return client.query(...args);
              },
              release: () => client.release(),
            };
          },
        };
        const failing = createDaycareUsers({ pool: failingPool, authenticate: (req, res, next) => next() });
        await assert.rejects(() => failing.service.updateStatus(actor, f.parentA.id, 'inactive'));
        assert.equal((await db('users').where({ id: f.parentA.id }).first()).status, 'active');
        assert.equal((await db('auth_sessions').where({ token_hash: hash(signedIn.body.token) }).first()).revoked_at, null);
        assert.equal((await request('GET', '/api/auth/me', undefined, bearer(signedIn))).status, 200);
      });
    });
  });
  assert.equal(ownedDatabases.size, 0, 'Every database created by this test was removed');
});
