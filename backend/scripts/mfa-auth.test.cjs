'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const OTPAuth = require('otpauth');
const { withIsolatedDatabase, ownedDatabases } = require('./helpers/auth-test-database.cjs');
const { createMfaAuth } = require('../src/modules/mfa-auth');
const { createTotp, verifiedStep, factorAad } = require('../src/modules/mfa-auth/otp');
const { createSecurity, hash } = require('../src/modules/auth-security');

const keys = { test_key: randomBytes(32) };
const config = { sessionTtlSeconds: 28800, encryptionKeys: keys, activeKeyId: 'test_key' };
const denied = status => error => error.statusCode === status && !/SELECT|INSERT|UPDATE|constraint|ciphertext|token_hash/i.test(error.message);

function clockFixture() {
  let milliseconds = Math.floor(Date.now() / 30000) * 30000 + 5000;
  return { now: () => milliseconds, advance: (steps = 1) => { milliseconds += steps * 30000; } };
}

async function fixtures(db, kind = 'daycare', platformStatus = 'active') {
  const suffix = randomBytes(5).toString('hex');
  if (kind === 'platform') {
    const [row] = await db('platform_accounts').insert({ name: 'Test platform owner',
      email: `owner-${suffix}@example.invalid`, password_hash: 'test-fixture-only', status: platformStatus }).returning('*');
    return { ...row, kind, principal_kind: kind, platform_account_id: row.id };
  }
  await db('roles').insert([{ id: 1, name: 'admin' }, { id: 2, name: 'caregiver' }, { id: 3, name: 'parent' }]).onConflict('id').ignore();
  const [daycare] = await db('daycares').insert({ name: `MFA daycare ${suffix}`, slug: `mfa-${suffix}`,
    login_code: `mfa-${suffix}`, contact_email: `center-${suffix}@example.invalid`, status: 'active' }).returning('*');
  const [row] = await db('users').insert({ name: 'MFA test administrator', email: `admin-${suffix}@example.invalid`,
    password_hash: 'test-fixture-only', role_id: 1, status: 'active', daycare_id: daycare.id, profile_complete: true }).returning('*');
  return { ...row, kind, principal_kind: kind, user_id: row.id, role: 'admin', daycare_name: daycare.name,
    daycare_status: daycare.status };
}

async function begin(pool, mfa, principal) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (principal.kind === 'daycare') {
      await client.query('SELECT id FROM daycares WHERE id = $1 FOR SHARE', [principal.daycare_id]);
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [principal.id]);
    } else await client.query('SELECT id FROM platform_accounts WHERE id = $1 FOR UPDATE', [principal.id]);
    const result = await mfa.begin(client, principal);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

function codeFor(secret, clock, offset = 0) {
  return createTotp(secret).generate({ timestamp: clock.now() + offset * 30000 });
}

function badCode(secret, clock) {
  for (let value = 0; value < 10; value += 1) {
    const code = String(value).padStart(6, '0');
    if (createTotp(secret).validate({ token: code, timestamp: clock.now(), window: 1 }) === null) return code;
  }
  throw new Error('Unable to choose an invalid fixture code');
}

async function enroll({ pool, db }, kind = 'daycare', platformStatus = 'active') {
  const principal = await fixtures(db, kind, platformStatus);
  const clock = clockFixture();
  const mfa = createMfaAuth({ pool, config, clock: clock.now });
  const initial = await begin(pool, mfa, principal);
  const setup = await mfa.setup({ challenge_token: initial.challenge_token }, kind);
  const complete = await mfa.complete({ challenge_token: setup.challenge_token, totp_code: codeFor(setup.secret, clock) }, kind);
  return { principal, clock, mfa, initial, setup, complete };
}

async function ownFactor(db, principal) {
  return principal.kind === 'daycare'
    ? db('mfa_factors').where({ daycare_id: principal.daycare_id, user_id: principal.id }).whereNotNull('confirmed_at').whereNull('revoked_at').first()
    : db('mfa_factors').where({ platform_account_id: principal.id }).whereNotNull('confirmed_at').whereNull('revoked_at').first();
}

test('TOTP follows RFC 6238 SHA1 vectors with six digits and accepts delta zero', () => {
  const secret = OTPAuth.Secret.fromUTF8('12345678901234567890').base32;
  const vectors = [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'],
    [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']];
  for (const [seconds, expected] of vectors) {
    assert.equal(createTotp(secret).generate({ timestamp: seconds * 1000 }), expected);
    assert.equal(verifiedStep(secret, expected, seconds * 1000, null), Math.floor(seconds / 30));
    assert.equal(verifiedStep(secret, expected, seconds * 1000, Math.floor(seconds / 30)), null);
  }
  const timestamp = 1234567890000;
  assert.equal(verifiedStep(secret, createTotp(secret).generate({ timestamp: timestamp - 30000 }), timestamp, null), Math.floor(timestamp / 30000) - 1);
  assert.equal(verifiedStep(secret, createTotp(secret).generate({ timestamp: timestamp + 30000 }), timestamp, null), Math.floor(timestamp / 30000) + 1);
  assert.equal(verifiedStep(secret, '12345', timestamp, null), null);
  assert.equal(verifiedStep(secret, '1234567', timestamp, null), null);
});

test('MFA encryption authenticates the factor, principal, tenant, purpose, key and ciphertext', () => {
  const security = createSecurity({ pool: {}, config });
  const principal = { kind: 'daycare', daycare_id: 12, id: 9 };
  const factorId = '1fbe7bb2-37dd-4a68-bae3-e98d48135362';
  const secret = createTotp().secret.base32;
  const encrypted = security.vault.encrypt(secret, factorAad(principal, factorId));
  assert.equal(encrypted.includes(secret), false);
  assert.equal(security.vault.decrypt(encrypted, factorAad(principal, factorId)), secret);
  for (const aad of [factorAad({ ...principal, id: 10 }, factorId),
    factorAad({ ...principal, daycare_id: 13 }, factorId),
    factorAad({ kind: 'platform', id: 9 }, factorId), factorAad(principal, 'another-factor')]) {
    assert.throws(() => security.vault.decrypt(encrypted, aad), denied(503));
  }
  assert.throws(() => security.vault.decrypt(encrypted, factorAad(principal, factorId), 'local-mail'), denied(503));
  const parts = encrypted.split('.');
  parts[3] = `${parts[3][0] === 'A' ? 'B' : 'A'}${parts[3].slice(1)}`;
  assert.throws(() => security.vault.decrypt(parts.join('.'), factorAad(principal, factorId)), denied(503));
  assert.throws(() => security.vault.decrypt(encrypted.replace('.test_key.', '.unknown_key.'), factorAad(principal, factorId)), denied(503));
});

test('MFA enrollment, challenges, proof limits and sessions use isolated databases', { timeout: 120000 }, async t => {
  await withIsolatedDatabase(async environment => {
    const { db, pool } = environment;

    await t.test('password challenge grants no session, setup rotates it, and enrollment creates hash-only recovery codes once', async () => {
      const principal = await fixtures(db);
      const clock = clockFixture();
      const mfa = createMfaAuth({ pool, config, clock: clock.now });
      const initial = await begin(pool, mfa, principal);
      assert.equal(initial.mfa_required, true);
      assert.equal(initial.enrollment_required, true);
      assert.match(initial.challenge_token, /^mc1\.[A-Za-z0-9_-]{43}$/);
      assert.equal(initial.token, undefined);
      assert.equal((await db('auth_sessions').where({ user_id: principal.id })).length, 0);
      const setup = await mfa.setup({ challenge_token: initial.challenge_token });
      assert.notEqual(setup.challenge_token, initial.challenge_token);
      assert.match(setup.secret, /^[A-Z2-7]{32}$/);
      assert.equal(OTPAuth.URI.parse(setup.otpauth_uri).secret.base32, setup.secret);
      assert.equal((await db('auth_challenges').where({ token_hash: hash(initial.challenge_token) }).first()).consumed_at instanceof Date, true);
      await assert.rejects(mfa.setup({ challenge_token: initial.challenge_token }), denied(401));
      await assert.rejects(mfa.setup({ challenge_token: setup.challenge_token }), denied(401));
      const pending = await db('mfa_factors').where({ user_id: principal.id }).first();
      assert.equal(pending.confirmed_at, null);
      assert.equal(pending.secret_ciphertext.includes(setup.secret), false);
      const completed = await mfa.complete({ challenge_token: setup.challenge_token, totp_code: codeFor(setup.secret, clock) });
      assert.equal(completed.principal.id, principal.id);
      assert.equal(completed.principal.role, 'admin');
      assert.match(completed.token, /^dc1\.[A-Za-z0-9_-]{43}$/);
      assert.equal(completed.recovery_codes.length, 10);
      assert.equal(new Set(completed.recovery_codes).size, 10);
      for (const code of completed.recovery_codes) assert.match(code, /^[a-f0-9]{32}$/);
      const recoveryRows = await db('mfa_recovery_codes').where({ factor_id: pending.id });
      assert.equal(recoveryRows.length, 10);
      assert.deepEqual(new Set(recoveryRows.map(row => row.code_hash)), new Set(completed.recovery_codes.map(hash)));
      const session = await db('auth_sessions').where({ token_hash: hash(completed.token) }).first();
      assert.equal(session.daycare_id, principal.daycare_id);
      assert.equal(session.user_id, principal.id);
      assert.equal(session.platform_account_id, null);
      assert.equal(session.mfa_factor_id, pending.id);
      assert.ok(session.mfa_verified_at);
      await assert.rejects(mfa.complete({ challenge_token: setup.challenge_token, totp_code: codeFor(setup.secret, clock) }), denied(401));
      const audit = JSON.stringify(await db('audit_logs').where({ actor_id: principal.id }));
      for (const secret of [setup.secret, initial.challenge_token, setup.challenge_token, completed.token, ...completed.recovery_codes]) {
        assert.equal(audit.includes(secret), false);
      }
    });

    await t.test('platform enrollment requires its namespace, activates a pending account, and never asserts email verification', async () => {
      const principal = await fixtures(db, 'platform', 'pending_activation');
      const clock = clockFixture();
      const mfa = createMfaAuth({ pool, config, clock: clock.now });
      const initial = await begin(pool, mfa, principal);
      await assert.rejects(mfa.setup({ challenge_token: initial.challenge_token }), denied(401));
      assert.equal((await db('auth_challenges').where({ token_hash: hash(initial.challenge_token) }).first()).consumed_at, null);
      const setup = await mfa.setup({ challenge_token: initial.challenge_token }, 'platform');
      await assert.rejects(mfa.complete({ challenge_token: setup.challenge_token, totp_code: codeFor(setup.secret, clock) }), denied(401));
      const completed = await mfa.complete({ challenge_token: setup.challenge_token, totp_code: codeFor(setup.secret, clock) }, 'platform');
      assert.match(completed.token, /^pf1\.[A-Za-z0-9_-]{43}$/);
      assert.equal(completed.principal.kind, 'platform');
      const account = await db('platform_accounts').where({ id: principal.id }).first();
      assert.equal(account.status, 'active');
      assert.equal(account.email_verified_at, null);
      const session = await db('auth_sessions').where({ token_hash: hash(completed.token) }).first();
      assert.equal(session.platform_account_id, principal.id);
      assert.equal(session.daycare_id, null);
      assert.equal(session.user_id, null);
      assert.equal((await db('platform_audit_events').where({ platform_account_id: principal.id }).orderBy('id', 'desc').first()).actor_kind, 'platform');
    });

    await t.test('fresh password challenges revoke older challenges and pending factors without replacing a confirmed factor', async () => {
      const principal = await fixtures(db);
      const clock = clockFixture();
      const mfa = createMfaAuth({ pool, config, clock: clock.now });
      const first = await begin(pool, mfa, principal);
      const setup = await mfa.setup({ challenge_token: first.challenge_token });
      const pending = await db('mfa_factors').where({ user_id: principal.id }).first();
      const next = await begin(pool, mfa, principal);
      assert.ok((await db('mfa_factors').where({ id: pending.id }).first()).revoked_at);
      await assert.rejects(mfa.complete({ challenge_token: setup.challenge_token, totp_code: codeFor(setup.secret, clock) }), denied(401));
      const replacement = await mfa.setup({ challenge_token: next.challenge_token });
      await mfa.complete({ challenge_token: replacement.challenge_token, totp_code: codeFor(replacement.secret, clock) });
      const confirmed = await ownFactor(db, principal);
      const login = await begin(pool, mfa, principal);
      assert.equal(login.enrollment_required, false);
      assert.equal(login.purpose, 'login_mfa');
      await assert.rejects(mfa.setup({ challenge_token: login.challenge_token }), denied(401));
      assert.equal((await ownFactor(db, principal)).id, confirmed.id);
    });

    await t.test('normal TOTP consumes one challenge, enforces a monotonic absolute time step, and returns no new backups', async () => {
      const { principal, mfa, clock, setup } = await enroll(environment);
      clock.advance();
      const login = await begin(pool, mfa, principal);
      const futureCode = codeFor(setup.secret, clock, 1);
      const completed = await mfa.complete({ challenge_token: login.challenge_token, totp_code: futureCode });
      assert.equal(completed.recovery_codes, undefined);
      const next = await begin(pool, mfa, principal);
      await assert.rejects(mfa.complete({ challenge_token: next.challenge_token, totp_code: codeFor(setup.secret, clock) }), denied(401));
      clock.advance();
      await assert.rejects(mfa.complete({ challenge_token: next.challenge_token, totp_code: codeFor(setup.secret, clock) }), denied(401));
      clock.advance();
      assert.match((await mfa.complete({ challenge_token: next.challenge_token, totp_code: codeFor(setup.secret, clock) })).token, /^dc1\./);
    });

    await t.test('concurrent valid TOTP verification creates at most one session', async () => {
      const { principal, mfa, clock, setup } = await enroll(environment);
      clock.advance();
      const login = await begin(pool, mfa, principal);
      const before = Number((await db('auth_sessions').where({ user_id: principal.id }).count('* AS n').first()).n);
      const results = await Promise.allSettled(Array.from({ length: 4 }, () =>
        mfa.complete({ challenge_token: login.challenge_token, totp_code: codeFor(setup.secret, clock) })));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      for (const result of results.filter(result => result.status === 'rejected')) assert.equal(result.reason.statusCode, 401);
      assert.equal(Number((await db('auth_sessions').where({ user_id: principal.id }).count('* AS n').first()).n), before + 1);
    });

    await t.test('recovery codes are single-use under concurrency and preserve the enrolled factor', async () => {
      const { principal, mfa, complete } = await enroll(environment);
      const factor = await ownFactor(db, principal);
      const login = await begin(pool, mfa, principal);
      const results = await Promise.allSettled(Array.from({ length: 3 }, () =>
        mfa.complete({ challenge_token: login.challenge_token, recovery_code: complete.recovery_codes[0] })));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(results.find(result => result.status === 'fulfilled').value.recovery_codes, undefined);
      const second = await begin(pool, mfa, principal);
      await assert.rejects(mfa.complete({ challenge_token: second.challenge_token, recovery_code: complete.recovery_codes[0] }), denied(401));
      assert.equal((await ownFactor(db, principal)).id, factor.id);
      assert.equal((await db('mfa_recovery_codes').where({ factor_id: factor.id }).whereNotNull('consumed_at')).length, 1);
      assert.equal((await db('mfa_recovery_codes').where({ factor_id: factor.id })).length, 10);
    });

    await t.test('backup codes cannot enroll a factor, cross principals, or combine with a TOTP proof', async () => {
      const first = await enroll(environment);
      const other = await enroll(environment);
      const otherLogin = await begin(pool, other.mfa, other.principal);
      await assert.rejects(other.mfa.complete({ challenge_token: otherLogin.challenge_token, recovery_code: first.complete.recovery_codes[0] }), denied(401));
      const login = await begin(pool, first.mfa, first.principal);
      await assert.rejects(first.mfa.complete({ challenge_token: login.challenge_token,
        totp_code: codeFor(first.setup.secret, first.clock), recovery_code: first.complete.recovery_codes[0] }), denied(401));
      const pending = await fixtures(db);
      const pendingMfa = createMfaAuth({ pool, config });
      const pendingChallenge = await begin(pool, pendingMfa, pending);
      const pendingSetup = await pendingMfa.setup({ challenge_token: pendingChallenge.challenge_token });
      await assert.rejects(pendingMfa.complete({ challenge_token: pendingSetup.challenge_token, recovery_code: first.complete.recovery_codes[0] }), denied(401));
      assert.equal(await ownFactor(db, pending), undefined);
    });

    await t.test('five failed proofs persist, revoke the challenge, and survive new password challenges', async () => {
      const { principal, mfa, clock, setup } = await enroll(environment);
      clock.advance();
      const bad = badCode(setup.secret, clock);
      const login = await begin(pool, mfa, principal);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await assert.rejects(mfa.complete({ challenge_token: login.challenge_token, totp_code: bad }), denied(401));
      }
      const row = await db('auth_challenges').where({ token_hash: hash(login.challenge_token) }).first();
      assert.equal(row.attempts, 5);
      assert.ok(row.revoked_at);
      const fresh = await begin(pool, mfa, principal);
      await assert.rejects(mfa.complete({ challenge_token: fresh.challenge_token, totp_code: codeFor(setup.secret, clock) }), denied(429));
      assert.equal((await db('auth_challenges').where({ token_hash: hash(fresh.challenge_token) }).first()).attempts, 0);
    });

    await t.test('principal failure budget cannot be bypassed by acquiring a new password challenge after every failed code', async () => {
      const { principal, mfa, clock, setup } = await enroll(environment);
      clock.advance();
      const bad = badCode(setup.secret, clock);
      const tokens = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const login = await begin(pool, mfa, principal);
        tokens.push(hash(login.challenge_token));
        await assert.rejects(mfa.complete({ challenge_token: login.challenge_token, totp_code: bad }), denied(401));
      }
      assert.deepEqual((await db('auth_challenges').whereIn('token_hash', tokens)).map(row => row.attempts), [1, 1, 1, 1, 1]);
      const fresh = await begin(pool, mfa, principal);
      await assert.rejects(mfa.complete({ challenge_token: fresh.challenge_token, totp_code: codeFor(setup.secret, clock) }), denied(429));
      const unaffected = await enroll(environment);
      const otherLogin = await begin(pool, unaffected.mfa, unaffected.principal);
      assert.match((await unaffected.mfa.complete({ challenge_token: otherLogin.challenge_token,
        recovery_code: unaffected.complete.recovery_codes[0] })).token, /^dc1\./);
    });

    await t.test('expired, revoked and unknown challenges fail without disclosing their state', async () => {
      const { principal, mfa, clock, setup } = await enroll(environment);
      const expired = await begin(pool, mfa, principal);
      await db('auth_challenges').where({ token_hash: hash(expired.challenge_token) })
        .update({ created_at: new Date(clock.now() - 120000), expires_at: new Date(clock.now() - 60000) });
      const revoked = await begin(pool, mfa, principal);
      await db('auth_challenges').where({ token_hash: hash(revoked.challenge_token) }).update({ revoked_at: new Date(clock.now()) });
      for (const token of [expired.challenge_token, revoked.challenge_token, `mc1.${randomBytes(32).toString('base64url')}`, 'bad-token']) {
        await assert.rejects(mfa.complete({ challenge_token: token, totp_code: codeFor(setup.secret, clock) }), error =>
          error.statusCode === 401 && error.message === 'Authentication verification failed');
      }
    });

    await t.test('time spent acquiring locks cannot extend challenges or old TOTP codes', async () => {
      for (const operation of ['setup', 'expired-proof', 'old-otp']) {
        const f = operation === 'setup' ? { principal: await fixtures(db), clock: clockFixture() } : await enroll(environment);
        const mfa = f.mfa || createMfaAuth({ pool, config, clock: f.clock.now });
        if (operation !== 'setup') f.clock.advance();
        const challenge = await begin(pool, mfa, f.principal);
        const code = operation === 'old-otp' ? codeFor(f.setup.secret, f.clock) : undefined;
        const delayedPool = {
          query: pool.query.bind(pool),
          async connect() {
            const client = await pool.connect();
            return { release: client.release.bind(client), async query(sql, values) {
              const result = await client.query(sql, values);
              // Deterministically model elapsed time while acquiring a real
              // PostgreSQL account lock; no wall-clock sleeps are needed.
              if (typeof sql === 'string' && sql.includes('FOR UPDATE OF u')) f.clock.advance(operation === 'old-otp' ? 3 : 11);
              return result;
            } };
          },
        };
        const delayed = createMfaAuth({ pool: delayedPool, config, clock: f.clock.now });
        const before = Number((await db('auth_sessions').where({ user_id: f.principal.id }).count('* AS n').first()).n);
        if (operation === 'setup') await assert.rejects(delayed.setup({ challenge_token: challenge.challenge_token }), denied(401));
        else await assert.rejects(delayed.complete({ challenge_token: challenge.challenge_token,
          ...(code ? { totp_code: code } : { recovery_code: f.complete.recovery_codes[0] }) }), denied(401));
        assert.equal(Number((await db('auth_sessions').where({ user_id: f.principal.id }).count('* AS n').first()).n), before);
      }
    });

    await t.test('live daycare, administrator role and account state are checked again before proof acceptance', async () => {
      for (const change of ['daycare', 'user', 'role', 'factor']) {
        const { principal, mfa, complete } = await enroll(environment);
        const login = await begin(pool, mfa, principal);
        if (change === 'daycare') await db('daycares').where({ id: principal.daycare_id }).update({ status: 'suspended' });
        if (change === 'user') await db('users').where({ id: principal.id }).update({ status: 'inactive' });
        if (change === 'role') await db('users').where({ id: principal.id }).update({ role_id: 3 });
        if (change === 'factor') await db('mfa_factors').where({ user_id: principal.id }).update({ revoked_at: new Date() });
        const before = Number((await db('auth_sessions').where({ user_id: principal.id }).count('* AS n').first()).n);
        await assert.rejects(mfa.complete({ challenge_token: login.challenge_token, recovery_code: complete.recovery_codes[0] }), denied(401));
        assert.equal(Number((await db('auth_sessions').where({ user_id: principal.id }).count('* AS n').first()).n), before);
      }
    });

    await t.test('suspended platform accounts cannot complete existing password challenges', async () => {
      const { principal, mfa, complete } = await enroll(environment, 'platform');
      const login = await begin(pool, mfa, principal);
      await db('platform_accounts').where({ id: principal.id }).update({ status: 'suspended' });
      await assert.rejects(mfa.complete({ challenge_token: login.challenge_token, recovery_code: complete.recovery_codes[0] }, 'platform'), denied(401));
    });

    await t.test('ciphertext swapping or corruption never issues a session or exposes internal errors', async () => {
      const first = await enroll(environment);
      const second = await enroll(environment);
      const firstFactor = await ownFactor(db, first.principal);
      const secondFactor = await ownFactor(db, second.principal);
      first.clock.advance();
      const login = await begin(pool, first.mfa, first.principal);
      await db('mfa_factors').where({ id: firstFactor.id }).update({ secret_ciphertext: secondFactor.secret_ciphertext });
      await assert.rejects(first.mfa.complete({ challenge_token: login.challenge_token,
        totp_code: codeFor(second.setup.secret, first.clock) }), denied(503));
      const challenge = await db('auth_challenges').where({ token_hash: hash(login.challenge_token) }).first();
      assert.equal(challenge.attempts, 0);
      assert.equal(challenge.consumed_at, null);
    });

    await t.test('session and audit failures roll back confirmation, codes, challenge consumption and session creation together', async () => {
      const principal = await fixtures(db);
      const clock = clockFixture();
      const mfa = createMfaAuth({ pool, config, clock: clock.now });
      const initial = await begin(pool, mfa, principal);
      const setup = await mfa.setup({ challenge_token: initial.challenge_token });
      const wrappedPool = {
        query: (...args) => pool.query(...args),
        async connect() {
          const client = await pool.connect();
          return { release: (...args) => client.release(...args),
            query(sql, values) {
              if (typeof sql === 'string' && sql.includes('INSERT INTO auth_sessions')) throw new Error('Test SQL failure with secret details');
              return client.query(sql, values);
            } };
        },
      };
      const failing = createMfaAuth({ pool: wrappedPool, config, clock: clock.now });
      await assert.rejects(failing.complete({ challenge_token: setup.challenge_token, totp_code: codeFor(setup.secret, clock) }), denied(503));
      const factor = await db('mfa_factors').where({ user_id: principal.id }).first();
      assert.equal(factor.confirmed_at, null);
      assert.equal(factor.last_used_step, null);
      assert.equal((await db('mfa_recovery_codes').where({ factor_id: factor.id })).length, 0);
      assert.equal((await db('auth_challenges').where({ token_hash: hash(setup.challenge_token) }).first()).consumed_at, null);
      assert.match((await mfa.complete({ challenge_token: setup.challenge_token, totp_code: codeFor(setup.secret, clock) })).token, /^dc1\./);
    });
  });
  assert.equal(ownedDatabases.size, 0);
});
