'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRepository } = require('../src/modules/daycare-users/repository');

function fixture({ rollbackError, commitError } = {}) {
  const queries = [];
  const releases = [];
  const client = {
    async query(statement) {
      queries.push(statement);
      if (statement === 'ROLLBACK' && rollbackError) throw rollbackError;
      if (statement === 'COMMIT' && commitError) throw commitError;
      return { rows: [] };
    },
    release(error) { releases.push(error); },
  };
  const repository = createRepository({ async connect() { return client; } });
  return { repository, client, queries, releases };
}

test('failed user transaction discards a connection when rollback also fails', async () => {
  const workError = new Error('Simulated account write failure');
  const rollbackError = new Error('Simulated connection loss during rollback');
  const { repository, queries, releases } = fixture({ rollbackError });

  await assert.rejects(repository.transaction(async () => { throw workError; }),
    (error) => error === workError);

  assert.deepEqual(queries, ['BEGIN', 'ROLLBACK']);
  assert.deepEqual(releases, [rollbackError]);
});

test('successful user transaction commits and releases a reusable connection', async () => {
  const { repository, client, queries, releases } = fixture();
  const record = { id: 10 };

  const result = await repository.transaction(async (transactionClient) => {
    assert.equal(transactionClient, client);
    return record;
  });

  assert.equal(result, record);
  assert.deepEqual(queries, ['BEGIN', 'COMMIT']);
  assert.deepEqual(releases, [undefined]);
});

test('failed user transaction preserves the work error after successful rollback', async () => {
  const workError = new Error('Simulated account write failure');
  const { repository, queries, releases } = fixture();

  await assert.rejects(repository.transaction(async () => { throw workError; }),
    (error) => error === workError);

  assert.deepEqual(queries, ['BEGIN', 'ROLLBACK']);
  assert.deepEqual(releases, [undefined]);
});

test('failed commit discards the connection when its cleanup rollback fails', async () => {
  const commitError = new Error('Simulated commit failure');
  const rollbackError = new Error('Simulated rollback failure');
  const { repository, queries, releases } = fixture({ commitError, rollbackError });

  await assert.rejects(repository.transaction(async () => 'result'),
    (error) => error === commitError);

  assert.deepEqual(queries, ['BEGIN', 'COMMIT', 'ROLLBACK']);
  assert.deepEqual(releases, [rollbackError]);
});
