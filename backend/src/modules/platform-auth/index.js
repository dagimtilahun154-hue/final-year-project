'use strict';

const express = require('express');
const { createMfaAuth } = require('../mfa-auth');
const { createSecurity } = require('../auth-security');
const { failure, unavailable } = require('../daycare-auth/errors');
const { noStore } = require('../daycare-auth/middleware');
const { createService } = require('./service');
const { credentials, checkOrigin, checkCookieProof, csrfToken } = require('./tokens');
const { jsonInput, validateLoginInput, validateSetupInput, validateVerifyInput } = require('./validator');

function createPlatformAuth({ pool, config = {}, mfa, security }) {
  if (!pool || typeof pool.query !== 'function' || typeof pool.connect !== 'function') throw new TypeError('A PostgreSQL pool is required');
  const settings = { platformCookieName: 'platform_session', sessionTtlSeconds: 28800,
    allowedOrigins: [], secureCookies: true, ...config };
  if (!/^[A-Za-z0-9_-]+$/.test(settings.platformCookieName)
    || settings.platformCookieName === (settings.cookieName || 'daycare_session')
    || !Number.isSafeInteger(settings.sessionTtlSeconds) || settings.sessionTtlSeconds <= 0
    || !Array.isArray(settings.allowedOrigins) || settings.allowedOrigins.some(origin => typeof origin !== 'string' || origin === '*')
    || typeof settings.secureCookies !== 'boolean') throw new TypeError('Invalid platform authentication configuration');
  security = security || createSecurity({ pool, config: settings });
  mfa = mfa || createMfaAuth({ pool, config: settings, security });
  const service = createService({ pool, config: settings, mfa, security });
  const cookieOptions = { httpOnly: true, secure: settings.secureCookies, sameSite: 'strict', path: '/api' };

  async function authenticate(req, res, next) {
    res.set('Cache-Control', 'no-store');
    try {
      const credential = credentials(req, settings.platformCookieName);
      const result = await service.authenticate(credential.token);
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) checkCookieProof(req, credential, settings.allowedOrigins);
      // Deliberately use a separate context; no daycare or legacy user principal.
      req.platformAccount = result.user;
      req.platformSession = { ...result.session, transport: credential.transport,
        ...(credential.transport === 'cookie' ? { csrf_token: csrfToken(credential.token) } : {}) };
      next();
    } catch (error) { next(unavailable(error)); }
  }

  const router = express.Router();
  router.use(noStore);
  router.post('/login', jsonInput(validateLoginInput), async (req, res, next) => {
    try {
      checkOrigin(req, settings.allowedOrigins);
      res.status(202).json(await service.login(req.platformInput));
    } catch (error) { next(unavailable(error)); }
  });
  router.post('/mfa/setup', jsonInput(validateSetupInput), async (req, res, next) => {
    try {
      checkOrigin(req, settings.allowedOrigins);
      res.json(await service.setup(req.platformInput));
    } catch (error) { next(unavailable(error)); }
  });
  router.post('/mfa/verify', jsonInput(validateVerifyInput), async (req, res, next) => {
    try {
      checkOrigin(req, settings.allowedOrigins);
      const { transport, ...input } = req.platformInput;
      const result = await service.verify(input);
      const response = { user: result.user, expires_at: result.expires_at,
        ...(result.recovery_codes ? { recovery_codes: result.recovery_codes } : {}) };
      if (transport === 'bearer') response.token = result.token;
      else {
        res.cookie(settings.platformCookieName, result.token, { ...cookieOptions, maxAge: settings.sessionTtlSeconds * 1000 });
        response.csrf_token = csrfToken(result.token);
      }
      res.json(response);
    } catch (error) { next(unavailable(error)); }
  });
  router.get('/me', authenticate, (req, res) => res.json({ user: req.platformAccount,
    ...(req.platformSession.transport === 'cookie' ? { csrf_token: req.platformSession.csrf_token } : {}) }));
  router.post('/logout', async (req, res, next) => {
    try {
      const credential = credentials(req, settings.platformCookieName);
      checkCookieProof(req, credential, settings.allowedOrigins);
      res.clearCookie(settings.platformCookieName, cookieOptions);
      await service.logout(credential.token);
      res.json({ message: 'Logged out' });
    } catch (error) { next(unavailable(error)); }
  });
  // The first owner is created through a deliberate local command, never HTTP.
  router.post('/register', (req, res, next) => next(failure(403, 'Public platform account registration is disabled')));
  return { router, authenticate, service };
}

module.exports = { createPlatformAuth };
