'use strict';

// Temporary local delivery for the migration-013 legacy runtime. This directory
// is never served over HTTP. The later authentication preview has its own outbox.
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const DEFAULT_DIRECTORY = path.resolve(__dirname, '../../../.local/legacy-auth-inbox');
const ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const unavailable = () => Object.assign(new Error('Password recovery is unavailable. Please contact your daycare administrator.'), { statusCode: 503 });

function createLegacyInbox({ env = process.env, directory = DEFAULT_DIRECTORY } = {}) {
  function assertAvailable() {
    if (!['development', 'test'].includes(env.NODE_ENV)
      || !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST || 'localhost')
      || typeof env.JWT_SECRET !== 'string' || env.JWT_SECRET.length < 32) throw unavailable();
  }

  function key() {
    assertAvailable();
    return crypto.hkdfSync('sha256', Buffer.from(env.JWT_SECRET), Buffer.alloc(0),
      Buffer.from('ankelba-legacy-local-inbox-v1'), 32);
  }

  function messagePath(id) {
    if (!ID_PATTERN.test(id)) throw new Error('Invalid local message ID');
    return path.join(directory, `${id}.json`);
  }

  async function enqueue(payload) {
    assertAvailable();
    const id = crypto.randomUUID();
    const meta = { id, kind: 'password_reset', created_at: new Date().toISOString(), expires_at: payload.expires_at };
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
    cipher.setAAD(Buffer.from(JSON.stringify(meta)));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.writeFile(messagePath(id), JSON.stringify({ ...meta, iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }), { flag: 'wx', mode: 0o600 });
    return id;
  }

  async function list() {
    assertAvailable();
    const entries = await fs.readdir(directory).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    const result = [];
    for (const entry of entries) {
      const id = entry.replace(/\.json$/, '');
      if (!entry.endsWith('.json') || !ID_PATTERN.test(id)) continue;
      const row = JSON.parse(await fs.readFile(messagePath(id), 'utf8'));
      if (row.id === id && new Date(row.expires_at).getTime() > Date.now()) {
        result.push({ id, kind: row.kind, created_at: row.created_at, expires_at: row.expires_at });
      }
    }
    return result.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async function view(id) {
    assertAvailable();
    const row = JSON.parse(await fs.readFile(messagePath(id), 'utf8'));
    if (row.id !== id || !(new Date(row.expires_at).getTime() > Date.now())) throw new Error('Local message is unavailable or expired');
    const meta = { id: row.id, kind: row.kind, created_at: row.created_at, expires_at: row.expires_at };
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(row.iv, 'base64'));
    decipher.setAAD(Buffer.from(JSON.stringify(meta)));
    decipher.setAuthTag(Buffer.from(row.tag, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(row.ciphertext, 'base64')), decipher.final()]);
    return { ...meta, ...JSON.parse(plaintext.toString('utf8')) };
  }

  return { assertAvailable, enqueue, list, view };
}

module.exports = { createLegacyInbox, inbox: createLegacyInbox() };
