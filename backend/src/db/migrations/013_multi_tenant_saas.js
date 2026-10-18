'use strict';
const bcrypt = require('bcryptjs');

/**
 * Migration 013 — Multi-Tenant SaaS Architecture
 *
 * Adds:
 * 1. daycares table for daycare center tenants with status & trial subscription tracking.
 * 2. super_admin role (role_id: 0) for platform-wide administration.
 * 3. daycare_id foreign keys across operational tables:
 *    users, children, groups, front_desk_assignments, attendance, daily_reports,
 *    health_records, announcements, messages, events, products, orders, audit_logs.
 * 4. Backfills existing demo records to default daycare (id: 1, 'Ankelba Daycare Center').
 * 5. Seeds default Super Admin account (superadmin@ankelba.com / 1234).
 */

exports.up = async (knex) => {
  // ─── 1. Create daycares (Tenants) ─────────────────────────────────────────
  const hasDaycares = await knex.schema.hasTable('daycares');
  if (!hasDaycares) {
    await knex.schema.createTable('daycares', (t) => {
      t.increments('id').primary();
      t.string('name', 150).notNullable();
      t.string('slug', 100).notNullable().unique();
      t.string('contact_email', 255).notNullable();
      t.string('contact_phone', 30);
      t.text('address');
      t.string('license_number', 100);
      t.string('status', 30).notNullable().defaultTo('pending');
      t.string('subscription_plan', 30).notNullable().defaultTo('trial');
      t.timestamp('trial_ends_at', { useTz: true });
      t.integer('max_children').defaultTo(50);
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    await knex.raw(`
      ALTER TABLE daycares 
      ADD CONSTRAINT chk_daycares_status CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
      ADD CONSTRAINT chk_daycares_plan CHECK (subscription_plan IN ('trial', 'standard', 'premium'))
    `);
  }

  // ─── 2. Add super_admin to roles ──────────────────────────────────────────
  await knex.raw(`
    INSERT INTO roles (id, name) VALUES (0, 'super_admin')
    ON CONFLICT (id) DO NOTHING
  `);

  // ─── 3. Expand users.status check constraint ──────────────────────────────
  await knex.raw(`ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_status`);
  await knex.raw(`
    ALTER TABLE users ADD CONSTRAINT chk_users_status 
    CHECK (status IN ('active', 'inactive', 'pending', 'suspended'))
  `);

  // ─── 4. Insert Default Daycare (Ankelba Daycare Center) ────────────────────
  await knex.raw(`
    INSERT INTO daycares (id, name, slug, contact_email, contact_phone, address, license_number, status, subscription_plan, trial_ends_at, max_children)
    VALUES (
      1,
      'Ankelba Daycare Center',
      'ankelba-main',
      'admin@gmail.com',
      '+251911000000',
      'Bole Subcity, Addis Ababa, Ethiopia',
      'AA-EDU-2026-001',
      'active',
      'standard',
      NOW() + interval '365 days',
      100
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      status = 'active',
      subscription_plan = 'standard'
  `);
  // Ensure the serial sequence is aligned past 1
  await knex.raw(`SELECT setval(pg_get_serial_sequence('daycares', 'id'), coalesce(max(id), 1)) FROM daycares`);

  // ─── 5. Add daycare_id to Operational Tables ──────────────────────────────
  const tables = [
    'users',
    'children',
    'groups',
    'front_desk_assignments',
    'attendance',
    'daily_reports',
    'health_records',
    'announcements',
    'messages',
    'alerts',
    'events',
    'products',
    'orders',
    'audit_logs',
  ];

  for (const table of tables) {
    const hasTable = await knex.schema.hasTable(table);
    if (!hasTable) continue;
    const hasColumn = await knex.schema.hasColumn(table, 'daycare_id');
    if (!hasColumn) {
      await knex.schema.alterTable(table, (t) => {
        t.integer('daycare_id').references('id').inTable('daycares').onDelete('CASCADE');
        t.index('daycare_id');
      });
    }
  }

  // Tenant-scoped uniqueness for group names instead of global uniqueness
  try {
    await knex.raw(`ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_name_unique`);
    await knex.raw(`ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_daycare_name_unique`);
    await knex.raw(`ALTER TABLE groups ADD CONSTRAINT groups_daycare_name_unique UNIQUE (daycare_id, name)`);
  } catch (err) {
    console.warn('Note on groups constraint update:', err.message);
  }

  // ─── 6. Backfill Existing Records with daycare_id = 1 ─────────────────────
  for (const table of tables) {
    const hasTable = await knex.schema.hasTable(table);
    if (!hasTable) continue;
    const hasColumn = await knex.schema.hasColumn(table, 'daycare_id');
    if (hasColumn) {
      if (table === 'users') {
        // Only set daycare_id for non-super_admin users
        await knex('users').whereNull('daycare_id').whereNot('role_id', 0).update({ daycare_id: 1 });
      } else {
        await knex(table).whereNull('daycare_id').update({ daycare_id: 1 });
      }
    }
  }

  // ─── 7. Seed Default Super Admin Account ──────────────────────────────────
  const passwordHash = await bcrypt.hash('1234', 10);
  const existingSuperAdmin = await knex('users').where({ email: 'superadmin@ankelba.com' }).first();
  if (!existingSuperAdmin) {
    await knex('users').insert({
      name: 'SaaS Super Administrator',
      email: 'superadmin@ankelba.com',
      password_hash: passwordHash,
      role_id: 0,
      status: 'active',
      daycare_id: null,
      profile_complete: true,
    });
  } else {
    await knex('users').where({ id: existingSuperAdmin.id }).update({
      role_id: 0,
      status: 'active',
      daycare_id: null,
    });
  }
};

exports.down = async (knex) => {
  // 1. Remove Super Admin user
  await knex('users').where({ email: 'superadmin@ankelba.com' }).delete();

  // 2. Drop daycare_id from tables
  const tables = [
    'audit_logs',
    'orders',
    'products',
    'events',
    'alerts',
    'messages',
    'announcements',
    'health_records',
    'daily_reports',
    'attendance',
    'front_desk_assignments',
    'groups',
    'children',
    'users',
  ];

  for (const table of tables) {
    const hasTable = await knex.schema.hasTable(table);
    if (!hasTable) continue;
    const hasColumn = await knex.schema.hasColumn(table, 'daycare_id');
    if (hasColumn) {
      await knex.schema.alterTable(table, (t) => {
        t.dropIndex('daycare_id');
        t.dropColumn('daycare_id');
      });
    }
  }

  // 3. Drop daycares table
  await knex.schema.dropTableIfExists('daycares');

  // 4. Remove super_admin role
  await knex('roles').where({ id: 0 }).delete();
};
