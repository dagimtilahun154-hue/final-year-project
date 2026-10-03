'use strict';
/**
 * Migration 006 — Events Calendar
 * Tables: events
 * Depends on: 002_core_identity (users)
 * SRS Refs: FR-EVT-01–07, FR-DB-02
 * Architecture Plan: §5.6
 */

exports.up = async (knex) => {
  await knex.schema.createTable('events', (t) => {
    t.increments('id').primary();
    t.integer('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('title', 200).notNullable();
    t.date('event_date').notNullable();
    t.time('event_time');
    t.text('description');
    t.string('event_type', 30).notNullable();
    t.boolean('cancelled').notNullable().defaultTo(false);
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`ALTER TABLE events ADD CONSTRAINT chk_events_type CHECK (event_type IN ('holiday','meeting','activity_day','special_program','closing_date'))`);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('events');
};
