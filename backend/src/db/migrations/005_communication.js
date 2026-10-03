'use strict';
/**
 * Migration 005 — Communication
 * Tables: announcements, messages, alerts
 * Depends on: 002_core_identity (users), 001_lookup_tables (groups)
 * SRS Refs: FR-COM-01–08, FR-DB-02
 * Architecture Plan: §5.5
 */

exports.up = async (knex) => {
  // ─── announcements ──────────────────────────────────────────────────────
  // v2 fix: added announcement_type CHECK for meal_plan sub-tab support.
  // target_group_id is nullable by design (NULL = broadcast to 'all').
  await knex.schema.createTable('announcements', (t) => {
    t.increments('id').primary();
    t.integer('author_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('title', 200).notNullable();
    t.text('body').notNullable();
    t.string('announcement_type', 30).notNullable().defaultTo('general');
    t.string('audience', 20).notNullable();
    t.integer('target_group_id').references('id').inTable('groups').onDelete('SET NULL');
    t.timestamp('expires_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`ALTER TABLE announcements ADD CONSTRAINT chk_ann_type CHECK (announcement_type IN ('general','alert','meal_plan'))`);
  await knex.raw(`ALTER TABLE announcements ADD CONSTRAINT chk_ann_audience CHECK (audience IN ('all','group','individual'))`);

  // ─── messages ───────────────────────────────────────────────────────────
  // 1:1 direct messages. read_at IS NULL means unread.
  // Threads grouped in application layer by sender+recipient pair.
  await knex.schema.createTable('messages', (t) => {
    t.increments('id').primary();
    t.integer('sender_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.integer('recipient_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('subject', 200);
    t.text('body').notNullable();
    t.timestamp('read_at', { useTz: true });  // NULL = unread
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // ─── alerts ─────────────────────────────────────────────────────────────
  // Urgent broadcast or targeted alerts. target_user_id NULL = broadcast to all.
  await knex.schema.createTable('alerts', (t) => {
    t.increments('id').primary();
    t.integer('author_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('title', 200).notNullable();
    t.string('urgency', 20).notNullable();
    t.string('recipient_scope', 20).notNullable();
    t.integer('target_user_id').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`ALTER TABLE alerts ADD CONSTRAINT chk_alerts_urgency CHECK (urgency IN ('normal','high'))`);
  await knex.raw(`ALTER TABLE alerts ADD CONSTRAINT chk_alerts_scope CHECK (recipient_scope IN ('all','individual'))`);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('alerts');
  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('announcements');
};
