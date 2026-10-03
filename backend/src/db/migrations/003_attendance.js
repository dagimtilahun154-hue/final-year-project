'use strict';
/**
 * Migration 003 — Attendance
 * Tables: attendance
 * Depends on: 002_core_identity (children, users)
 * SRS Refs: FR-ATT-01–07, FR-DB-02
 * Architecture Plan: §5.3
 */

exports.up = async (knex) => {
  // ─── attendance ─────────────────────────────────────────────────────────
  // v2 note: verification_method removed from this table (moved to
  // guardian_verification_events in migration 008) — avoids NULL-heavy
  // columns on non-checkout records. (§5.3 note)
  // Duplicate active check-in prevention is enforced at service layer,
  // not via DB CHECK, because CHECK cannot query current state.
  await knex.schema.createTable('attendance', (t) => {
    t.increments('id').primary();
    t.integer('child_id').notNullable().references('id').inTable('children').onDelete('RESTRICT');
    t.integer('recorded_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('event_type', 20).notNullable();
    t.timestamp('event_time', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`ALTER TABLE attendance ADD CONSTRAINT chk_att_event_type CHECK (event_type IN ('checkin','checkout','absent'))`);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('attendance');
};
