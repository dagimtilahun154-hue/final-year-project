'use strict';
/**
 * Seed 001 — Roles
 * Seeds the roles lookup table with the 3 system roles.
 * SRS Refs: FR-UAM-02
 *
 * Role IDs are fixed integers for stable FK references across seeds and tests.
 *   1 = admin
 *   2 = caregiver
 *   3 = parent
 */

exports.seed = async (knex) => {
  await knex.raw(`
    INSERT INTO roles (id, name) VALUES
      (1, 'admin'),
      (2, 'caregiver'),
      (3, 'parent')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
  `);
};
