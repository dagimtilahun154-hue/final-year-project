'use strict';

const crypto = require('node:crypto');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = prefix => `${prefix}.${crypto.randomBytes(32).toString('base64url')}`;
const failure = (statusCode, message) => Object.assign(new Error(message), { statusCode });
function safeError(error) {
  if ([400, 401, 403, 404, 409, 415, 422, 429, 503].includes(error?.statusCode)) return error;
  return failure(503, 'Authentication service temporarily unavailable');
}

async function transaction(pool, work) {
  const client = await pool.connect();
  let discard;
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) { discard = rollbackError; }
    throw error;
  } finally { client.release(discard); }
}

function createSecurity({ pool, config }) {
  const keys = config.encryptionKeys;
  const activeId = config.activeKeyId;
  if (!keys || !Object.hasOwn(keys, activeId)) throw failure(503, 'Authentication encryption is not configured');
  for (const [id, key] of Object.entries(keys)) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || !Buffer.isBuffer(key) || key.length !== 32) {
      throw failure(503, 'Authentication encryption is not configured');
    }
  }
  const derive = (id, purpose) => {
    if (!Object.hasOwn(keys, id) || !['mfa-factor', 'local-mail', 'attempt-budget'].includes(purpose)) {
      throw failure(503, 'Authentication encryption is unavailable');
    }
    return Buffer.from(crypto.hkdfSync('sha256', keys[id],
      Buffer.from('ankelba.auth.security.v1'), Buffer.from(purpose), 32));
  };
  const vault = {
    keyId: activeId,
    encrypt(value, aad, purpose = 'mfa-factor') {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', derive(activeId, purpose), iv);
      cipher.setAAD(Buffer.from(`${purpose}:${aad}`, 'utf8'));
      const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
      return ['v1', activeId, iv.toString('base64url'), ciphertext.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
    },
    decrypt(envelope, aad, purpose = 'mfa-factor') {
      try {
        if (typeof envelope !== 'string' || envelope.length > 1000000) throw new Error('Invalid envelope');
        const [version, id, ivText, cipherText, tagText, extra] = envelope.split('.');
        if (version !== 'v1' || extra !== undefined || !/^[A-Za-z0-9_-]{1,40}$/.test(id)
          || !/^[A-Za-z0-9_-]{16}$/.test(ivText) || !/^[A-Za-z0-9_-]*$/.test(cipherText)
          || !/^[A-Za-z0-9_-]{22}$/.test(tagText)) throw new Error('Invalid envelope');
        const decode = text => {
          const value = Buffer.from(text, 'base64url');
          if (value.toString('base64url') !== text) throw new Error('Invalid envelope');
          return value;
        };
        const decipher = crypto.createDecipheriv('aes-256-gcm', derive(id, purpose), decode(ivText));
        decipher.setAAD(Buffer.from(`${purpose}:${aad}`, 'utf8'));
        decipher.setAuthTag(decode(tagText));
        return Buffer.concat([decipher.update(decode(cipherText)), decipher.final()]).toString('utf8');
      } catch { throw failure(503, 'Authentication encryption is unavailable'); }
    },
  };
  const budgetKey = key => crypto.createHmac('sha256', derive(activeId, 'attempt-budget')).update(String(key)).digest('hex');
  function bounds(limit, seconds) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 10000
      || !Number.isInteger(seconds) || seconds < 1 || seconds > 86400) throw new TypeError('Invalid authentication budget');
  }
  return {
    vault,
    async budget(executor = pool, key, limit, seconds) {
      bounds(limit, seconds);
      const result = await executor.query(`INSERT INTO auth_attempt_buckets (key_hash, window_started_at, attempts)
        VALUES ($1, clock_timestamp(), 1)
        ON CONFLICT (key_hash) DO UPDATE SET
          attempts = CASE WHEN auth_attempt_buckets.window_started_at <= clock_timestamp() - make_interval(secs => $3)
            THEN 1 ELSE LEAST(auth_attempt_buckets.attempts + 1, $2 + 1) END,
          window_started_at = CASE WHEN auth_attempt_buckets.window_started_at <= clock_timestamp() - make_interval(secs => $3)
            THEN clock_timestamp() ELSE auth_attempt_buckets.window_started_at END
        RETURNING attempts`, [budgetKey(key), limit, seconds]);
      return result.rows[0].attempts <= limit;
    },
    async budgetState(executor = pool, key, limit, seconds) {
      bounds(limit, seconds);
      const result = await executor.query(`SELECT attempts < $2 OR window_started_at <=
        clock_timestamp() - make_interval(secs => $3) AS allowed FROM auth_attempt_buckets WHERE key_hash = $1`,
      [budgetKey(key), limit, seconds]);
      return !result.rows.length || result.rows[0].allowed;
    },
  };
}

module.exports = { createSecurity, transaction, failure, safeError, hash, randomToken };
