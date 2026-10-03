'use strict';
/**
 * Migration 002 — Core Identity Tables
 * Tables: users, children, emergency_contacts, care_instructions, guardian_links
 * Depends on: 001_lookup_tables (roles, groups)
 * SRS Refs: FR-UAM-02, FR-CH-01–07, FR-DB-02–04
 * Architecture Plan: §5.2
 */

exports.up = async (knex) => {
  // ─── users ──────────────────────────────────────────────────────────────
  // BCNF: {email} → {name, password_hash, role_id, status}
  // role stored as FK to roles lookup table (not repeated string)
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('name', 150).notNullable();
    t.string('email', 255).notNullable().unique();
    t.string('password_hash', 255).notNullable();
    t.specificType('role_id', 'SMALLINT').notNullable().references('id').inTable('roles');
    t.string('status', 20).notNullable().defaultTo('active');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // CHECK constraint: status must be 'active' or 'inactive' (FR-UAM-08)
  await knex.raw(`ALTER TABLE users ADD CONSTRAINT chk_users_status CHECK (status IN ('active','inactive'))`);

  // ─── children ───────────────────────────────────────────────────────────
  // 3NF: group and caregiver are separate entities → FK only, no duplication
  await knex.schema.createTable('children', (t) => {
    t.increments('id').primary();
    t.string('full_name', 150).notNullable();
    t.date('dob').notNullable();
    t.string('gender', 10);
    t.text('photo_url');
    t.integer('group_id').references('id').inTable('groups').onDelete('SET NULL');
    t.integer('caregiver_id').references('id').inTable('users').onDelete('SET NULL');
    t.string('enrollment_status', 20).notNullable().defaultTo('active');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`ALTER TABLE children ADD CONSTRAINT chk_children_gender CHECK (gender IN ('male','female','other'))`);
  await knex.raw(`ALTER TABLE children ADD CONSTRAINT chk_children_enrollment CHECK (enrollment_status IN ('active','inactive','waitlist'))`);

  // ─── emergency_contacts ─────────────────────────────────────────────────
  // 3NF: each contact attribute depends only on contact PK (FR-CH-03)
  await knex.schema.createTable('emergency_contacts', (t) => {
    t.increments('id').primary();
    t.integer('child_id').notNullable().references('id').inTable('children').onDelete('CASCADE');
    t.string('name', 150).notNullable();
    t.string('relationship', 80).notNullable();
    t.string('phone', 30).notNullable();
  });

  // ─── care_instructions ──────────────────────────────────────────────────
  // 3NF fix from v1: was single TEXT blob → now one row per instruction per category
  // Allows per-category querying (e.g., allergy guard in AI module) (FR-CH-03)
  await knex.schema.createTable('care_instructions', (t) => {
    t.increments('id').primary();
    t.integer('child_id').notNullable().references('id').inTable('children').onDelete('CASCADE');
    t.string('category', 50).notNullable();
    t.text('instruction_text').notNullable();
  });

  await knex.raw(`ALTER TABLE care_instructions ADD CONSTRAINT chk_ci_category CHECK (category IN ('allergy','dietary','medical_note','general'))`);

  // ─── guardian_links ─────────────────────────────────────────────────────
  // Junction table (child ↔ user many-to-many) — BCNF compliant
  // UNIQUE(child_id, user_id) enforced at both DB and constraint level (FR-CH-04, UC-04)
  await knex.schema.createTable('guardian_links', (t) => {
    t.increments('id').primary();
    t.integer('child_id').notNullable().references('id').inTable('children').onDelete('CASCADE');
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('relationship', 80).notNullable();
    t.boolean('pickup_authorized').notNullable().defaultTo(false);
    t.integer('created_by').notNullable().references('id').inTable('users');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['child_id', 'user_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('guardian_links');
  await knex.schema.dropTableIfExists('care_instructions');
  await knex.schema.dropTableIfExists('emergency_contacts');
  await knex.schema.dropTableIfExists('children');
  await knex.schema.dropTableIfExists('users');
};
