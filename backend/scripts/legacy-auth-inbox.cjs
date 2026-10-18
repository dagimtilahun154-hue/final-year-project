'use strict';

const path = require('node:path');
const { parseArguments } = require('./auth-test-inbox.cjs');

async function main() {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  const input = parseArguments(process.argv.slice(2));
  const { inbox } = require('../src/modules/auth/legacy-inbox');
  const result = input.operation === 'list' ? await inbox.list() : await inbox.view(input.id.toLowerCase());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) main().catch(() => {
  process.stderr.write('Local recovery inbox unavailable. Use list or view <message UUID> in a configured local development/test environment.\n');
  process.exitCode = 1;
});

module.exports = { main };
