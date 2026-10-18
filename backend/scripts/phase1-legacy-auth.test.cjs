'use strict';

// These regressions exercise the legacy HTTP flow against an owned, generated
// PostgreSQL database. The configured application database is never opened.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const { randomBytes, createHash } = require('node:crypto');
const { once } = require('node:events');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const cookieParser = require('cookie-parser');
const { withIsolatedDatabase, assertTestDatabaseName, ownedDatabases } = require('./helpers/auth-test-database.cjs');

const password = 'Synthetic-start-password-714!';
const nextPassword = 'Synthetic-next-password-825!';
const secret = 'synthetic-phase-one-jwt-secret-not-for-real-accounts';
const genericRecovery = { message: 'If that email is registered and active, password reset instructions have been issued.' };
const digest = value => createHash('sha256').update(value).digest('hex');
const denied = code => error => (error.statusCode || error.status) === code;

async function migration013Only(db, pool, name) {
  assertTestDatabaseName(name);
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, name);
  for (const migration of [
    '017_authentication_security_workflows.js', '016_invitation_audit_storage.js',
    '015_authentication_storage.js', '014_tenant_account_foundation.js',
  ]) {
    await require(path.resolve(__dirname, '../src/db/migrations', migration)).down(db);
    await db('knex_migrations').where({ name: migration }).delete();
  }
  assert.equal(await db.schema.hasTable('auth_sessions'), false);
  assert.equal(await db.schema.hasTable('auth_mail_outbox'), false);
  assert.equal(await db.schema.hasColumn('daycares', 'login_code'), false);
}

async function fixture(db) {
  const suffix = randomBytes(5).toString('hex');
  await db('roles').insert([
    { id: 0, name: 'super_admin' }, { id: 1, name: 'admin' },
    { id: 2, name: 'caregiver' }, { id: 3, name: 'parent' },
  ]).onConflict('id').ignore();
  const [daycare] = await db('daycares').insert({ name: 'Phase one fixture', slug: `phase-one-${suffix}`,
    contact_email: `daycare-${suffix}@example.invalid`, status: 'active' }).returning('*');
  const passwordHash = await bcrypt.hash(password, 4);
  const [admin, parent, owner, unscoped] = await db('users').insert([
    { name: 'Daycare administrator', email: `admin-${suffix}@example.invalid`, role_id: 1, daycare_id: daycare.id },
    { name: 'Parent account', email: `parent-${suffix}@example.invalid`, role_id: 3, daycare_id: daycare.id },
    { name: 'Platform owner', email: `owner-${suffix}@example.invalid`, role_id: 0, daycare_id: null },
    { name: 'Unscoped legacy parent', email: `unscoped-${suffix}@example.invalid`, role_id: 3, daycare_id: null },
  ].map(row => ({ ...row, password_hash: passwordHash, status: 'active' }))).returning('*');
  return { daycare, admin, parent, owner, unscoped };
}

async function withHttp(pool, inboxDirectory, work) {
  const env = { NODE_ENV: 'test', DAYCARE_AUTH_ENABLED: 'false', JWT_SECRET: secret };
  const previousEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const sourceRoot = path.resolve(__dirname, '../src') + path.sep;
  const previousCache = new Map(Object.entries(require.cache).filter(([file]) => file.startsWith(sourceRoot)));
  for (const [file] of previousCache) delete require.cache[file];
  const dbFile = require.resolve('../src/config/db');
  const loggerFile = require.resolve('../src/config/logger');
  const logs = [];
  const logger = Object.fromEntries(['error', 'warn', 'info', 'http', 'debug'].map(level => [level, (...args) => logs.push(args)]));
  require.cache[dbFile] = { id: dbFile, filename: dbFile, loaded: true, exports: pool };
  require.cache[loggerFile] = { id: loggerFile, filename: loggerFile, loaded: true, exports: logger };
  let server;
  try {
    const inboxModule = require('../src/modules/auth/legacy-inbox');
    const inbox = inboxModule.createLegacyInbox({ directory: inboxDirectory });
    inboxModule.inbox = inbox;
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', require('../src/modules/auth/auth.routes'));
    app.use('/api/users', require('../src/modules/users/users.routes'));
    app.use('/api/saas', require('../src/modules/saas/saas.routes'));
    app.use(require('../src/middleware/errorHandler'));
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    async function request(method, route, body, headers = {}) {
      const response = await fetch(`${baseUrl}${route}`, { method,
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
      const text = await response.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = null; }
      return { status: response.status, body: parsed, text, cookie: response.headers.get('set-cookie')?.split(';')[0] };
    }
    const login = async (user, value = password) => {
      const result = await request('POST', '/api/auth/login', { email: user.email, password: value });
      assert.equal(result.status, 200, result.text);
      return result;
    };
    const me = token => request('GET', '/api/auth/me', undefined, { Authorization: `Bearer ${token}` });
    const recover = async user => {
      const before = new Set((await inbox.list()).map(row => row.id));
      const response = await request('POST', '/api/auth/forgot-password', { email: user.email });
      assert.equal(response.status, 200, response.text);
      assert.deepEqual(response.body, genericRecovery);
      const added = (await inbox.list()).filter(row => !before.has(row.id));
      assert.equal(added.length, 1);
      const message = await inbox.view(added[0].id);
      assert.equal(message.to, user.email);
      assert.match(message.token, /^lr1\.[a-f0-9]{64}\.[a-f0-9]{64}$/);
      return message;
    };
    await work({ request, login, me, recover, inbox, logs, service: require('../src/modules/auth/auth.service') });
  } finally {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    for (const file of Object.keys(require.cache)) if (file.startsWith(sourceRoot)) delete require.cache[file];
    for (const [file, cached] of previousCache) require.cache[file] = cached;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test('phase one legacy authentication closes public bypasses and revokes stale access at migration013', { timeout: 180000 }, async t => {
  const inboxDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ankelba-phase1-auth-test-'));
  try {
    await withIsolatedDatabase(async ({ db, pool, name }) => {
      await migration013Only(db, pool, name);
      await withHttp(pool, inboxDirectory, async ({ request, login, me, recover, inbox, service, logs }) => {
        await t.test('fresh JWTs carry bound state and support bearer and cookie requests', async () => {
          const f = await fixture(db);
          const result = await login(f.parent);
          const decoded = jwt.verify(result.body.token, secret, { algorithms: ['HS256'], audience: 'ankelba-legacy' });
          assert.match(decoded.auth_state, /^[a-f0-9]{64}$/);
          assert.equal(decoded.userId, f.parent.id);
          assert.equal(decoded.password_hash, undefined);
          assert.equal(result.text.includes(f.parent.password_hash), false);
          assert.equal((await me(result.body.token)).status, 200);
          assert.equal((await request('GET', '/api/auth/me', undefined, { Cookie: result.cookie })).status, 200);
          assert.equal((await login(f.owner)).body.user.role, 'super_admin');
        });

        await t.test('unversioned, wrong-audience and wrong-algorithm tokens are rejected', async () => {
          const f = await fixture(db);
          const valid = jwt.decode((await login(f.parent)).body.token);
          const claims = { userId: valid.userId, role: valid.role, daycareId: valid.daycareId, auth_state: valid.auth_state };
          for (const token of [
            jwt.sign({ userId: f.parent.id, role: 'parent', daycareId: f.daycare.id }, secret, { expiresIn: '1h' }),
            jwt.sign(claims, secret, { audience: 'other-application', expiresIn: '1h' }),
            jwt.sign(claims, secret, { algorithm: 'HS384', audience: 'ankelba-legacy', expiresIn: '1h' }),
          ]) assert.equal((await me(token)).status, 401);
        });

        await t.test('tenant accounts require an active daycare and account before login', async () => {
          const f = await fixture(db);
          assert.ok([401, 403].includes((await request('POST', '/api/auth/login', { email: f.unscoped.email, password })).status));
          for (const status of ['pending', 'suspended', 'rejected']) {
            await db('daycares').where({ id: f.daycare.id }).update({ status });
            assert.ok([401, 403].includes((await request('POST', '/api/auth/login', { email: f.parent.email, password })).status));
          }
          await db('daycares').where({ id: f.daycare.id }).update({ status: 'active' });
          await db('users').where({ id: f.parent.id }).update({ status: 'inactive' });
          assert.ok([401, 403].includes((await request('POST', '/api/auth/login', { email: f.parent.email, password })).status));
        });

        await t.test('public parent signup is denied in HTTP and service without provisioning records', async () => {
          const before = await Promise.all(['users', 'children', 'guardian_links'].map(table => db(table).count('* AS count').first()));
          const input = { name: 'Rejected public applicant', email: 'public-registration@example.invalid', password };
          assert.equal((await request('POST', '/api/auth/register', input)).status, 403);
          await assert.rejects(service.register(input), denied(403));
          const after = await Promise.all(['users', 'children', 'guardian_links'].map(table => db(table).count('* AS count').first()));
          assert.deepEqual(after, before);
        });

        await t.test('daycare suspension revokes existing JWTs permanently through reactivation', async () => {
          const f = await fixture(db);
          const parent = await login(f.parent);
          const owner = await login(f.owner);
          const headers = { Authorization: `Bearer ${owner.body.token}` };
          assert.equal((await request('PATCH', `/api/saas/super-admin/daycares/${f.daycare.id}/suspend`, {}, headers)).status, 200);
          assert.ok([401, 403].includes((await me(parent.body.token)).status));
          assert.equal((await request('PATCH', `/api/saas/super-admin/daycares/${f.daycare.id}/activate`, {}, headers)).status, 200);
          assert.equal((await me(parent.body.token)).status, 401);
          assert.equal((await me((await login(f.parent)).body.token)).status, 200);
        });

        await t.test('user deactivation revokes existing JWTs permanently through reactivation', async () => {
          const f = await fixture(db);
          const parent = await login(f.parent);
          const admin = await login(f.admin);
          const headers = { Authorization: `Bearer ${admin.body.token}` };
          for (const status of ['inactive', 'active']) {
            const response = await request('PATCH', `/api/users/${f.parent.id}/status`, { status }, headers);
            assert.equal(response.status, 200, response.text);
            assert.equal((await me(parent.body.token)).status, 401);
          }
          assert.equal((await me((await login(f.parent)).body.token)).status, 200);
        });

        await t.test('sub-millisecond user and daycare revision changes invalidate issued JWTs', async () => {
          const f = await fixture(db);
          for (const [table, id] of [['users', f.parent.id], ['daycares', f.daycare.id]]) {
            await db(table).where({ id }).update({ updated_at: db.raw("'2026-01-01T00:00:00.000001Z'::timestamptz") });
            const signedIn = await login(f.parent);
            await db(table).where({ id }).update({ updated_at: db.raw("'2026-01-01T00:00:00.000002Z'::timestamptz") });
            assert.equal((await me(signedIn.body.token)).status, 401);
          }
        });

        await t.test('password changes reject wrong current passwords and revoke all previously issued JWTs', async () => {
          const f = await fixture(db);
          const first = await login(f.parent);
          const second = await login(f.parent);
          const headers = { Authorization: `Bearer ${first.body.token}` };
          assert.equal((await request('PATCH', '/api/auth/change-password', { current_password: 'Wrong-password-123!', new_password: nextPassword }, headers)).status, 401);
          assert.equal((await me(first.body.token)).status, 200);
          const changed = await request('PATCH', '/api/auth/change-password', { current_password: password, new_password: nextPassword }, headers);
          assert.equal(changed.status, 200, changed.text);
          assert.equal((await me(first.body.token)).status, 401);
          assert.equal((await me(second.body.token)).status, 401);
          assert.equal((await request('POST', '/api/auth/login', { email: f.parent.email, password })).status, 401);
          await login(f.parent, nextPassword);
        });

        await t.test('concurrent changes using the same old password have only one winner', async () => {
          const f = await fixture(db);
          const signedIn = await login(f.parent);
          const headers = { Authorization: `Bearer ${signedIn.body.token}` };
          const results = await Promise.all([nextPassword, 'Synthetic-other-password-936!'].map(new_password =>
            request('PATCH', '/api/auth/change-password', { current_password: password, new_password }, headers)));
          assert.deepEqual(results.map(result => result.status).sort(), [200, 401]);
          assert.equal((await me(signedIn.body.token)).status, 401);
        });

        await t.test('previously leaked 64-character reset tokens cannot be redeemed', async () => {
          const f = await fixture(db);
          const oldToken = randomBytes(32).toString('hex');
          await db('password_reset_tokens').insert({ user_id: f.parent.id, token_hash: digest(oldToken),
            expires_at: new Date(Date.now() + 60000), used: false });
          assert.equal((await request('POST', '/api/auth/reset-password', { token: oldToken, new_password: nextPassword })).status, 422);
          await assert.rejects(service.resetPassword(oldToken, nextPassword), denied(400));
          assert.equal((await db('users').where({ id: f.parent.id }).first()).password_hash, f.parent.password_hash);
        });

        await t.test('recovery responses are identical for eligible, unknown and ineligible accounts', async () => {
          const f = await fixture(db);
          const sent = await recover(f.parent);
          assert.equal((await db('password_reset_tokens').where({ user_id: f.parent.id, used: false }).first()).token_hash, digest(sent.token));
          const before = (await inbox.list()).length;
          await db('users').where({ id: f.admin.id }).update({ status: 'inactive' });
          for (const email of ['unknown@example.invalid', f.admin.email, f.unscoped.email]) {
            const response = await request('POST', '/api/auth/forgot-password', { email });
            assert.equal(response.status, 200, response.text);
            assert.deepEqual(response.body, genericRecovery);
          }
          await db('daycares').where({ id: f.daycare.id }).update({ status: 'suspended' });
          const suspended = await request('POST', '/api/auth/forgot-password', { email: f.parent.email });
          assert.equal(suspended.status, 200);
          assert.deepEqual(suspended.body, genericRecovery);
          assert.equal((await inbox.list()).length, before);
        });

        await t.test('local inbox encrypts token and recipient while its listing exposes metadata only', async () => {
          const f = await fixture(db);
          const sent = await recover(f.parent);
          const listing = (await inbox.list()).find(row => row.id === sent.id);
          assert.deepEqual(Object.keys(listing).sort(), ['created_at', 'expires_at', 'id', 'kind']);
          const encrypted = await fs.readFile(path.join(inboxDirectory, `${sent.id}.json`), 'utf8');
          assert.equal(encrypted.includes(sent.token), false);
          assert.equal(encrypted.includes(f.parent.email), false);
          assert.equal(JSON.stringify(logs).includes(sent.token), false);
          await assert.rejects(inbox.view('../outside-inbox'), /Invalid local message ID/);
        });

        await t.test('same reset token can succeed only once under concurrent HTTP requests', async () => {
          const f = await fixture(db);
          const previous = await login(f.parent);
          const sent = await recover(f.parent);
          const body = { token: sent.token, new_password: nextPassword };
          const responses = await Promise.all([
            request('POST', '/api/auth/reset-password', body), request('POST', '/api/auth/reset-password', body),
          ]);
          assert.deepEqual(responses.map(result => result.status).sort(), [200, 400]);
          assert.equal((await me(previous.body.token)).status, 401);
          assert.equal((await request('POST', '/api/auth/reset-password', body)).status, 400);
          assert.equal((await db('password_reset_tokens').where({ user_id: f.parent.id, used: false })).length, 0);
          await login(f.parent, nextPassword);
        });

        await t.test('requesting a replacement reset link invalidates the earlier link', async () => {
          const f = await fixture(db);
          const old = await recover(f.parent);
          const current = await recover(f.parent);
          assert.equal((await request('POST', '/api/auth/reset-password', { token: old.token, new_password: nextPassword })).status, 400);
          assert.equal((await request('POST', '/api/auth/reset-password', { token: current.token, new_password: nextPassword })).status, 200);
          await login(f.parent, nextPassword);
        });

        await t.test('expired reset links cannot change credentials', async () => {
          const f = await fixture(db);
          const sent = await recover(f.parent);
          await db('password_reset_tokens').where({ token_hash: digest(sent.token) }).update({ expires_at: new Date(Date.now() - 1000) });
          assert.equal((await request('POST', '/api/auth/reset-password', { token: sent.token, new_password: nextPassword })).status, 400);
          assert.equal((await db('users').where({ id: f.parent.id }).first()).password_hash, f.parent.password_hash);
        });

        await t.test('password changes invalidate all outstanding recovery links', async () => {
          const f = await fixture(db);
          const signedIn = await login(f.parent);
          const sent = await recover(f.parent);
          const changed = await request('PATCH', '/api/auth/change-password', { current_password: password, new_password: nextPassword },
            { Authorization: `Bearer ${signedIn.body.token}` });
          assert.equal(changed.status, 200);
          assert.equal((await request('POST', '/api/auth/reset-password', { token: sent.token, new_password: 'Unwanted-after-change-478!' })).status, 400);
          assert.equal((await db('password_reset_tokens').where({ user_id: f.parent.id, used: false })).length, 0);
        });

        await t.test('recovery links remain revoked after daycare suspension and reactivation', async () => {
          const f = await fixture(db);
          const sent = await recover(f.parent);
          const owner = await login(f.owner);
          const headers = { Authorization: `Bearer ${owner.body.token}` };
          for (const operation of ['suspend', 'activate']) {
            assert.equal((await request('PATCH', `/api/saas/super-admin/daycares/${f.daycare.id}/${operation}`, {}, headers)).status, 200);
            assert.equal((await request('POST', '/api/auth/reset-password', { token: sent.token, new_password: nextPassword })).status, 400);
          }
          await login(f.parent);
        });

        await t.test('recovery links remain revoked after account deactivation and reactivation', async () => {
          const f = await fixture(db);
          const sent = await recover(f.parent);
          const admin = await login(f.admin);
          const headers = { Authorization: `Bearer ${admin.body.token}` };
          for (const status of ['inactive', 'active']) {
            assert.equal((await request('PATCH', `/api/users/${f.parent.id}/status`, { status }, headers)).status, 200);
            assert.equal((await request('POST', '/api/auth/reset-password', { token: sent.token, new_password: nextPassword })).status, 400);
          }
          await login(f.parent);
        });

        await t.test('racing a reset and password change admits only one credential update', async () => {
          const f = await fixture(db);
          const signedIn = await login(f.parent);
          const sent = await recover(f.parent);
          const responses = await Promise.all([
            request('POST', '/api/auth/reset-password', { token: sent.token, new_password: nextPassword }),
            request('PATCH', '/api/auth/change-password', { current_password: password, new_password: 'Synthetic-racing-password-753!' },
              { Authorization: `Bearer ${signedIn.body.token}` }),
          ]);
          assert.equal(responses.filter(result => result.status === 200).length, 1);
          assert.ok(responses.every(result => [200, 400, 401].includes(result.status)));
          assert.equal((await me(signedIn.body.token)).status, 401);
          assert.equal((await db('password_reset_tokens').where({ user_id: f.parent.id, used: false })).length, 0);
        });

        await t.test('production recovery is uniformly unavailable without issuing a token', async () => {
          const f = await fixture(db);
          const countBefore = await db('password_reset_tokens').count('* AS count').first();
          process.env.NODE_ENV = 'production';
          try {
            const existing = await request('POST', '/api/auth/forgot-password', { email: f.parent.email });
            const unknown = await request('POST', '/api/auth/forgot-password', { email: 'unknown-production@example.invalid' });
            assert.equal(existing.status, 503);
            assert.equal(unknown.status, 503);
            assert.deepEqual(existing.body, unknown.body);
            assert.deepEqual(await db('password_reset_tokens').count('* AS count').first(), countBefore);
          } finally { process.env.NODE_ENV = 'test'; }
        });

        assert.ok(logs.every(entry => !JSON.stringify(entry).includes(password)));
      });
    });
    assert.equal(ownedDatabases.size, 0);
  } finally {
    const absolute = path.resolve(inboxDirectory);
    assert.equal(path.dirname(absolute), path.resolve(os.tmpdir()));
    assert.match(path.basename(absolute), /^ankelba-phase1-auth-test-/);
    await fs.rm(absolute, { recursive: true, force: true });
  }
});
