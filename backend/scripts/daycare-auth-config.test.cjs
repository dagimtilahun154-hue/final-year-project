'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadDaycareAuthConfig } = require('../src/config/daycare-auth');
const { securityEnvironment } = require('./helpers/auth-security-fixtures.cjs');

test('preview remains off without an explicit opt-in', () => {
  assert.equal(loadDaycareAuthConfig({}).enabled, false);
  assert.equal(loadDaycareAuthConfig({ NODE_ENV: 'production' }).enabled, false);
  assert.equal(loadDaycareAuthConfig({ DAYCARE_AUTH_ENABLED: 'false' }).enabled, false);
  for (const flag of ['', '1', 'yes', 'TRUE', ' false ']) {
    assert.throws(() => loadDaycareAuthConfig({ DAYCARE_AUTH_ENABLED: flag }), /must be true or false/);
  }
});

test('only explicit development and test environments may enable the preview', () => {
  for (const environment of [undefined, 'production', 'staging', 'Development']) {
    assert.throws(() => loadDaycareAuthConfig({ DAYCARE_AUTH_ENABLED: 'true', NODE_ENV: environment }), /production activation is unavailable/);
  }
  for (const environment of ['test', 'development']) {
    const config = loadDaycareAuthConfig({ ...securityEnvironment, DAYCARE_AUTH_ENABLED: 'true', NODE_ENV: environment });
    assert.equal(config.enabled, true);
    assert.equal(config.sessionTtlSeconds, 28800);
    assert.ok(Object.isFrozen(config));
    assert.ok(Object.isFrozen(config.allowedOrigins));
  }
});

test('session lifetime accepts only bounded integer seconds', () => {
  const base = { ...securityEnvironment, DAYCARE_AUTH_ENABLED: 'true', NODE_ENV: 'test' };
  for (const ttl of ['0', '-1', '299', '86401', 'NaN', '3600.5', '', '1e4']) {
    assert.throws(() => loadDaycareAuthConfig({ ...base, DAYCARE_SESSION_TTL_SECONDS: ttl }), /between 300 and 86400/);
  }
  assert.equal(loadDaycareAuthConfig({ ...base, DAYCARE_SESSION_TTL_SECONDS: '3600' }).sessionTtlSeconds, 3600);
});

test('preview origins are canonical exact origins with no wildcard or URL credentials', () => {
  const base = { ...securityEnvironment, DAYCARE_AUTH_ENABLED: 'true', NODE_ENV: 'test' };
  for (const origin of ['', '*', 'null', 'https://example.invalid/path', 'https://user:password@example.invalid', 'https://example.invalid?x=1', 'ftp://example.invalid']) {
    assert.throws(() => loadDaycareAuthConfig({ ...base, DAYCARE_AUTH_ALLOWED_ORIGINS: origin }), /exact HTTP\(S\) origins/);
  }
  const config = loadDaycareAuthConfig({ ...base, DAYCARE_AUTH_ALLOWED_ORIGINS: 'http://localhost:8081/, http://localhost:8081,https://example.invalid/' });
  assert.deepEqual(config.allowedOrigins, ['http://localhost:8081', 'https://example.invalid']);
  const fromFrontend = loadDaycareAuthConfig({ ...base, FRONTEND_URL: 'http://localhost:9000' });
  assert.ok(fromFrontend.allowedOrigins.includes('http://localhost:9000'));
});
