'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { once } = require('node:events');
const http = require('node:http');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const express = require('express');
const bcrypt = require('bcryptjs');
const { withIsolatedDatabase, ownedDatabases } = require('./helpers/auth-test-database.cjs');
const { createAccountRecovery, GENERIC_MESSAGE } = require('../src/modules/account-recovery');

const origin = 'http://localhost:8081';
const originalPassword = 'Recovery-original-382!';
const changedPassword = 'Recovery-changed-739!';
const passwordHash = bcrypt.hashSync(originalPassword, 4);
const tokenHash = value => createHash('sha256').update(value).digest('hex');
const randomHash = () => randomBytes(32).toString('hex');
const config = { enabled: true, allowedOrigins: [origin], resetBaseUrl: origin,
  activeKeyId: 'test-recovery-key', encryptionKeys: { 'test-recovery-key': Buffer.alloc(32, 19) } };

async function fixtures(db) {
  const suffix = randomBytes(5).toString('hex');
  await db('roles').insert([{ id: 1, name: 'admin' }, { id: 2, name: 'caregiver' }, { id: 3, name: 'parent' }]).onConflict('id').ignore();
  const [a, b] = await db('daycares').insert(['a', 'b'].map(name => ({ name: `Recovery ${name} ${suffix}`, slug: `recovery-${name}-${suffix}`,
    login_code: `recovery-${name}-${suffix}`, contact_email: `${name}-${suffix}@example.invalid`, status: 'active' }))).returning('*');
  // Case variants preserve the legacy global constraint while representing the
  // same normalized email in two independent tenant namespaces.
  const shared = `parent-${suffix}@example.invalid`;
  const [parentA, parentB] = await db('users').insert([
    { name: 'Recovery Parent A', email: shared, daycare_id: a.id },
    { name: 'Recovery Parent B', email: shared.toUpperCase(), daycare_id: b.id },
  ].map(user => ({ ...user, role_id: 3, status: 'active', profile_complete: true, password_hash: passwordHash }))).returning('*');
  const [platform] = await db('platform_accounts').insert({ name: 'Recovery Owner', email: `owner-${suffix}@example.invalid`,
    password_hash: passwordHash, status: 'active' }).returning('*');
  return { a, b, parentA, parentB, platform };
}

async function application(pool, work, overrides = {}) {
  const recovery = createAccountRecovery({ pool, config: { ...config, ...overrides } });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', recovery.daycareRouter);
  app.use('/api/platform/auth', recovery.platformRouter);
  app.get('/api/auth/unrelated', (req, res) => res.json({ untouched: true }));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Internal server error' }));
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, body, headers = {}) => {
    const response = await fetch(`${address}${path}`, { method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body) });
    const text = await response.text();
    let bodyValue;
    try { bodyValue = JSON.parse(text); } catch { bodyValue = null; }
    const result = { status: response.status, body: bodyValue, headers: response.headers };
    if (response.status !== 404) assert.equal(result.headers.get('cache-control'), 'no-store');
    return result;
  };
  try { await work({ recovery, request, address }); }
  finally { server.closeAllConnections(); await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

async function resetMessage(recovery, db, principal) {
  const column = principal.daycare_id ? 'user_id' : 'platform_account_id';
  const row = await db('auth_mail_outbox').where(column, principal.id).where('kind', 'password_reset').orderBy('created_at', 'desc').first();
  assert.ok(row);
  const message = await recovery.inbox.view(row.id);
  const url = new URL(message.reset_url);
  assert.equal(url.origin, origin);
  assert.equal(url.search, '');
  return { ...message, token: new URLSearchParams(url.hash.slice(1)).get('token'), stored: row };
}

async function ask(recovery, f, kind = 'daycare', daycare = f.a, account = f.parentA) {
  return recovery.service.forgotPassword(kind, kind === 'daycare' ? { daycare_code: daycare.login_code, email: account.email } : { email: f.platform.email });
}

test('account recovery uses encrypted local delivery and independent tenant credentials', { timeout: 180000 }, async t => {
  await withIsolatedDatabase(async ({ db, pool, name }) => {
    await application(pool, async ({ recovery, request, address }) => {
      await t.test('recovery routers pass unrelated login and protected paths through unchanged', async () => {
        const response = await fetch(`${address}/api/auth/unrelated`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { untouched: true });
      });
      await t.test('the guarded local inbox command lists metadata and explicitly decrypts one message', async () => {
        const f = await fixtures(db);
        await ask(recovery, f);
        const row = await db('auth_mail_outbox').where({ user_id: f.parentA.id, kind: 'password_reset' }).first();
        const run = args => promisify(execFile)(process.execPath, [path.resolve(__dirname, 'auth-test-inbox.cjs'), ...args], {
          cwd: path.resolve(__dirname, '..'), timeout: 15000, maxBuffer: 100000,
          env: { ...process.env, NODE_ENV: 'test', DAYCARE_AUTH_ENABLED: 'true', DB_NAME: name,
            DAYCARE_AUTH_ALLOWED_ORIGINS: origin, AUTH_RESET_BASE_URL: origin,
            AUTH_ENCRYPTION_KEYS: JSON.stringify({ [config.activeKeyId]: config.encryptionKeys[config.activeKeyId].toString('base64') }),
            AUTH_ENCRYPTION_ACTIVE_KEY_ID: config.activeKeyId },
        });
        const listed = JSON.parse((await run(['list'])).stdout);
        assert.ok(listed.some(message => message.id === row.id));
        for (const message of listed) assert.deepEqual(Object.keys(message).sort(), ['created_at', 'expires_at', 'id', 'kind']);
        assert.equal(JSON.stringify(listed).includes(f.parentA.email), false);
        const viewed = JSON.parse((await run(['view', row.id])).stdout);
        assert.equal(viewed.to, f.parentA.email);
        assert.match(new URLSearchParams(new URL(viewed.reset_url).hash.slice(1)).get('token'), /^dr1\./);
      });

      await t.test('known, unknown and suspended recovery requests return the same generic response', async () => {
        const f = await fixtures(db);
        const responses = [];
        for (const [code, email] of [[f.a.login_code, f.parentA.email], [f.a.login_code, 'unknown@example.invalid'], ['unknown-center', f.parentA.email]]) {
          responses.push(await request('/api/auth/forgot-password', { daycare_code: code, email }));
        }
        await db('users').where('id', f.parentA.id).update({ status: 'inactive' });
        responses.push(await request('/api/auth/forgot-password', { daycare_code: f.a.login_code, email: f.parentA.email }));
        for (const result of responses) { assert.equal(result.status, 202); assert.deepEqual(result.body, { message: GENERIC_MESSAGE }); }
        assert.equal(await db('daycare_password_reset_tokens').where('user_id', f.parentA.id).count().first().then(row => Number(row.count)), 1);
        assert.equal(await db('daycare_password_reset_tokens').where('user_id', f.parentB.id).count().first().then(row => Number(row.count)), 0);
      });

      await t.test('local inbox listings omit recipients and secrets; encrypted messages use trusted fragment URLs', async () => {
        const f = await fixtures(db);
        const result = await request('/api/auth/forgot-password', { daycare_code: ` ${f.a.login_code.toUpperCase()} `, email: ` ${f.parentA.email.toUpperCase()} ` }, { Host: 'attacker.invalid' });
        assert.equal(result.status, 202);
        const mail = await resetMessage(recovery, db, f.parentA);
        assert.match(mail.token, /^dr1\.[A-Za-z0-9_-]{43}$/);
        assert.equal(mail.to, f.parentA.email);
        assert.equal(mail.stored.payload_ciphertext.includes(mail.token), false);
        assert.equal(mail.stored.payload_ciphertext.includes(mail.to), false);
        assert.equal(JSON.stringify(result.body).includes(mail.token), false);
        const token = await db('daycare_password_reset_tokens').where('user_id', f.parentA.id).first();
        assert.equal(token.token_hash, tokenHash(mail.token));
        for (const listing of await recovery.inbox.list()) assert.deepEqual(Object.keys(listing).sort(), ['created_at', 'expires_at', 'id', 'kind']);
        const hidden = await request(`/api/auth/inbox/${mail.id}`, {});
        assert.equal(hidden.status, 404);
      });

      await t.test('public recovery endpoints enforce origin, strict bodies, JSON and byte length', async () => {
        const f = await fixtures(db);
        const input = { daycare_code: f.a.login_code, email: f.parentA.email };
        assert.equal((await request('/api/auth/forgot-password', input, { Origin: 'https://attacker.invalid' })).status, 403);
        assert.equal((await request('/api/auth/forgot-password', { ...input, daycare_id: f.b.id })).status, 422);
        assert.equal((await request('/api/auth/forgot-password', input, { 'Content-Type': 'text/plain' })).status, 415);
        await ask(recovery, f);
        const mail = await resetMessage(recovery, db, f.parentA);
        for (const newPassword of ['too-short', 'é'.repeat(37), 'x'.repeat(73)]) {
          assert.equal((await request('/api/auth/reset-password', { daycare_code: f.a.login_code, token: mail.token, new_password: newPassword })).status, 422);
        }
      });

      await t.test('wrong daycare, wrong principal kind and legacy reset tokens cannot consume a live link', async () => {
        const f = await fixtures(db);
        await ask(recovery, f);
        const mail = await resetMessage(recovery, db, f.parentA);
        const input = { daycare_code: f.b.login_code, token: mail.token, new_password: changedPassword };
        assert.equal((await request('/api/auth/reset-password', input)).status, 400);
        assert.equal((await request('/api/platform/auth/reset-password', { token: mail.token, new_password: changedPassword })).status, 422);
        assert.equal((await request('/api/auth/reset-password', { ...input, token: randomBytes(32).toString('hex') })).status, 422);
        assert.equal((await db('daycare_password_reset_tokens').where('user_id', f.parentA.id).first()).consumed_at, null);
      });

      await t.test('new links invalidate older links and budgets persist through unknown account requests', async () => {
        const f = await fixtures(db);
        await ask(recovery, f);
        const first = await resetMessage(recovery, db, f.parentA);
        for (let i = 0; i < 6; i += 1) assert.deepEqual(await ask(recovery, f), { message: GENERIC_MESSAGE });
        assert.equal(Number((await db('daycare_password_reset_tokens').where('user_id', f.parentA.id).count().first()).count), 5);
        await assert.rejects(recovery.service.resetPassword('daycare', { daycare_code: f.a.login_code, token: first.token, new_password: changedPassword }), { statusCode: 400 });
        const unknown = { daycare_code: f.a.login_code, email: 'budget-unknown@example.invalid' };
        for (let i = 0; i < 7; i += 1) assert.deepEqual(await recovery.service.forgotPassword('daycare', unknown), { message: GENERIC_MESSAGE });
      });

      await t.test('successful tenant reset revokes only that account sessions, challenges and old reset tokens while retaining MFA', async () => {
        const f = await fixtures(db);
        const [factor] = await db('mfa_factors').insert({ daycare_id: f.a.id, user_id: f.parentA.id, secret_ciphertext: 'fixture-encrypted', encryption_key_id: 'fixture', confirmed_at: db.fn.now() }).returning('*');
        await db('mfa_recovery_codes').insert({ factor_id: factor.id, code_hash: randomHash() });
        for (const [user, center] of [[f.parentA, f.a], [f.parentB, f.b]]) {
          await db('auth_sessions').insert({ daycare_id: center.id, user_id: user.id, token_hash: randomHash(), expires_at: new Date(Date.now() + 3600000) });
          await db('auth_challenges').insert({ daycare_id: center.id, user_id: user.id, purpose: 'login_mfa', token_hash: randomHash(), expires_at: new Date(Date.now() + 3600000) });
        }
        await db('password_reset_tokens').insert({ user_id: f.parentA.id, token_hash: randomHash(), expires_at: new Date(Date.now() + 3600000) });
        await ask(recovery, f);
        const mail = await resetMessage(recovery, db, f.parentA);
        const result = await request('/api/auth/reset-password', { daycare_code: f.a.login_code, token: mail.token, new_password: changedPassword });
        assert.equal(result.status, 200);
        assert.equal(result.body.token, undefined);
        assert.equal(result.headers.get('set-cookie'), null);
        assert.ok(await bcrypt.compare(changedPassword, (await db('users').where('id', f.parentA.id).first()).password_hash));
        assert.ok(await bcrypt.compare(originalPassword, (await db('users').where('id', f.parentB.id).first()).password_hash));
        for (const table of ['auth_sessions', 'auth_challenges']) {
          assert.ok((await db(table).where('user_id', f.parentA.id).first()).revoked_at);
          assert.equal((await db(table).where('user_id', f.parentB.id).first()).revoked_at, null);
        }
        assert.equal((await db('mfa_factors').where('id', factor.id).first()).revoked_at, null);
        assert.equal((await db('mfa_recovery_codes').where('factor_id', factor.id).first()).consumed_at, null);
        assert.equal((await db('password_reset_tokens').where('user_id', f.parentA.id).first()).used, true);
        assert.ok(await db('auth_mail_outbox').where('user_id', f.parentA.id).where('kind', 'password_changed').first());
        assert.ok(await db('audit_logs').where('actor_id', f.parentA.id).where('action', 'daycare.auth.password_reset').first());
      });

      await t.test('concurrent reset attempts consume one link exactly once', async () => {
        const f = await fixtures(db);
        await ask(recovery, f);
        const mail = await resetMessage(recovery, db, f.parentA);
        const input = { daycare_code: f.a.login_code, token: mail.token, new_password: changedPassword };
        const results = await Promise.allSettled([recovery.service.resetPassword('daycare', input), recovery.service.resetPassword('daycare', input)]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal(results.find(result => result.status === 'rejected').reason.statusCode, 400);
        assert.equal(Number((await db('auth_mail_outbox').where('user_id', f.parentA.id).where('kind', 'password_changed').count().first()).count), 1);
      });

      await t.test('expired links and suspended daycares cannot change credentials', async () => {
        const f = await fixtures(db);
        await ask(recovery, f);
        const mail = await resetMessage(recovery, db, f.parentA);
        await db('daycare_password_reset_tokens').where('user_id', f.parentA.id).update({ created_at: new Date(Date.now() - 7200000), expires_at: new Date(Date.now() - 3600000) });
        await assert.rejects(recovery.service.resetPassword('daycare', { daycare_code: f.a.login_code, token: mail.token, new_password: changedPassword }), { statusCode: 400 });
        await ask(recovery, f);
        const current = await resetMessage(recovery, db, f.parentA);
        await db('daycares').where('id', f.a.id).update({ status: 'suspended' });
        await assert.rejects(recovery.service.resetPassword('daycare', { daycare_code: f.a.login_code, token: current.token, new_password: changedPassword }), { statusCode: 400 });
        assert.equal((await db('users').where('id', f.parentA.id).first()).password_hash, passwordHash);
      });

      await t.test('platform recovery stays separate and revokes platform sessions only', async () => {
        const f = await fixtures(db);
        await db('auth_sessions').insert({ platform_account_id: f.platform.id, token_hash: randomHash(), expires_at: new Date(Date.now() + 3600000) });
        await db('auth_sessions').insert({ daycare_id: f.a.id, user_id: f.parentA.id, token_hash: randomHash(), expires_at: new Date(Date.now() + 3600000) });
        const response = await request('/api/platform/auth/forgot-password', { email: f.platform.email });
        assert.equal(response.status, 202);
        const mail = await resetMessage(recovery, db, f.platform);
        assert.match(mail.token, /^pr1\.[A-Za-z0-9_-]{43}$/);
        assert.equal((await request('/api/platform/auth/reset-password', { token: mail.token, new_password: changedPassword })).status, 200);
        assert.ok((await db('auth_sessions').where('platform_account_id', f.platform.id).first()).revoked_at);
        assert.equal((await db('auth_sessions').where('user_id', f.parentA.id).first()).revoked_at, null);
        assert.ok(await bcrypt.compare(changedPassword, (await db('platform_accounts').where('id', f.platform.id).first()).password_hash));
        assert.ok(await db('platform_audit_events').where('target_id', String(f.platform.id)).where('action', 'platform.auth.password_reset').first());
      });

      await t.test('authenticated password change requires current credentials and invalidates all account links', async () => {
        const f = await fixtures(db);
        await ask(recovery, f);
        const principal = { principal_kind: 'daycare', id: f.parentA.id, daycare_id: f.a.id };
        await assert.rejects(recovery.service.changePassword(principal, { current_password: 'incorrect', new_password: changedPassword }), { statusCode: 401 });
        await recovery.service.changePassword(principal, { current_password: originalPassword, new_password: changedPassword });
        assert.ok((await db('daycare_password_reset_tokens').where('user_id', f.parentA.id).first()).consumed_at);
        assert.ok(await bcrypt.compare(changedPassword, (await db('users').where('id', f.parentA.id).first()).password_hash));
      });

      await t.test('outbox and audit faults roll back token issuance or credential reset atomically', async () => {
        const f = await fixtures(db);
        await db.raw(`CREATE FUNCTION recovery_test_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test secret must never escape'; END $$`);
        try {
          await db.raw('CREATE TRIGGER recovery_outbox_fault BEFORE INSERT ON auth_mail_outbox FOR EACH ROW EXECUTE FUNCTION recovery_test_reject()');
          await assert.rejects(ask(recovery, f), error => error.statusCode === 503 && !error.message.includes('secret'));
          assert.equal(Number((await db('daycare_password_reset_tokens').where('user_id', f.parentA.id).count().first()).count), 0);
          await db.raw('DROP TRIGGER recovery_outbox_fault ON auth_mail_outbox');
          await ask(recovery, f);
          const mail = await resetMessage(recovery, db, f.parentA);
          await db.raw('CREATE TRIGGER recovery_audit_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION recovery_test_reject()');
          await assert.rejects(recovery.service.resetPassword('daycare', { daycare_code: f.a.login_code, token: mail.token, new_password: changedPassword }), error => error.statusCode === 503 && !error.message.includes('secret'));
          assert.equal((await db('users').where('id', f.parentA.id).first()).password_hash, passwordHash);
          assert.equal((await db('daycare_password_reset_tokens').where('user_id', f.parentA.id).first()).consumed_at, null);
          assert.equal(Number((await db('auth_mail_outbox').where('user_id', f.parentA.id).where('kind', 'password_changed').count().first()).count), 0);
        } finally {
          await db.raw('DROP TRIGGER IF EXISTS recovery_outbox_fault ON auth_mail_outbox');
          await db.raw('DROP TRIGGER IF EXISTS recovery_audit_fault ON audit_logs');
          await db.raw('DROP FUNCTION recovery_test_reject()');
        }
      });
    });
  });
  assert.equal(ownedDatabases.size, 0);
});
