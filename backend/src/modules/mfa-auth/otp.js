'use strict';

const OTPAuth = require('otpauth');

function createTotp(secret, label = 'Account') {
  return new OTPAuth.TOTP({
    issuer: 'Ankelba', label, algorithm: 'SHA1', digits: 6, period: 30,
    secret: secret || new OTPAuth.Secret({ size: 20 }),
  });
}

function verifiedStep(secret, token, timestamp, previousStep) {
  if (typeof token !== 'string' || !/^\d{6}$/.test(token)) return null;
  const totp = createTotp(secret);
  // Zero means the current time step. It is a successful verification too.
  const delta = totp.validate({ token, timestamp, window: 1 });
  if (delta === null) return null;
  const step = totp.counter({ timestamp }) + delta;
  if (previousStep !== null && previousStep !== undefined && BigInt(step) <= BigInt(previousStep)) return null;
  return step;
}

function factorAad(principal, factorId) {
  const scope = principal.kind === 'daycare' ? principal.daycare_id : 'platform';
  return `mfa-factor:${principal.kind}:${scope}:${principal.id}:${factorId}`;
}

module.exports = { createTotp, verifiedStep, factorAad };
