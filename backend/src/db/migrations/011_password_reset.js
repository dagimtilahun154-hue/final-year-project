'use strict';
/**
 * Migration 011 — Password Reset Tokens
 * Table: password_reset_tokens
 * Depends on: 002_core_identity (users)
 * SRS Refs: FR-UAM-07, NFR-SEC-03
 */
exports.up = async (knex) => {
  const exists = await knex.schema.hasTable('password_reset_tokens');
  if (!exists) {
    await knex.schema.createTable('password_reset_tokens', (t) => {
      t.increments('id').primary();
      t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('token_hash', 255).notNullable().unique();
      t.timestamp('expires_at', { useTz: true }).notNullable();
      t.boolean('used').notNullable().defaultTo(false);
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    await knex.raw(`CREATE INDEX idx_prt_user ON password_reset_tokens(user_id)`);
    await knex.raw(`CREATE INDEX idx_prt_token ON password_reset_tokens(token_hash) WHERE used = FALSE`);
  }
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('password_reset_tokens');
};
