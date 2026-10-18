'use strict';

const express = require('express');
const { createRepository } = require('./repository');
const { createService } = require('./service');
const { createAuthenticate, noStore } = require('./middleware');
const { validateLogin } = require('./validator');
const { createController, disabledProvisioning } = require('./controller');
const { failure } = require('./errors');
const { createMfaAuth } = require('../mfa-auth');
const { createSecurity } = require('../auth-security');
const { createAccountRecovery } = require('../account-recovery');
const Joi = require('joi');

function createDaycareAuth({ pool, config = {}, mfa, security, recovery }) {
  if (!pool || typeof pool.query !== 'function' || typeof pool.connect !== 'function') {
    throw new TypeError('A PostgreSQL pool is required');
  }
  const settings = {
    cookieName: 'daycare_session', sessionTtlSeconds: 8 * 60 * 60,
    allowedOrigins: [], secureCookies: true, ...config,
  };
  if (!/^[A-Za-z0-9_-]+$/.test(settings.cookieName)
    || !Number.isSafeInteger(settings.sessionTtlSeconds) || settings.sessionTtlSeconds <= 0
    || !Array.isArray(settings.allowedOrigins)
    || settings.allowedOrigins.some(origin => typeof origin !== 'string' || origin === '*')
    || typeof settings.secureCookies !== 'boolean') {
    throw new TypeError('Invalid daycare authentication configuration');
  }
  security = security || createSecurity({ pool, config: settings });
  mfa = mfa || createMfaAuth({ pool, config: settings, security });
  recovery = recovery || createAccountRecovery({ pool, config: settings, security });
  const service = createService(createRepository(pool), settings, mfa, security, pool);
  const authenticate = createAuthenticate(service, settings);
  const controller = createController(service, settings, mfa, recovery);
  const router = express.Router();
  router.use(noStore);
  router.use(recovery.daycareRouter);
  router.post('/login', validateLogin, controller.login);
  router.get('/me', authenticate, controller.me);
  router.post('/logout', controller.logout);
  router.post('/register', disabledProvisioning);
  const challenge = Joi.string().pattern(/^mc1\.[A-Za-z0-9_-]{43}$/).required();
  const setup = Joi.object({ challenge_token: challenge }).unknown(false).required();
  const verify = Joi.object({ challenge_token: challenge, totp_code: Joi.string().pattern(/^\d{6}$/),
    recovery_code: Joi.string().pattern(/^[a-f0-9]{32}$/),
    transport: Joi.string().valid('cookie', 'bearer').default('cookie') }).xor('totp_code', 'recovery_code').unknown(false).required();
  const validate = schema => (req, res, next) => {
    if (!req.is('application/json')) return next(failure(415, 'Content-Type must be application/json'));
    const result = schema.validate(req.body);
    if (result.error) return next(failure(422, 'Invalid authentication request'));
    req.body = result.value; next();
  };
  router.post('/mfa/setup', validate(setup), controller.mfaSetup);
  router.post('/mfa/verify', validate(verify), controller.mfaVerify);
  router.patch('/change-password', authenticate, controller.changePassword);
  router.post('/change-password', authenticate, controller.changePassword);
  return { router, authenticate, service, disabledProvisioning, mfa, recovery, security };
}

module.exports = { createDaycareAuth, disabledProvisioning };
