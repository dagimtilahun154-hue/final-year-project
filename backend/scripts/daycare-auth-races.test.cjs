'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { setTimeout: delay } = require('node:timers/promises');
const { createDaycareAuth } = require('../src/modules/daycare-auth');
const { createDaycareUsers } = require('../src/modules/daycare-users');
const { withIsolatedDatabase, ownedDatabases } = require('./helpers/auth-test-database.cjs');
const { securityConfig } = require('./helpers/auth-security-fixtures.cjs');

const config = securityConfig();

// Pause a real query after prior locks were acquired. All SQL still executes
// against PostgreSQL; these tests exercise transactions and lock contention.
function gatedPool(pool, fragment) {
  let enter;
  let release;
  let armed = true;
  const entered = new Promise(resolve => { enter = resolve; });
  const released = new Promise(resolve => { release = resolve; });
  return {
    entered, release,
    pool: {
      query: pool.query.bind(pool),
      async connect() {
        const client = await pool.connect();
        return {
          async query(sql, values) {
            if (armed && typeof sql === 'string' && sql.includes(fragment)) {
              armed = false;
              enter();
              await released;
            }
            return client.query(sql, values);
          },
          release: client.release.bind(client),
        };
      },
    },
  };
}

async function waitForSignal(signal) {
  let timer;
  try {
    await Promise.race([signal, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timed out arranging the transaction race')), 5000);
    })]);
  } finally { clearTimeout(timer); }
}

async function waitForBlockedQuery(pool, fragment) {
  const deadline = Date.now() + 5000;
  do {
    const result = await pool.query(`SELECT EXISTS (
      SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
        AND wait_event_type = 'Lock' AND query LIKE $1
    ) AS waiting`, [`%${fragment}%`]);
    if (result.rows[0].waiting) return;
    await delay(20);
  } while (Date.now() < deadline);
  assert.fail('The competing account operation did not wait for the transaction lock');
}

async function fixtures(db) {
  await db('roles').insert([{ id: 1, name: 'admin' }, { id: 3, name: 'parent' }]);
  const [daycare] = await db('daycares').insert({ name: 'Race fixture', slug: 'race-fixture',
    contact_email: 'race@example.invalid', status: 'active', login_code: 'race-fixture' }).returning('*');
  const password = 'Race-test-password';
  const passwordHash = await bcrypt.hash(password, 4);
  const [admin, parent] = await db('users').insert([
    { name: 'Race admin', email: 'race-admin@example.invalid', password_hash: passwordHash, role_id: 1, daycare_id: daycare.id },
    { name: 'Race parent', email: 'race-parent@example.invalid', password_hash: passwordHash, role_id: 3, daycare_id: daycare.id },
  ]).returning('*');
  return { daycare, admin: { ...admin, role: 'admin', principal_kind: 'daycare' }, parent,
    input: { daycare_code: daycare.login_code, email: parent.email, password, transport: 'bearer' } };
}

test('login and deactivation serialize so a new session cannot escape revocation', { timeout: 30000 }, async () => {
  await withIsolatedDatabase(async ({ db, pool }) => {
    const f = await fixtures(db);
    const gate = gatedPool(pool, 'INSERT INTO auth_sessions');
    const auth = createDaycareAuth({ pool: gate.pool, config });
    const users = createDaycareUsers({ pool, authenticate: auth.authenticate });
    const login = auth.service.login(f.input);
    let disable;
    try {
      await waitForSignal(gate.entered);
      disable = users.service.updateStatus(f.admin, f.parent.id, 'inactive');
      await waitForBlockedQuery(pool, 'FOR UPDATE OF u');
    } finally { gate.release(); }
    const [session] = await Promise.all([login, disable]);
    await assert.rejects(() => auth.service.authenticate(session.token), error => error.statusCode === 401);
    const stored = await db('auth_sessions').where({ user_id: f.parent.id }).first();
    assert.ok(stored.revoked_at);
    assert.equal((await db('users').where({ id: f.parent.id }).first()).status, 'inactive');
  });
  assert.equal(ownedDatabases.size, 0);
});

test('login waiting behind deactivation cannot issue a session after the account is disabled', { timeout: 30000 }, async () => {
  await withIsolatedDatabase(async ({ db, pool }) => {
    const f = await fixtures(db);
    const gate = gatedPool(pool, 'UPDATE users SET status');
    const auth = createDaycareAuth({ pool, config });
    const users = createDaycareUsers({ pool: gate.pool, authenticate: auth.authenticate });
    const disable = users.service.updateStatus(f.admin, f.parent.id, 'inactive');
    let deniedLogin;
    try {
      await waitForSignal(gate.entered);
      deniedLogin = assert.rejects(() => auth.service.login(f.input), error => error.statusCode === 401);
      await waitForBlockedQuery(pool, 'FOR UPDATE OF u');
    } finally { gate.release(); }
    await Promise.all([disable, deniedLogin]);
    assert.equal((await db('auth_sessions').where({ user_id: f.parent.id }).count('* AS count'))[0].count, '0');
  });
  assert.equal(ownedDatabases.size, 0);
});

test('login audit failure rolls back its session and returns no database details', { timeout: 30000 }, async () => {
  await withIsolatedDatabase(async ({ db, pool }) => {
    const f = await fixtures(db);
    await db.raw(`CREATE FUNCTION reject_test_login_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'test-only confidential failure detail'; END $$;
      CREATE TRIGGER reject_test_login_audit BEFORE INSERT ON audit_logs
      FOR EACH ROW WHEN (NEW.action = 'daycare.auth.login') EXECUTE FUNCTION reject_test_login_audit();`);
    const auth = createDaycareAuth({ pool, config });
    await assert.rejects(() => auth.service.login(f.input), error => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.message.includes('confidential'), false);
      return true;
    });
    assert.deepEqual(await db('auth_sessions').where({ user_id: f.parent.id }), []);
    assert.deepEqual(await db('audit_logs').where({ actor_id: f.parent.id }), []);
  });
  assert.equal(ownedDatabases.size, 0);
});

test('missing preview storage fails safely without issuing a legacy session', { timeout: 30000 }, async () => {
  await withIsolatedDatabase(async ({ db, pool }) => {
    const f = await fixtures(db);
    // Only the generated test database is changed. This models activation before
    // migration 015 and verifies a safe failure instead of legacy fallback.
    await db.schema.renameTable('auth_sessions', 'unavailable_auth_sessions');
    const auth = createDaycareAuth({ pool, config });
    await assert.rejects(() => auth.service.login(f.input), error => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.message, 'Authentication service temporarily unavailable');
      return true;
    });
    assert.deepEqual(await db('unavailable_auth_sessions'), []);
    assert.deepEqual(await db('audit_logs').where({ actor_id: f.parent.id }), []);
  });
  assert.equal(ownedDatabases.size, 0);
});
