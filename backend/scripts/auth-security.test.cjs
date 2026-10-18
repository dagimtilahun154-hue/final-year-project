'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createSecurity } = require('../src/modules/auth-security');
const { loadDaycareAuthConfig } = require('../src/config/daycare-auth');
const { parseArguments, assertLocalPreview } = require('./auth-test-inbox.cjs');
const { securityEnvironment } = require('./helpers/auth-security-fixtures.cjs');

test('preview fails closed for missing, malformed or unselected encryption keys', () => {
  const base = { NODE_ENV: 'test', DAYCARE_AUTH_ENABLED: 'true' };
  const invalid = [undefined, '{}', '[]', 'null', 'invalid-json', JSON.stringify({ bad: 'not-a-key' }),
    JSON.stringify({ fixture: Buffer.alloc(31).toString('base64') }),
    JSON.stringify({ 'invalid.id': Buffer.alloc(32).toString('base64') })];
  for (const keys of invalid) assert.throws(() => loadDaycareAuthConfig({ ...base, AUTH_ENCRYPTION_KEYS: keys,
    AUTH_ENCRYPTION_ACTIVE_KEY_ID: 'fixture' }), /valid AUTH_ENCRYPTION_KEYS/);
  for (const active of [undefined, '', 'missing', 'toString']) assert.throws(() => loadDaycareAuthConfig({
    ...base, ...securityEnvironment, AUTH_ENCRYPTION_ACTIVE_KEY_ID: active }), /valid AUTH_ENCRYPTION_KEYS/);
});

test('reset links use an exact trusted origin with no path, query, fragment or credentials', () => {
  const base = { NODE_ENV: 'test', DAYCARE_AUTH_ENABLED: 'true', ...securityEnvironment,
    DAYCARE_AUTH_ALLOWED_ORIGINS: 'http://localhost:8081' };
  for (const url of ['https://attacker.invalid', 'http://localhost:8081/path', 'http://localhost:8081?x=1',
    'http://localhost:8081#x', 'http://user:secret@localhost:8081']) {
    assert.throws(() => loadDaycareAuthConfig({ ...base, AUTH_RESET_BASE_URL: url }), /must be an allowed origin/);
  }
  assert.equal(loadDaycareAuthConfig(base).resetBaseUrl, 'http://localhost:8081');
});

test('key rotation decrypts existing ciphertext only while its old key is retained', () => {
  const old = randomBytes(32);
  const current = randomBytes(32);
  const vault = keys => createSecurity({ pool: {}, config: keys }).vault;
  const original = vault({ encryptionKeys: { old }, activeKeyId: 'old' });
  const envelope = original.encrypt('synthetic-local-message', 'mail:tenant:12:user:9:message:123', 'local-mail');
  const rotated = vault({ encryptionKeys: { old, current }, activeKeyId: 'current' });
  assert.equal(rotated.decrypt(envelope, 'mail:tenant:12:user:9:message:123', 'local-mail'), 'synthetic-local-message');
  assert.match(rotated.encrypt('value', 'factor:1'), /^v1\.current\./);
  const withoutOld = vault({ encryptionKeys: { current }, activeKeyId: 'current' });
  assert.throws(() => withoutOld.decrypt(envelope, 'mail:tenant:12:user:9:message:123', 'local-mail'),
    error => error.statusCode === 503 && !error.message.includes('synthetic'));
});

test('authenticated encryption rejects altered principals, purposes and noncanonical envelopes', () => {
  const vault = createSecurity({ pool: {}, config: { encryptionKeys: { test: randomBytes(32) }, activeKeyId: 'test' } }).vault;
  const envelope = vault.encrypt('example secret', 'factor:daycare:7:user:8');
  for (const [aad, purpose] of [['factor:daycare:7:user:9', 'mfa-factor'], ['factor:daycare:7:user:8', 'local-mail']]) {
    assert.throws(() => vault.decrypt(envelope, aad, purpose), error => error.statusCode === 503);
  }
  const parts = envelope.split('.');
  const last = parts[4].at(-1);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  parts[4] = parts[4].slice(0, -1) + alphabet[alphabet.indexOf(last) + 1];
  assert.throws(() => vault.decrypt(parts.join('.'), 'factor:daycare:7:user:8'), error => error.statusCode === 503);
  assert.throws(() => vault.decrypt(envelope + '.extra', 'factor:daycare:7:user:8'), error => error.statusCode === 503);
});

test('local inbox rejects unsafe environments and accepts only explicit metadata or message commands', () => {
  assert.deepEqual(parseArguments(['list']), { operation: 'list' });
  assert.deepEqual(parseArguments(['view', '12345678-1234-1234-1234-123456789abc']),
    { operation: 'view', id: '12345678-1234-1234-1234-123456789abc' });
  for (const args of [[], ['all'], ['view'], ['view', 'invalid'], ['list', 'extra']]) assert.throws(() => parseArguments(args));
  for (const env of [{}, { NODE_ENV: 'production', DAYCARE_AUTH_ENABLED: 'true' },
    { NODE_ENV: 'development', DAYCARE_AUTH_ENABLED: 'false' },
    { NODE_ENV: 'test', DAYCARE_AUTH_ENABLED: 'true', DB_HOST: 'remote.example.invalid' }]) assert.throws(() => assertLocalPreview(env));
  assert.doesNotThrow(() => assertLocalPreview({ NODE_ENV: 'test', DAYCARE_AUTH_ENABLED: 'true', DB_HOST: 'localhost' }));
});
