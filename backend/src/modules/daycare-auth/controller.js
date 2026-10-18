'use strict';

const { credentials, checkOrigin, checkCookieProof, csrfToken } = require('./tokens');
const { unavailable, failure } = require('./errors');
const { profile } = require('./service');

function createController(service, config, mfa, recovery) {
  const cookieOptions = {
    httpOnly: true, secure: config.secureCookies, sameSite: 'strict', path: '/api',
  };
  function authenticated(res, result, transport) {
    const response = { user: result.user || profile(result.principal), expires_at: result.expires_at };
    if (result.recovery_codes) response.recovery_codes = result.recovery_codes;
    if (transport === 'bearer') response.token = result.token;
    else {
      res.cookie(config.cookieName, result.token, { ...cookieOptions, maxAge: config.sessionTtlSeconds * 1000 });
      response.csrf_token = csrfToken(result.token);
    }
    res.json(response);
  }
  return {
    async login(req, res, next) {
      try {
        checkOrigin(req, config.allowedOrigins);
        const result = await service.login(req.authInput);
        if (result.mfa_required) return res.status(202).json(result);
        authenticated(res, result, req.authInput.transport);
      } catch (error) { next(unavailable(error)); }
    },
    async mfaSetup(req, res, next) {
      try { checkOrigin(req, config.allowedOrigins); res.json(await mfa.setup(req.body, 'daycare')); }
      catch (error) { next(unavailable(error)); }
    },
    async mfaVerify(req, res, next) {
      try {
        checkOrigin(req, config.allowedOrigins);
        const { transport = 'cookie', ...input } = req.body;
        authenticated(res, await mfa.complete(input, 'daycare'), transport);
      } catch (error) { next(unavailable(error)); }
    },
    async changePassword(req, res, next) {
      try {
        if (!req.is('application/json')) throw failure(415, 'Content-Type must be application/json');
        res.json(await recovery.service.changePassword(req.user, req.body));
      } catch (error) { next(unavailable(error)); }
    },
    me(req, res) {
      const response = { user: req.user };
      if (req.authSession.transport === 'cookie') response.csrf_token = req.authSession.csrf_token;
      res.json(response);
    },
    async logout(req, res, next) {
      try {
        const credential = credentials(req, config.cookieName);
        checkCookieProof(req, credential, config.allowedOrigins);
        // Cookie removal is a state change too: only perform it after proof.
        // Expired/revoked tokens still pass proof without a live-session lookup.
        // Once authorized, browser logout remains possible during a DB outage.
        res.clearCookie(config.cookieName, cookieOptions);
        await service.logout(credential.token);
        res.json({ message: 'Logged out' });
      } catch (error) { next(unavailable(error)); }
    },
  };
}

function disabledProvisioning(req, res, next) {
  next(failure(403, 'Public account registration is disabled; contact your daycare administrator'));
}

module.exports = { createController, disabledProvisioning };
