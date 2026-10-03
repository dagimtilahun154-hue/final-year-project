'use strict';
/**
 * Migration 008 — E-commerce
 * Tables: products, orders, order_items, payments
 * Depends on: 001_lookup_tables (product_categories), 002_core_identity (users)
 * SRS Refs: FR-ECM-01–16, FR-DB-02–04, NFR-REL-03
 * Architecture Plan: §5.8
 */

exports.up = async (knex) => {
  // ─── products ───────────────────────────────────────────────────────────
  // v2 fix: category was raw VARCHAR in v1; now FK to product_categories lookup.
  await knex.schema.createTable('products', (t) => {
    t.increments('id').primary();
    t.string('name', 200).notNullable();
    t.text('description');
    t.decimal('price', 10, 2).notNullable();
    t.integer('category_id').references('id').inTable('product_categories').onDelete('SET NULL');
    t.integer('stock_qty').notNullable().defaultTo(0);
    t.boolean('available').notNullable().defaultTo(true);
    t.integer('created_by').notNullable().references('id').inTable('users');
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`ALTER TABLE products ADD CONSTRAINT chk_prod_price CHECK (price >= 0)`);
  await knex.raw(`ALTER TABLE products ADD CONSTRAINT chk_prod_stock CHECK (stock_qty >= 0)`);

  // ─── orders ─────────────────────────────────────────────────────────────
  // order_status and payment_status use CHECK constraints (FR-ECM-16).
  await knex.schema.createTable('orders', (t) => {
    t.increments('id').primary();
    t.integer('parent_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.decimal('total', 10, 2).notNullable();
    t.string('order_status', 30).notNullable().defaultTo('placed');
    t.string('payment_status', 20).notNullable().defaultTo('unpaid');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`ALTER TABLE orders ADD CONSTRAINT chk_orders_total CHECK (total >= 0)`);
  await knex.raw(`ALTER TABLE orders ADD CONSTRAINT chk_orders_status CHECK (order_status IN ('placed','confirmed','ready_for_pickup','collected','cancelled'))`);
  await knex.raw(`ALTER TABLE orders ADD CONSTRAINT chk_orders_pay_status CHECK (payment_status IN ('unpaid','pending','paid','failed'))`);

  // ─── order_items ────────────────────────────────────────────────────────
  // unit_price is a SNAPSHOT at order time — intentional denormalization.
  // Prevents price drift after product is updated (FR-ECM-05).
  // This is NOT a normalization violation — it's the snapshot pattern.
  await knex.schema.createTable('order_items', (t) => {
    t.increments('id').primary();
    t.integer('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.integer('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
    t.integer('quantity').notNullable();
    t.decimal('unit_price', 10, 2).notNullable();
  });

  await knex.raw(`ALTER TABLE order_items ADD CONSTRAINT chk_oi_quantity CHECK (quantity > 0)`);
  await knex.raw(`ALTER TABLE order_items ADD CONSTRAINT chk_oi_unit_price CHECK (unit_price >= 0)`);

  // ─── payments ───────────────────────────────────────────────────────────
  // 1:1 with orders — UNIQUE(order_id). gateway_ref is Chapa tx ID (TBD-02).
  // Payment + order status must be updated in a single transaction (NFR-REL-03).
  await knex.schema.createTable('payments', (t) => {
    t.increments('id').primary();
    t.integer('order_id').notNullable().unique().references('id').inTable('orders').onDelete('RESTRICT');
    t.string('method', 30).notNullable();
    t.text('gateway_ref');  // NULL for pay_at_daycare; Chapa tx ID for digital
    t.string('status', 20).notNullable().defaultTo('unpaid');
    t.timestamp('verified_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`ALTER TABLE payments ADD CONSTRAINT chk_pay_method CHECK (method IN ('pay_at_daycare','digital'))`);
  await knex.raw(`ALTER TABLE payments ADD CONSTRAINT chk_pay_status CHECK (status IN ('unpaid','pending','paid','failed'))`);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('payments');
  await knex.schema.dropTableIfExists('order_items');
  await knex.schema.dropTableIfExists('orders');
  await knex.schema.dropTableIfExists('products');
};
