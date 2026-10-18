'use strict';

const path = require('node:path');

function parseArguments(args) {
  if (args.length === 1 && args[0] === 'list') return { operation: 'list' };
  if (args.length === 2 && args[0] === 'view'
    && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(args[1])) {
    return { operation: 'view', id: args[1] };
  }
  throw new Error('Use list, or view <message UUID>. Viewing a message explicitly reveals its local test recovery link.');
}

function assertLocalPreview(env) {
  if (!['development', 'test'].includes(env.NODE_ENV) || env.DAYCARE_AUTH_ENABLED !== 'true') {
    throw new Error('The local test inbox requires the explicitly enabled development/test authentication preview.');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST || 'localhost')) {
    throw new Error('The local test inbox is restricted to local PostgreSQL.');
  }
}

async function main() {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  const input = parseArguments(process.argv.slice(2));
  assertLocalPreview(process.env);
  // Validate the complete configuration before constructing a database pool.
  const { loadDaycareAuthConfig } = require('../src/config/daycare-auth');
  const config = loadDaycareAuthConfig(process.env);
  const { Pool } = require('pg');
  const pool = new Pool({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'ankelba_dev', user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD,
    max: 1, connectionTimeoutMillis: 5000, statement_timeout: 15000, application_name: 'ankelba_local_test_inbox',
    options: '-c default_transaction_read_only=on' });
  try {
    const { createAccountRecovery } = require('../src/modules/account-recovery');
    const { inbox } = createAccountRecovery({ pool, config });
    const output = input.operation === 'list' ? await inbox.list() : await inbox.view(input.id);
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } finally { await pool.end(); }
}

if (require.main === module) main().catch(error => {
  // Never print database diagnostics, ciphertext, keys, or configuration values.
  const safe = error && (error.statusCode || (!error.code && !error.severity));
  process.stderr.write(`${safe ? error.message : 'Local test inbox unavailable.'}\n`);
  process.exitCode = 1;
});

module.exports = { parseArguments, assertLocalPreview, main };
