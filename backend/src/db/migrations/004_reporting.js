'use strict';
/**
 * Migration 004 — Reporting
 * Tables: daily_reports, report_meals, report_activities, health_records
 * Depends on: 002_core_identity (children, users)
 * SRS Refs: FR-DAR-01–08, FR-HIR-01–06, FR-DB-02
 * Architecture Plan: §5.4
 */

exports.up = async (knex) => {
  // ─── daily_reports (header row only) ────────────────────────────────────
  // 3NF fix from v1: meals_notes, learning_activities were single TEXT columns
  // violating 1NF → extracted to report_meals and report_activities child tables.
  // UNIQUE(child_id, report_date) enforces one report per child per day.
  await knex.schema.createTable('daily_reports', (t) => {
    t.increments('id').primary();
    t.integer('child_id').notNullable().references('id').inTable('children').onDelete('RESTRICT');
    t.integer('caregiver_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.date('report_date').notNullable();
    t.integer('sleep_duration_min');
    t.text('sleep_notes');
    t.string('mood', 20);
    t.text('behavior_notes');
    t.text('general_observations');
    t.timestamp('submitted_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['child_id', 'report_date']);
  });

  await knex.raw(`ALTER TABLE daily_reports ADD CONSTRAINT chk_dr_sleep_dur CHECK (sleep_duration_min >= 0)`);
  await knex.raw(`ALTER TABLE daily_reports ADD CONSTRAINT chk_dr_mood CHECK (mood IN ('happy','calm','fussy','tired','excited'))`);

  // ─── report_meals ───────────────────────────────────────────────────────
  // 1NF fix: each meal/snack is a separate row (not comma list in one column).
  // Allows querying "what did child X eat on date Y" efficiently.
  await knex.schema.createTable('report_meals', (t) => {
    t.increments('id').primary();
    t.integer('report_id').notNullable().references('id').inTable('daily_reports').onDelete('CASCADE');
    t.string('meal_type', 30).notNullable();
    t.text('description').notNullable();
    t.string('portion', 20);
  });

  await knex.raw(`ALTER TABLE report_meals ADD CONSTRAINT chk_rm_meal_type CHECK (meal_type IN ('breakfast','morning_snack','lunch','afternoon_snack','dinner'))`);
  await knex.raw(`ALTER TABLE report_meals ADD CONSTRAINT chk_rm_portion CHECK (portion IN ('good','fair','poor','none'))`);

  // ─── report_activities ──────────────────────────────────────────────────
  // 1NF fix: each activity is a row, not a comma-list.
  // Allows filtering by activity type across date ranges.
  await knex.schema.createTable('report_activities', (t) => {
    t.increments('id').primary();
    t.integer('report_id').notNullable().references('id').inTable('daily_reports').onDelete('CASCADE');
    t.string('activity_type', 20).notNullable();
    t.text('description').notNullable();
    t.string('location', 30);
  });

  await knex.raw(`ALTER TABLE report_activities ADD CONSTRAINT chk_ra_activity_type CHECK (activity_type IN ('learning','play'))`);
  await knex.raw(`ALTER TABLE report_activities ADD CONSTRAINT chk_ra_location CHECK (location IN ('indoor','outdoor','n_a'))`);

  // ─── health_records ──────────────────────────────────────────────────────
  // Records both health observations AND incidents (record_type differentiates).
  // parent_notified flag used by notification workflow (FR-HIR-05).
  await knex.schema.createTable('health_records', (t) => {
    t.increments('id').primary();
    t.integer('child_id').notNullable().references('id').inTable('children').onDelete('RESTRICT');
    t.integer('recorded_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('record_type', 20).notNullable();
    t.text('description').notNullable();
    t.string('severity', 20);
    t.boolean('parent_notified').notNullable().defaultTo(false);
    t.timestamp('recorded_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`ALTER TABLE health_records ADD CONSTRAINT chk_hr_record_type CHECK (record_type IN ('health','incident'))`);
  await knex.raw(`ALTER TABLE health_records ADD CONSTRAINT chk_hr_severity CHECK (severity IN ('low','moderate','high'))`);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('health_records');
  await knex.schema.dropTableIfExists('report_activities');
  await knex.schema.dropTableIfExists('report_meals');
  await knex.schema.dropTableIfExists('daily_reports');
};
