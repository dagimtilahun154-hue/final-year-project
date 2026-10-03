'use strict';
/**
 * Migration 001 — Lookup / Reference Tables
 * Tables: roles, product_categories, groups
 * Must run FIRST — other tables have FKs into these.
 * SRS Refs: FR-UAM-02, FR-ECM-01, FR-CH-05
 * Architecture Plan: §5.1
 */

exports.up = async (knex) => {
  // ─── roles ──────────────────────────────────────────────────────────────
  // Avoids hard-coded role strings scattered in app code.
  // BCNF: {id} → {name} — fully normalized.
  await knex.schema.createTable('roles', (t) => {
    t.specificType('id', 'SMALLINT').primary();
    t.string('name', 20).notNullable().unique();  // 'admin','caregiver','parent'
  });

  // ─── product_categories ─────────────────────────────────────────────────
  // Extracted from products table (3NF fix: category name was repeated inline).
  // Update anomaly prevention: renaming a category requires one row update.
  await knex.schema.createTable('product_categories', (t) => {
    t.increments('id').primary();
    t.string('name', 50).notNullable().unique();
  });

  // ─── groups ─────────────────────────────────────────────────────────────
  // Daycare class/group (children.group_id → groups.id)
  await knex.schema.createTable('groups', (t) => {
    t.increments('id').primary();
    t.string('name', 100).notNullable().unique();
    t.text('description');
  });
};

exports.down = async (knex) => {
  // Drop in reverse dependency order
  await knex.schema.dropTableIfExists('groups');
  await knex.schema.dropTableIfExists('product_categories');
  await knex.schema.dropTableIfExists('roles');
};
