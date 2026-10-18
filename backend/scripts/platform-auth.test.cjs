'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { once } = require('node:events');
const http = require('node:http');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const OTPAuth = require('otpauth');
const { withIsolatedDatabase, ownedDatabases } = require('./helpers/auth-test-database.cjs');
const { createPlatformAuth } = require('../src/modules/platform-auth');
const { createDaycareAuth } = require('../src/modules/daycare-auth');
const { credentials, csrfToken } = require('../src/modules/platform-auth/tokens');
const { validateBootstrapInput } = require('../src/modules/platform-auth/validator');
const { parseArguments } = require('./bootstrap-platform-owner.cjs');

const password = 'Owner-test-password-812!';
const passwordHash = bcrypt.hashSync(password, 4);
const origin = 'http://localhost:8081';
const settings = { cookieName: 'daycare_session', platformCookieName: 'platform_session',
  sessionTtlSeconds: 3600, allowedOrigins: [origin], secureCookies: false,
  activeKeyId: 'test', encryptionKeys: { test: Buffer.alloc(32, 73) } };
const hash = value => createHash('sha256').update(value).digest('hex');
const token = prefix => `${prefix}.${randomBytes(32).toString('base64url')}`;
const authorization = value => ({ Authorization: `Bearer ${value}` });
const accountProfile = value => ({ id: value.id, name: value.name, email: value.email, role: 'platform_owner', principal_kind: 'platform' });

async function ownerFixture(db, status = 'pending_activation') {
  const [owner] = await db('platform_accounts').insert({ name: 'Test platform owner',
    email: `owner-${randomBytes(5).toString('hex')}@example.invalid`, password_hash: passwordHash, status }).returning('*');
  return owner;
}

async function withApplication(pool, work) {
  const platform = createPlatformAuth({ pool, config: settings });
  const daycare = createDaycareAuth({ pool, config: settings });
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/platform-auth', platform.router);
  app.use('/api/daycare-auth', daycare.router);
  app.get('/api/platform-only', platform.authenticate, (req, res) => res.json({
    account: req.platformAccount, session: req.platformSession, user: req.user || null, daycareId: req.daycareId || null,
  }));
  app.post('/api/platform-only', platform.authenticate, (req, res) => res.json({ account: req.platformAccount }));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Internal server error' }));
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const request = async (method, route, body, headers = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, {
      method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual',
    });
    const text = await response.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    return { status: response.status, body: json, text, headers: response.headers,
      cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const login = (owner, additional = {}) => request('POST', '/api/platform-auth/login', { email: owner.email, password, transport: 'bearer', ...additional });
  const setup = challenge => request('POST', '/api/platform-auth/mfa/setup', { challenge_token: challenge });
  const verify = (challenge, proof, transport = 'bearer', headers = {}) => request('POST', '/api/platform-auth/mfa/verify', {
    challenge_token: challenge, ...proof, transport,
  }, headers);
  const enroll = async owner => {
    const first = await login(owner);
    assert.equal(first.status, 202, first.text);
    const start = await setup(first.body.challenge_token);
    assert.equal(start.status, 200, start.text);
    const totp = OTPAuth.URI.parse(start.body.otpauth_uri);
    const complete = await verify(start.body.challenge_token, { totp_code: totp.generate() });
    assert.equal(complete.status, 200, complete.text);
    return { first, start, complete, totp };
  };
  try { await work({ platform, daycare, request, login, setup, verify, enroll }); }
  finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('platform credential parsing rejects legacy/daycare namespaces and conflicting cookies', () => {
  const platform = token('pf1');
  assert.deepEqual(credentials({ headers: { authorization: `Bearer ${platform}` }, cookies: {} }, 'platform_session'), { token: platform, transport: 'bearer' });
  assert.deepEqual(credentials({ headers: {}, cookies: { platform_session: platform, daycare_session: token('dc1') } }, 'platform_session'), { token: platform, transport: 'cookie' });
  for (const candidate of [token('dc1'), 'legacy.jwt.signature', ` ${platform}`, `${platform} `]) {
    assert.throws(() => credentials({ headers: { authorization: `Bearer ${candidate}` }, cookies: {} }, 'platform_session'), { statusCode: 401 });
  }
  assert.throws(() => credentials({ headers: { authorization: `Bearer ${platform}` }, cookies: { platform_session: token('pf1') } }, 'platform_session'), { statusCode: 401 });
  assert.throws(() => credentials({ headers: {}, cookies: { daycare_session: platform } }, 'platform_session'), { statusCode: 401 });
});

test('bootstrap input is explicit and rejects unsafe credential lengths', () => {
  assert.deepEqual(parseArguments(['--email', 'owner@example.invalid', '--name', 'Owner']), { name: 'Owner', email: 'owner@example.invalid' });
  for (const args of [[], ['--name', 'Owner', '--password', password], ['--email', 'a', '--email', 'b'], ['--email', 'a', '--name', 'Owner', '--password', password]]) {
    assert.throws(() => parseArguments(args));
  }
  for (const candidate of ['short', 'é'.repeat(37), 'x'.repeat(73), `valid-password\0unsafe`]) {
    assert.throws(() => validateBootstrapInput({ name: 'Owner', email: 'owner@example.invalid', password: candidate }), { statusCode: 422 });
  }
  assert.equal(validateBootstrapInput({ name: ' Owner ', email: ' OWNER@example.invalid ', password }).email, 'owner@example.invalid');
});

test('first platform owner bootstrap is serialized, audited and never overwrites existing accounts', { timeout: 180000 }, async () => {
  await withIsolatedDatabase(async ({ db, pool }) => {
    const platform = createPlatformAuth({ pool, config: settings });
    const results = await Promise.allSettled([
      platform.service.bootstrapOwner({ name: 'First owner', email: 'first@example.invalid', password }),
      platform.service.bootstrapOwner({ name: 'Second owner', email: 'second@example.invalid', password }),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected' && result.reason.statusCode === 409).length, 1);
    const owners = await db('platform_accounts');
    assert.equal(owners.length, 1);
    assert.equal(owners[0].status, 'pending_activation');
    assert.equal(owners[0].email_verified_at, null);
    assert.ok(await bcrypt.compare(password, owners[0].password_hash));
    assert.equal(owners[0].password_hash.split('$')[2], '12');
    assert.equal((await db('auth_sessions')).length, 0);
    const audits = await db('platform_audit_events').where({ action: 'platform.owner.bootstrap' });
    assert.equal(audits.length, 1);
    assert.equal(audits[0].actor_kind, 'system');
    assert.equal(audits[0].platform_account_id, null);
    assert.equal(JSON.stringify(audits).includes(password), false);
    await db('platform_accounts').where({ id: owners[0].id }).update({ status: 'disabled' });
    await assert.rejects(platform.service.bootstrapOwner({ name: 'Replacement', email: owners[0].email, password: 'Replacement-password-593!' }), { statusCode: 409 });
    assert.equal((await db('platform_accounts').first()).password_hash, owners[0].password_hash);
  });
  assert.equal(ownedDatabases.size, 0);
});

test('owner bootstrap rolls back the account if mandatory audit persistence fails', { timeout: 180000 }, async () => {
  await withIsolatedDatabase(async ({ db, pool }) => {
    const platform = createPlatformAuth({ pool, config: settings });
    await db.raw(`CREATE FUNCTION fail_platform_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$;
      CREATE TRIGGER fail_platform_audit BEFORE INSERT ON platform_audit_events
      FOR EACH ROW EXECUTE FUNCTION fail_platform_audit();`);
    await assert.rejects(platform.service.bootstrapOwner({ name: 'Owner', email: 'owner@example.invalid', password }), { statusCode: 503 });
    assert.equal((await db('platform_accounts')).length, 0);
    assert.equal((await db('platform_audit_events')).length, 0);
  });
  assert.equal(ownedDatabases.size, 0);
});

test('platform HTTP authentication requires MFA, isolates its namespace and rechecks live status', { timeout: 180000 }, async t => {
  await withIsolatedDatabase(async ({ db, pool }) => {
    await withApplication(pool, async ({ platform, request, login, setup, verify, enroll }) => {
      await t.test('password-only first-owner login creates a challenge and activates only after TOTP enrollment', async () => {
        const owner = await ownerFixture(db);
        const first = await login(owner, { email: ` ${owner.email.toUpperCase()} ` });
        assert.equal(first.status, 202, first.text);
        assert.equal(first.body.enrollment_required, true);
        assert.equal(first.body.mfa_required, true);
        assert.equal(first.body.token, undefined);
        assert.equal(first.cookie, undefined);
        assert.equal((await db('auth_sessions').where({ platform_account_id: owner.id })).length, 0);
        const start = await setup(first.body.challenge_token);
        assert.equal(start.status, 200, start.text);
        assert.match(start.body.secret, /^[A-Z2-7]+$/);
        assert.match(start.body.otpauth_uri, /^otpauth:\/\/totp\//);
        const factor = await db('mfa_factors').where({ platform_account_id: owner.id }).first();
        assert.equal(factor.secret_ciphertext.includes(start.body.secret), false);
        const finished = await verify(start.body.challenge_token, { totp_code: OTPAuth.URI.parse(start.body.otpauth_uri).generate() });
        assert.equal(finished.status, 200, finished.text);
        assert.match(finished.body.token, /^pf1\.[A-Za-z0-9_-]{43}$/);
        assert.deepEqual(finished.body.user, accountProfile(owner));
        assert.equal(finished.body.recovery_codes.length, 10);
        const current = await db('platform_accounts').where({ id: owner.id }).first();
        assert.equal(current.status, 'active');
        assert.equal(current.email_verified_at, null);
        const session = await db('auth_sessions').where({ platform_account_id: owner.id }).first();
        assert.equal(session.token_hash, hash(finished.body.token));
        assert.ok(session.mfa_factor_id);
        assert.ok(session.mfa_verified_at);
        assert.equal(session.daycare_id, null);
        assert.equal(session.user_id, null);
        const me = await request('GET', '/api/platform-only', undefined, authorization(finished.body.token));
        assert.equal(me.status, 200, me.text);
        assert.deepEqual(me.body.account, accountProfile(owner));
        assert.equal(me.body.user, null);
        assert.equal(me.body.daycareId, null);
        assert.equal(me.headers.get('cache-control'), 'no-store');
        assert.equal((await verify(start.body.challenge_token, { totp_code: '123456' })).status, 401);
      });

      await t.test('normal owner sign-in requires a new MFA challenge and cannot reuse an enrollment TOTP step', async () => {
        const owner = await ownerFixture(db);
        const enrolled = await enroll(owner);
        const again = await login(owner);
        assert.equal(again.status, 202, again.text);
        assert.equal(again.body.enrollment_required, false);
        assert.equal(again.body.purpose, 'login_mfa');
        assert.equal(again.body.token, undefined);
        const result = await verify(again.body.challenge_token,
          { totp_code: enrolled.totp.generate({ timestamp: Date.now() + 30000 }) });
        assert.equal(result.status, 200, result.text);
        assert.equal(result.body.recovery_codes, undefined);
        assert.equal((await request('GET', '/api/platform-auth/me', undefined, authorization(result.body.token))).status, 200);
      });

      await t.test('cookie sessions use their own proof and logout revokes only the platform session', async () => {
        const owner = await ownerFixture(db);
        const enrolled = await enroll(owner);
        const challenge = await login(owner);
        const completed = await verify(challenge.body.challenge_token,
          { recovery_code: enrolled.complete.body.recovery_codes[0] }, 'cookie');
        assert.equal(completed.status, 200, completed.text);
        assert.match(completed.cookie, /^platform_session=pf1\./);
        assert.equal(completed.body.token, undefined);
        assert.match(completed.body.csrf_token, /^[a-f0-9]{64}$/);
        assert.match(completed.headers.get('set-cookie'), /HttpOnly/);
        assert.match(completed.headers.get('set-cookie'), /SameSite=Strict/);
        const headers = { Cookie: completed.cookie, Origin: origin, 'X-CSRF-Token': completed.body.csrf_token };
        assert.equal((await request('POST', '/api/platform-only', {}, { Cookie: completed.cookie })).status, 403);
        assert.equal((await request('POST', '/api/platform-only', {}, headers)).status, 200);
        const denied = await request('POST', '/api/platform-auth/logout', {}, { Cookie: completed.cookie });
        assert.equal(denied.status, 403);
        assert.equal(denied.cookie, undefined);
        assert.equal((await request('GET', '/api/platform-auth/me', undefined, { Cookie: completed.cookie })).status, 200);
        const rawToken = completed.cookie.slice('platform_session='.length);
        assert.equal(completed.body.csrf_token, csrfToken(rawToken));
        const loggedOut = await request('POST', '/api/platform-auth/logout', {}, headers);
        assert.equal(loggedOut.status, 200, loggedOut.text);
        assert.equal((await request('GET', '/api/platform-auth/me', undefined, { Cookie: completed.cookie })).status, 401);
        assert.equal((await request('GET', '/api/platform-auth/me', undefined, authorization(enrolled.complete.body.token))).status, 200);
        assert.equal((await request('POST', '/api/platform-auth/logout', {}, headers)).status, 200);
        assert.equal((await db('auth_sessions').where({ token_hash: hash(rawToken) }).first()).revoked_at !== null, true);
      });

      await t.test('platform tokens cannot enter daycare authentication and no token namespaces fall back', async () => {
        const owner = await ownerFixture(db);
        const enrolled = await enroll(owner);
        const pfToken = enrolled.complete.body.token;
        assert.equal((await request('GET', '/api/daycare-auth/me', undefined, authorization(pfToken))).status, 401);
        for (const wrong of [token('dc1'), 'legacy.jwt.signature']) {
          assert.equal((await request('GET', '/api/platform-auth/me', undefined, authorization(wrong))).status, 401);
        }
        assert.equal((await request('GET', '/api/platform-auth/me', undefined, { Cookie: `daycare_session=${pfToken}` })).status, 401);
        assert.equal((await request('GET', '/api/platform-auth/me', undefined,
          { Authorization: `Bearer ${pfToken}`, Cookie: `platform_session=${token('pf1')}` })).status, 401);
      });

      await t.test('daycare MFA challenges cannot reveal a secret or create a platform session', async () => {
        const suffix = randomBytes(5).toString('hex');
        await db('roles').insert({ id: 1, name: 'admin' }).onConflict('id').ignore();
        const [daycare] = await db('daycares').insert({ name: 'Challenge daycare', slug: `challenge-${suffix}`,
          login_code: `challenge-${suffix}`, contact_email: `challenge-${suffix}@example.invalid`, status: 'active' }).returning('*');
        const [admin] = await db('users').insert({ name: 'Daycare admin', email: `admin-${suffix}@example.invalid`,
          role_id: 1, daycare_id: daycare.id, status: 'active', password_hash: passwordHash }).returning('*');
        const challengeToken = token('mc1');
        const [challenge] = await db('auth_challenges').insert({ daycare_id: daycare.id, user_id: admin.id,
          purpose: 'mfa_enrollment', token_hash: hash(challengeToken), expires_at: new Date(Date.now() + 300000) }).returning('*');
        for (const result of [await setup(challengeToken), await verify(challengeToken, { totp_code: '123456' })]) {
          assert.equal(result.status, 401, result.text);
          assert.equal(result.body.secret, undefined);
          assert.equal(result.body.token, undefined);
          assert.equal(result.cookie, undefined);
        }
        assert.deepEqual(await db('auth_challenges').where({ id: challenge.id }).first(), challenge);
        assert.equal((await db('mfa_factors').where({ user_id: admin.id })).length, 0);
        assert.equal((await db('auth_sessions').where({ user_id: admin.id })).length, 0);
      });

      await t.test('revoked factors, suspended accounts, revoked/expired sessions and missing MFA proof all deny access', async () => {
        const owner = await ownerFixture(db);
        const enrolled = await enroll(owner);
        const headers = authorization(enrolled.complete.body.token);
        const factor = await db('mfa_factors').where({ platform_account_id: owner.id }).first();
        await db('mfa_factors').where({ id: factor.id }).update({ revoked_at: new Date() });
        assert.equal((await request('GET', '/api/platform-auth/me', undefined, headers)).status, 401);
        await db('mfa_factors').where({ id: factor.id }).update({ revoked_at: null });
        await db('platform_accounts').where({ id: owner.id }).update({ status: 'suspended' });
        assert.equal((await request('GET', '/api/platform-auth/me', undefined, headers)).status, 401);
        assert.equal((await login(owner)).status, 401);
        await db('platform_accounts').where({ id: owner.id }).update({ status: 'active' });
        const orphanToken = token('pf1');
        await db('auth_sessions').insert({ platform_account_id: owner.id, token_hash: hash(orphanToken),
          created_at: new Date(Date.now() - 60000), expires_at: new Date(Date.now() + 60000) });
        assert.equal((await request('GET', '/api/platform-auth/me', undefined, authorization(orphanToken))).status, 401);
        await db('auth_sessions').where({ token_hash: hash(enrolled.complete.body.token) }).update({
          created_at: new Date(Date.now() - 120000), expires_at: new Date(Date.now() - 60000),
        });
        assert.equal((await request('GET', '/api/platform-auth/me', undefined, headers)).status, 401);
        assert.equal((await request('POST', '/api/platform-auth/logout', {}, headers)).status, 200);
      });

      await t.test('unknown and disabled credentials share a denial; request validation and origin checks precede mutations', async () => {
        const owner = await ownerFixture(db, 'disabled');
        const wrong = await login(owner, { password: 'Wrong-test-password-123!' });
        const disabled = await login(owner);
        const unknown = await login({ email: 'unknown@example.invalid' });
        for (const result of [wrong, disabled, unknown]) {
          assert.equal(result.status, 401, result.text);
          assert.deepEqual(result.body, wrong.body);
          assert.equal(JSON.stringify(result.body).includes(password), false);
        }
        const count = Number((await db('auth_challenges').count('* AS count').first()).count);
        assert.equal((await request('POST', '/api/platform-auth/login', { email: owner.email, password, daycare_id: 1 })).status, 422);
        assert.equal((await request('POST', '/api/platform-auth/login', { email: owner.email, password }, { Origin: 'https://evil.example.invalid' })).status, 403);
        assert.equal((await request('POST', '/api/platform-auth/mfa/setup', { challenge_token: 'invalid' }, { Origin: 'https://evil.example.invalid' })).status, 403);
        assert.equal((await request('POST', '/api/platform-auth/register', {})).status, 403);
        assert.equal(Number((await db('auth_challenges').count('* AS count').first()).count), count);
      });

      await t.test('canonical account attempt budget persists across failed password transactions', async () => {
        const owner = await ownerFixture(db);
        for (let index = 0; index < 20; index++) {
          const denied = await login(owner, { email: index % 2 ? owner.email.toUpperCase() : ` ${owner.email} `, password: 'Wrong-password-492!' });
          assert.equal(denied.status, 401, denied.text);
        }
        assert.equal((await login(owner)).status, 429);
        assert.equal((await db('auth_challenges').where({ platform_account_id: owner.id })).length, 0);
      });
    });
  });
  assert.equal(ownedDatabases.size, 0);
});
