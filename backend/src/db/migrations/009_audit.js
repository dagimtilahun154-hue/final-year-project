'use strict';
/**
 * Migration 009 — Audit Logs
 * Tables: audit_logs
 * Depends on: 002_core_identity (users)
 * SRS Refs: FR-AUD-01–05, NFR-SEC-06
 * Architecture Plan: §5.9
 */

exports.up = async (knex) => {
  // ─── audit_logs ─────────────────────────────────────────────────────────
  // metadata JSONB allows flexible context per action type without extra columns.
  // Example: {"previous_role": "caregiver", "new_role": "admin"}
  // actor_id is SET NULL on delete (not CASCADE) so audit history is preserved
  // even if the actor's account is deleted.
  await knex.schema.createTable('audit_logs', (t) => {
    t.increments('id').primary();
    t.integer('actor_id').references('id').inTable('users').onDelete('SET NULL');
    t.string('action', 80).notNullable();
    t.string('target_table', 60).notNullable();
    t.integer('target_id');
    t.jsonb('metadata');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('audit_logs');
};
