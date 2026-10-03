'use strict';
/**
 * Migration 007 — Biometric
 * Tables: biometric_references, guardian_verification_events
 * Depends on: 002_core_identity (users, children, guardian_links)
 * SRS Refs: FR-BIO-01–10, FR-AUD-03
 * Architecture Plan: §5.7
 * NOTE: reference_data format is TBD-01 — column is TEXT until device/modality confirmed.
 */

exports.up = async (knex) => {
  // ─── biometric_references ───────────────────────────────────────────────
  // Tied directly to the guardian_link relationship (not just the user).
  // UNIQUE(guardian_link_id) — one active biometric reference per guardian-child link.
  // reference_data format TBD-01; consider encryption at rest when confirmed.
  await knex.schema.createTable('biometric_references', (t) => {
    t.increments('id').primary();
    t.integer('guardian_link_id').notNullable().references('id').inTable('guardian_links').onDelete('CASCADE');
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('reference_data').notNullable();  // format TBD-01
    t.integer('enrolled_by').notNullable().references('id').inTable('users');
    t.timestamp('enrolled_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.boolean('active').notNullable().defaultTo(true);
    t.unique(['guardian_link_id']);
  });

  // ─── guardian_verification_events ───────────────────────────────────────
  // Records the result of every guardian verification during checkout (FR-AUD-03).
  // Separated from attendance table (v2 normalization — avoids NULL-heavy columns).
  await knex.schema.createTable('guardian_verification_events', (t) => {
    t.increments('id').primary();
    t.integer('child_id').notNullable().references('id').inTable('children').onDelete('RESTRICT');
    t.integer('guardian_user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.integer('verified_by').notNullable().references('id').inTable('users');
    t.string('result', 20).notNullable();
    t.string('method', 20).notNullable();
    t.timestamp('verified_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`ALTER TABLE guardian_verification_events ADD CONSTRAINT chk_gve_result CHECK (result IN ('success','failed','manual_fallback'))`);
  await knex.raw(`ALTER TABLE guardian_verification_events ADD CONSTRAINT chk_gve_method CHECK (method IN ('biometric','manual'))`);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('guardian_verification_events');
  await knex.schema.dropTableIfExists('biometric_references');
};
