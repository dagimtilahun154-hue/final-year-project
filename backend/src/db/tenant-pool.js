'use strict';
const { AsyncLocalStorage } = require('node:async_hooks');
const context = new AsyncLocalStorage();
function withTenant(daycareId, work) {
  if (!Number.isSafeInteger(Number(daycareId)) || Number(daycareId) <= 0) throw new Error('Verified daycare context required');
  return context.run({ daycareId: Number(daycareId) }, work);
}
function createTenantPool(pool) {
  async function connect() {
    const client = await pool.connect();
    const daycare = context.getStore()?.daycareId;
    let transaction = false;
    let released = false;
    const establish = () => client.query("SELECT set_config('app.daycare_id',$1,true)", [daycare ? String(daycare) : '']);
    return {
      async query(sql, values) {
        if (released) throw new Error('Client already released');
        const command = (typeof sql === 'string' ? sql : sql.text).trim().replace(/;$/, '').toUpperCase();
        if (command === 'BEGIN' || command.startsWith('BEGIN ')) {
          if (transaction) throw new Error('Nested transaction is not supported');
          const result = await client.query(sql, values);
          transaction = true;
          await establish();
          return result;
        }
        if (command === 'COMMIT' || command === 'ROLLBACK') {
          const result = await client.query(sql, values);
          transaction = false;
          return result;
        }
        if (transaction) return client.query(sql, values);
        await client.query('BEGIN');
        try {
          await establish();
          const result = await client.query(sql, values);
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          throw error;
        }
      },
      release(error) {
        if (released) return;
        released = true;
        // Never return an open/aborted transaction to the pool.
        client.release(error || transaction ? true : undefined);
      },
    };
  }
  return {
    connect,
    async query(sql, values) {
      const client = await connect();
      try { return await client.query(sql, values); } finally { client.release(); }
    },
    end: () => pool.end(),
    withTenant,
  };
}
module.exports = { createTenantPool, withTenant };
