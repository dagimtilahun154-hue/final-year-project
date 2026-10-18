'use strict';

/**
 * Additive account metadata only. Keep users_email_unique until every login and
 * recovery consumer uses daycare scope. Do not guess primary admins/readiness.
 */
exports.up = async (knex) => {
  const conflicts = await knex.raw(`
    SELECT 1 FROM users
    WHERE daycare_id IS NOT NULL
    GROUP BY daycare_id, lower(btrim(email))
    HAVING count(*) > 1
    LIMIT 1
  `);
  if (conflicts.rows.length) {
    throw new Error('Resolve duplicate normalized emails within a daycare before migration 014; accounts will not be merged.');
  }

  await knex.raw(`
    ALTER TABLE users
      ADD CONSTRAINT users_daycare_identity_unique UNIQUE (daycare_id, id);
    CREATE UNIQUE INDEX users_daycare_normalized_email_unique
      ON users (daycare_id, lower(btrim(email))) WHERE daycare_id IS NOT NULL;

    ALTER TABLE daycares
      ADD COLUMN login_code varchar(64),
      ADD COLUMN primary_admin_user_id integer,
      ADD COLUMN setup_status varchar(20) NOT NULL DEFAULT 'not_started',
      ADD COLUMN setup_completed_at timestamptz,
      ADD CONSTRAINT daycares_login_code_format CHECK (
        login_code IS NULL OR login_code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      ),
      ADD CONSTRAINT daycares_setup_status CHECK (
        setup_status IN ('not_started', 'in_progress', 'complete')
      ),
      ADD CONSTRAINT daycares_setup_completion CHECK (
        (setup_status = 'complete' AND setup_completed_at IS NOT NULL)
        OR (setup_status <> 'complete' AND setup_completed_at IS NULL)
      ),
      ADD CONSTRAINT daycares_primary_admin_tenant_fk
        FOREIGN KEY (id, primary_admin_user_id)
        REFERENCES users (daycare_id, id) ON DELETE RESTRICT;

    UPDATE daycares SET login_code = 'dc-' || id::text;
    CREATE UNIQUE INDEX daycares_login_code_unique ON daycares (login_code);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE daycares DROP CONSTRAINT daycares_primary_admin_tenant_fk;
    DROP INDEX daycares_login_code_unique;
    ALTER TABLE daycares
      DROP COLUMN setup_completed_at,
      DROP COLUMN setup_status,
      DROP COLUMN primary_admin_user_id,
      DROP COLUMN login_code;
    DROP INDEX users_daycare_normalized_email_unique;
    ALTER TABLE users DROP CONSTRAINT users_daycare_identity_unique;
  `);
};
