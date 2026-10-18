'use strict';

// Deliberate local-development bootstrap. Password input is read from a pipe;
// it never appears in process arguments, environment variables, or log output.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function parseArguments(args) {
  if (args.length !== 4) throw new Error('Use --name <owner name> --email <email>; provide the password only through standard input.');
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!['--name', '--email'].includes(key) || values[key] !== undefined || !args[index + 1]) {
      throw new Error('Only --name and --email arguments are accepted.');
    }
    values[key] = args[index + 1];
  }
  return { name: values['--name'], email: values['--email'] };
}

async function main() {
  const identity = parseArguments(process.argv.slice(2));
  if (!['development', 'test'].includes(process.env.NODE_ENV)
    || process.env.DAYCARE_AUTH_ENABLED !== 'true') {
    throw new Error('Owner bootstrap requires the explicitly enabled development/test authentication preview.');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || 'localhost')) {
    throw new Error('Owner bootstrap is restricted to local PostgreSQL.');
  }
  if (process.stdin.isTTY) throw new Error('Pipe the owner password through standard input; interactive or argument passwords are not accepted.');
  if (process.env.PLATFORM_OWNER_PASSWORD || process.env.OWNER_PASSWORD || process.env.BOOTSTRAP_PASSWORD) {
    throw new Error('Owner passwords must be supplied only through standard input.');
  }
  // Configuration validation occurs before importing/constructing a database pool.
  const { loadDaycareAuthConfig } = require('../src/config/daycare-auth');
  const config = loadDaycareAuthConfig(process.env);
  if (!config.enabled || !config.activeKeyId || !config.encryptionKeys) throw new Error('Authentication encryption keys must be configured.');
  let password = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    password += chunk;
    if (Buffer.byteLength(password, 'utf8') > 1024) throw new Error('Invalid password input.');
  }
  password = password.replace(/\r?\n$/, '');
  if (password.includes('\n') || password.includes('\r')) throw new Error('Supply exactly one password line.');
  const { validateBootstrapInput } = require('../src/modules/platform-auth/validator');
  const input = validateBootstrapInput({ ...identity, password });
  const { Pool } = require('pg');
  const pool = new Pool({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'ankelba_dev', user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD,
    max: 1, connectionTimeoutMillis: 5000, statement_timeout: 15000, application_name: 'ankelba_platform_owner_bootstrap' });
  try {
    const { createPlatformAuth } = require('../src/modules/platform-auth');
    const owner = await createPlatformAuth({ pool, config }).service.bootstrapOwner(input);
    process.stdout.write(`Platform owner ${owner.id} created in pending activation. Sign in through platform authentication and enroll MFA to activate it.\n`);
  } finally {
    password = '';
    input.password = '';
    await pool.end();
  }
}

if (require.main === module) main().catch(error => {
  // Database diagnostics may carry sensitive data; return only known safe errors.
  const safe = error && (error.statusCode || (!error.code && !error.severity));
  process.stderr.write(`${safe ? error.message : 'Platform owner bootstrap failed; no credentials were logged.'}\n`);
  process.exitCode = 1;
});

module.exports = { parseArguments, main };
