'use strict';

const defaultOrigins = [
  'http://localhost:8081', 'http://127.0.0.1:8081',
  'http://localhost:3000', 'http://127.0.0.1:3000',
];

function loadDaycareAuthConfig(env = process.env) {
  const flag = env.DAYCARE_AUTH_ENABLED;
  if (flag !== undefined && flag !== 'false' && flag !== 'true') {
    throw new Error('DAYCARE_AUTH_ENABLED must be true or false.');
  }
  const enabled = flag === 'true';
  if (enabled && !['development', 'test'].includes(env.NODE_ENV)) {
    throw new Error('Daycare authentication preview requires NODE_ENV=development or test; production activation is unavailable until the remaining security checkpoints are complete.');
  }

  let sessionTtlSeconds = 8 * 60 * 60;
  let origins = defaultOrigins;
  let encryptionKeys;
  let activeKeyId;
  let resetBaseUrl;
  if (enabled) {
    const ttl = env.DAYCARE_SESSION_TTL_SECONDS;
    if (ttl !== undefined) {
      if (!/^\d+$/.test(ttl) || Number(ttl) < 300 || Number(ttl) > 86400) {
        throw new Error('DAYCARE_SESSION_TTL_SECONDS must be between 300 and 86400.');
      }
      sessionTtlSeconds = Number(ttl);
    }
    origins = env.DAYCARE_AUTH_ALLOWED_ORIGINS === undefined
      ? [...defaultOrigins, ...(env.FRONTEND_URL ? [env.FRONTEND_URL] : [])]
      : env.DAYCARE_AUTH_ALLOWED_ORIGINS.split(',');
    origins = origins.map(value => {
      let parsed;
      try { parsed = new URL(value.trim()); } catch {
        throw new Error('Daycare authentication origins must be exact HTTP(S) origins.');
      }
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password
        || parsed.pathname !== '/' || parsed.search || parsed.hash) {
        throw new Error('Daycare authentication origins must be exact HTTP(S) origins.');
      }
      return parsed.origin;
    });
    try {
      const values = JSON.parse(env.AUTH_ENCRYPTION_KEYS || '{}');
      if (!values || typeof values !== 'object' || Array.isArray(values)
        || Object.keys(values).length < 1 || Object.keys(values).length > 8) throw new Error('Invalid keyring');
      encryptionKeys = Object.create(null);
      for (const [id, encoded] of Object.entries(values)) {
        if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || typeof encoded !== 'string'
          || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error('Invalid keyring');
        const decoded = Buffer.from(encoded, 'base64');
        if (decoded.length !== 32 || decoded.toString('base64') !== encoded) throw new Error('Invalid keyring');
        encryptionKeys[id] = decoded;
      }
      activeKeyId = env.AUTH_ENCRYPTION_ACTIVE_KEY_ID;
      if (typeof activeKeyId !== 'string' || !Object.hasOwn(encryptionKeys, activeKeyId)) throw new Error('Missing active key');
      Object.freeze(encryptionKeys);
    } catch { throw new Error('Preview authentication requires a valid AUTH_ENCRYPTION_KEYS keyring and AUTH_ENCRYPTION_ACTIVE_KEY_ID.'); }
    const resetOrigin = env.AUTH_RESET_BASE_URL || origins[0];
    let resetUrl;
    try { resetUrl = new URL(resetOrigin); } catch { throw new Error('AUTH_RESET_BASE_URL must be an allowed origin.'); }
    if (resetUrl.pathname !== '/' || resetUrl.search || resetUrl.hash || resetUrl.username || resetUrl.password
      || !origins.includes(resetUrl.origin)) throw new Error('AUTH_RESET_BASE_URL must be an allowed origin.');
    resetBaseUrl = resetUrl.origin;
  }

  return Object.freeze({
    enabled,
    cookieName: 'daycare_session',
    sessionTtlSeconds,
    allowedOrigins: Object.freeze([...new Set(origins)]),
    // This preview is exclusively for local development and isolated tests.
    secureCookies: false,
    platformCookieName: 'platform_session',
    encryptionKeys, activeKeyId, resetBaseUrl,
  });
}

module.exports = { loadDaycareAuthConfig };
