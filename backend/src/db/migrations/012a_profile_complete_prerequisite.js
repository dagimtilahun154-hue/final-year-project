'use strict';

// Sort before 013, which already uses this legacy onboarding field. Existing
// databases may have received it through the old manual setup script.
exports.up = async (knex) => {
  const { rows } = await knex.raw(`
    SELECT data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'users' AND column_name = 'profile_complete'
  `);
  if (rows.length) {
    if (rows[0].data_type !== 'boolean' || rows[0].is_nullable !== 'NO') {
      throw new Error('Existing users.profile_complete must be a non-nullable boolean; review the legacy schema before migrating.');
    }
    return;
  }

  await knex.schema.alterTable('users', (table) => {
    table.boolean('profile_complete').notNullable().defaultTo(false);
  });
};

exports.down = async () => {
  // Intentionally retain this shared legacy field and its onboarding values.
  // It can predate this migration, and 013/runtime code still depend on it.
};
