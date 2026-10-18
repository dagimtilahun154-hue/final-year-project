'use strict';

const crypto = require('node:crypto');
const { failure } = require('./errors');

const TOKEN_PATTERN = /^dc1\.[A-Za-z0-9_-]{43}$/;
const newToken = () => `dc1.${crypto.randomBytes(32).toString('base64url')}`;
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const csrfToken = token => crypto.createHmac('sha256', token)
  .update('ankelba.daycare.csrf.v1').digest('hex');

function credentials(req, cookieName) {
  const authorization = req.headers.authorization;
  const cookie = req.cookies && req.cookies[cookieName];
  if (authorization !== undefined) {
    if (typeof authorization !== 'string' || !/^Bearer dc1\.[A-Za-z0-9_-]{43}$/.test(authorization)) {
      throw failure(401, 'Authentication required');
    }
    const token = authorization.slice(7);
    if (cookie !== undefined && cookie !== token) throw failure(401, 'Authentication required');
    return { token, transport: 'bearer' };
  }
  if (typeof cookie !== 'string' || !TOKEN_PATTERN.test(cookie)) {
    throw failure(401, 'Authentication required');
  }
  return { token: cookie, transport: 'cookie' };
}

function checkOrigin(req, allowedOrigins) {
  const origin = req.headers.origin;
  if (origin !== undefined && (typeof origin !== 'string' || !allowedOrigins.includes(origin))) {
    throw failure(403, 'Request origin is not allowed');
  }
}

function checkCookieProof(req, credential, allowedOrigins) {
  if (credential.transport !== 'cookie') return;
  checkOrigin(req, allowedOrigins);
  const supplied = req.headers['x-csrf-token'];
  if (typeof supplied !== 'string' || !/^[0-9a-f]{64}$/.test(supplied)) {
    throw failure(403, 'CSRF verification failed');
  }
  const actual = Buffer.from(supplied, 'hex');
  const expected = Buffer.from(csrfToken(credential.token), 'hex');
  if (!crypto.timingSafeEqual(actual, expected)) throw failure(403, 'CSRF verification failed');
}

module.exports = { TOKEN_PATTERN, newToken, hashToken, csrfToken, credentials, checkOrigin, checkCookieProof };
