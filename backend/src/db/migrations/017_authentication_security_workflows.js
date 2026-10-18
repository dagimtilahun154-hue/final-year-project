'use strict';

exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE daycare_password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      daycare_id integer NOT NULL REFERENCES daycares(id) ON DELETE RESTRICT,
      user_id integer NOT NULL,
      token_hash varchar(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      CONSTRAINT daycare_reset_user_tenant_fk FOREIGN KEY (daycare_id, user_id)
        REFERENCES users(daycare_id, id) ON DELETE RESTRICT,
      CONSTRAINT daycare_reset_expiry CHECK (expires_at > created_at)
    );
    CREATE INDEX daycare_reset_account_idx ON daycare_password_reset_tokens(daycare_id, user_id);

    CREATE TABLE auth_mail_outbox (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      daycare_id integer,
      user_id integer,
      platform_account_id integer REFERENCES platform_accounts(id) ON DELETE RESTRICT,
      recipient varchar(255) NOT NULL CHECK (btrim(recipient) <> ''),
      kind varchar(32) NOT NULL CHECK (kind IN ('password_reset', 'password_changed')),
      payload_ciphertext text NOT NULL CHECK (btrim(payload_ciphertext) <> ''),
      encryption_key_id varchar(80) NOT NULL CHECK (btrim(encryption_key_id) <> ''),
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      expires_at timestamptz NOT NULL,
      CONSTRAINT auth_mail_principal CHECK (
        (daycare_id IS NOT NULL AND user_id IS NOT NULL AND platform_account_id IS NULL)
        OR (daycare_id IS NULL AND user_id IS NULL AND platform_account_id IS NOT NULL)
      ),
      CONSTRAINT auth_mail_user_tenant_fk FOREIGN KEY (daycare_id, user_id)
        REFERENCES users(daycare_id, id) ON DELETE RESTRICT,
      CONSTRAINT auth_mail_expiry CHECK (expires_at > created_at)
    );
    CREATE INDEX auth_mail_created_idx ON auth_mail_outbox(created_at DESC);
    CREATE INDEX auth_mail_user_idx ON auth_mail_outbox(daycare_id, user_id) WHERE user_id IS NOT NULL;
    CREATE INDEX auth_mail_platform_idx ON auth_mail_outbox(platform_account_id)
      WHERE platform_account_id IS NOT NULL;

    CREATE TABLE auth_attempt_buckets (
      key_hash varchar(64) PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),
      window_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      attempts integer NOT NULL CHECK (attempts > 0)
    );
    CREATE INDEX auth_attempt_window_idx ON auth_attempt_buckets(window_started_at);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`DROP TABLE auth_attempt_buckets;
    DROP TABLE auth_mail_outbox;
    DROP TABLE daycare_password_reset_tokens;`);
};
