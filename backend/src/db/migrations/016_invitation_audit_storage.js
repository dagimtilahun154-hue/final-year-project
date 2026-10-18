'use strict';

// Storage for later invitation/platform workflows. No emails are sent and no
// platform privileges or runtime audit permissions are enabled here.
exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE account_invitations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      daycare_id integer NOT NULL REFERENCES daycares(id) ON DELETE RESTRICT,
      email varchar(255) NOT NULL CHECK (btrim(email) <> '' AND email = lower(btrim(email))),
      role_id smallint NOT NULL REFERENCES roles(id) CHECK (role_id IN (1, 2, 3)),
      user_id integer,
      invited_by_user_id integer,
      invited_by_platform_account_id integer REFERENCES platform_accounts(id) ON DELETE RESTRICT,
      token_hash varchar(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      accepted_at timestamptz,
      accepted_by_user_id integer,
      revoked_at timestamptz,
      CONSTRAINT account_invitations_target_tenant_fk FOREIGN KEY (daycare_id, user_id)
        REFERENCES users(daycare_id, id) ON DELETE RESTRICT,
      CONSTRAINT account_invitations_inviter_tenant_fk FOREIGN KEY (daycare_id, invited_by_user_id)
        REFERENCES users(daycare_id, id) ON DELETE RESTRICT,
      CONSTRAINT account_invitations_acceptor_tenant_fk FOREIGN KEY (daycare_id, accepted_by_user_id)
        REFERENCES users(daycare_id, id) ON DELETE RESTRICT,
      CONSTRAINT account_invitations_inviter CHECK (
        (role_id = 1 AND invited_by_user_id IS NULL AND invited_by_platform_account_id IS NOT NULL)
        OR (role_id IN (2, 3) AND invited_by_user_id IS NOT NULL AND invited_by_platform_account_id IS NULL)
      ),
      CONSTRAINT account_invitations_acceptance CHECK (
        (accepted_at IS NULL AND accepted_by_user_id IS NULL)
        OR (accepted_at IS NOT NULL AND accepted_by_user_id IS NOT NULL)
      ),
      CONSTRAINT account_invitations_target_acceptor CHECK (
        user_id IS NULL OR accepted_by_user_id IS NULL OR user_id = accepted_by_user_id
      ),
      CONSTRAINT account_invitations_expiry CHECK (expires_at > created_at)
    );
    CREATE UNIQUE INDEX account_invitations_pending_unique
      ON account_invitations(daycare_id, email, role_id)
      WHERE accepted_at IS NULL AND revoked_at IS NULL;
    CREATE INDEX account_invitations_inviter_idx ON account_invitations(invited_by_user_id)
      WHERE invited_by_user_id IS NOT NULL;
    CREATE INDEX account_invitations_platform_inviter_idx
      ON account_invitations(invited_by_platform_account_id)
      WHERE invited_by_platform_account_id IS NOT NULL;

    CREATE TABLE platform_audit_events (
      id bigserial PRIMARY KEY,
      actor_kind varchar(16) NOT NULL CHECK (actor_kind IN ('platform', 'system')),
      platform_account_id integer REFERENCES platform_accounts(id) ON DELETE RESTRICT,
      daycare_id integer REFERENCES daycares(id) ON DELETE RESTRICT,
      action varchar(80) NOT NULL CHECK (btrim(action) <> ''),
      target_type varchar(60) NOT NULL CHECK (btrim(target_type) <> ''),
      target_id varchar(128),
      outcome varchar(16) NOT NULL CHECK (outcome IN ('success', 'denied', 'failure')),
      reason text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT platform_audit_events_actor CHECK (
        (actor_kind = 'platform' AND platform_account_id IS NOT NULL)
        OR (actor_kind = 'system' AND platform_account_id IS NULL)
      )
    );
    CREATE INDEX platform_audit_events_tenant_time_idx ON platform_audit_events(daycare_id, created_at DESC);
    CREATE INDEX platform_audit_events_actor_time_idx ON platform_audit_events(platform_account_id, created_at DESC);
    CREATE INDEX platform_audit_events_action_time_idx ON platform_audit_events(action, created_at DESC);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP TABLE platform_audit_events;
    DROP TABLE account_invitations;
  `);
};
