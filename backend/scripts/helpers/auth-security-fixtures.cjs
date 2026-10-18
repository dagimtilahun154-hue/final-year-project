'use strict';

const assert = require('node:assert/strict');
const OTPAuth = require('otpauth');
// Public synthetic test material only. Runtime never provides a default key.
const key = Buffer.alloc(32, 0x42);
const environment = {
  AUTH_ENCRYPTION_KEYS: JSON.stringify({ fixture: key.toString('base64') }),
  AUTH_ENCRYPTION_ACTIVE_KEY_ID: 'fixture',
};
function securityConfig(overrides = {}) {
  return { enabled: true, encryptionKeys: { fixture: Buffer.from(key) }, activeKeyId: 'fixture',
    resetBaseUrl: 'http://localhost:8081', cookieName: 'daycare_session', platformCookieName: 'platform_session',
    sessionTtlSeconds: 28800, allowedOrigins: ['http://localhost:8081'], secureCookies: false, ...overrides };
}
const backupCodes = new Map();
async function finishMfa(request, first, keyName, transport = 'bearer', path = '/api/auth') {
  if (first.status !== 202 || !first.body.mfa_required) return first;
  assert.equal(first.body.token, undefined, 'Password alone must not issue a privileged session');
  let token = first.body.challenge_token;
  let proof;
  if (first.body.enrollment_required) {
    const setup = await request('POST', `${path}/mfa/setup`, { challenge_token: token });
    assert.equal(setup.status, 200, setup.text);
    token = setup.body.challenge_token;
    proof = { totp_code: OTPAuth.URI.parse(setup.body.otpauth_uri).generate() };
  } else {
    const code = backupCodes.get(keyName)?.shift();
    assert.ok(code, 'A repeated test login must use an unused backup code');
    proof = { recovery_code: code };
  }
  const result = await request('POST', `${path}/mfa/verify`, { challenge_token: token, ...proof, transport });
  assert.equal(result.status, 200, result.text);
  if (result.body.recovery_codes) backupCodes.set(keyName, [...result.body.recovery_codes]);
  return result;
}
module.exports = { securityConfig, securityEnvironment: environment, finishMfa };
