'use strict';

// These tables deliberately start empty. Authentication/encryption and runtime
// permissions are connected in a later batch, not by this migration.
exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE platform_accounts (
      id serial PRIMARY KEY,
      name varchar(150) NOT NULL CHECK (btrim(name) <> ''),
      email varchar(255) NOT NULL CHECK (btrim(email) <> ''),
      password_hash varchar(255),
      status varchar(24) NOT NULL DEFAULT 'pending_activation'
        CHECK (status IN ('pending_activation', 'active', 'suspended', 'disabled')),
      email_verified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT platform_accounts_password CHECK (
        (password_hash IS NULL OR btrim(password_hash) <> '')
        AND (status <> 'active' OR password_hash IS NOT NULL)
      )
    );
    CREATE UNIQUE INDEX platform_accounts_normalized_email_unique
      ON platform_accounts (lower(btrim(email)));

    CREATE TABLE mfa_factors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      daycare_id integer,
      user_id integer,
      platform_account_id integer REFERENCES platform_accounts(id) ON DELETE RESTRICT,
      kind varchar(16) NOT NULL DEFAULT 'totp' CHECK (kind = 'totp'),
      secret_ciphertext text NOT NULL CHECK (btrim(secret_ciphertext) <> ''),
      encryption_key_id varchar(80) NOT NULL CHECK (btrim(encryption_key_id) <> ''),
      last_used_step bigint CHECK (last_used_step >= 0),
      confirmed_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT mfa_factors_principal CHECK (
        (daycare_id IS NOT NULL AND user_id IS NOT NULL AND platform_account_id IS NULL)
        OR (daycare_id IS NULL AND user_id IS NULL AND platform_account_id IS NOT NULL)
      ),
      CONSTRAINT mfa_factors_user_tenant_fk FOREIGN KEY (daycare_id, user_id)
        REFERENCES users(daycare_id, id) ON DELETE RESTRICT,
      CONSTRAINT mfa_factors_tenant_identity UNIQUE (id, daycare_id, user_id),
      CONSTRAINT mfa_factors_platform_identity UNIQUE (id, platform_account_id)
    );
    CREATE UNIQUE INDEX mfa_factors_confirmed_user_unique ON mfa_factors(user_id, kind)
      WHERE user_id IS NOT NULL AND confirmed_at IS NOT NULL AND revoked_at IS NULL;
    CREATE UNIQUE INDEX mfa_factors_confirmed_platform_unique ON mfa_factors(platform_account_id, kind)
      WHERE platform_account_id IS NOT NULL AND confirmed_at IS NOT NULL AND revoked_at IS NULL;

    CREATE TABLE mfa_recovery_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      factor_id uuid NOT NULL REFERENCES mfa_factors(id) ON DELETE RESTRICT,
      code_hash varchar(64) NOT NULL UNIQUE CHECK (code_hash ~ '^[0-9a-f]{64}$'),
      consumed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX mfa_recovery_codes_factor_idx ON mfa_recovery_codes(factor_id);

    CREATE TABLE auth_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      daycare_id integer,
      user_id integer,
      platform_account_id integer REFERENCES platform_accounts(id) ON DELETE RESTRICT,
      token_hash varchar(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
      mfa_factor_id uuid,
      mfa_verified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      CONSTRAINT auth_sessions_principal CHECK (
        (daycare_id IS NOT NULL AND user_id IS NOT NULL AND platform_account_id IS NULL)
        OR (daycare_id IS NULL AND user_id IS NULL AND platform_account_id IS NOT NULL)
      ),
      CONSTRAINT auth_sessions_user_tenant_fk FOREIGN KEY (daycare_id, user_id)
        REFERENCES users(daycare_id, id) ON DELETE RESTRICT,
      CONSTRAINT auth_sessions_factor_tenant_fk FOREIGN KEY (mfa_factor_id, daycare_id, user_id)
        REFERENCES mfa_factors(id, daycare_id, user_id) ON DELETE RESTRICT,
      CONSTRAINT auth_sessions_factor_platform_fk FOREIGN KEY (mfa_factor_id, platform_account_id)
        REFERENCES mfa_factors(id, platform_account_id) ON DELETE RESTRICT,
      CONSTRAINT auth_sessions_mfa_proof CHECK (
        (mfa_factor_id IS NULL AND mfa_verified_at IS NULL)
        OR (mfa_factor_id IS NOT NULL AND mfa_verified_at IS NOT NULL)
      ),
      CONSTRAINT auth_sessions_expiry CHECK (expires_at > created_at)
    );
    CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id) WHERE user_id IS NOT NULL;
    CREATE INDEX auth_sessions_platform_idx ON auth_sessions(platform_account_id)
      WHERE platform_account_id IS NOT NULL;
    CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at) WHERE revoked_at IS NULL;

    CREATE TABLE auth_challenges (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      daycare_id integer,
      user_id integer,
      platform_account_id integer REFERENCES platform_accounts(id) ON DELETE RESTRICT,
      mfa_factor_id uuid,
      purpose varchar(24) NOT NULL
        CHECK (purpose IN ('login_mfa', 'mfa_enrollment', 'mfa_recovery', 'reauthentication')),
      token_hash varchar(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
      attempts integer NOT NULL DEFAULT 0,
      max_attempts integer NOT NULL DEFAULT 5,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      revoked_at timestamptz,
      CONSTRAINT auth_challenges_principal CHECK (
        (daycare_id IS NOT NULL AND user_id IS NOT NULL AND platform_account_id IS NULL)
        OR (daycare_id IS NULL AND user_id IS NULL AND platform_account_id IS NOT NULL)
      ),
      CONSTRAINT auth_challenges_user_tenant_fk FOREIGN KEY (daycare_id, user_id)
        REFERENCES users(daycare_id, id) ON DELETE RESTRICT,
      CONSTRAINT auth_challenges_factor_tenant_fk FOREIGN KEY (mfa_factor_id, daycare_id, user_id)
        REFERENCES mfa_factors(id, daycare_id, user_id) ON DELETE RESTRICT,
      CONSTRAINT auth_challenges_factor_platform_fk FOREIGN KEY (mfa_factor_id, platform_account_id)
        REFERENCES mfa_factors(id, platform_account_id) ON DELETE RESTRICT,
      CONSTRAINT auth_challenges_expiry CHECK (expires_at > created_at),
      CONSTRAINT auth_challenges_attempts CHECK (
        attempts >= 0 AND max_attempts > 0 AND attempts <= max_attempts
      )
    );
    CREATE INDEX auth_challenges_user_idx ON auth_challenges(user_id) WHERE user_id IS NOT NULL;
    CREATE INDEX auth_challenges_platform_idx ON auth_challenges(platform_account_id)
      WHERE platform_account_id IS NOT NULL;
    CREATE INDEX auth_challenges_expiry_idx ON auth_challenges(expires_at)
      WHERE consumed_at IS NULL AND revoked_at IS NULL;

    CREATE TABLE platform_password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      platform_account_id integer NOT NULL REFERENCES platform_accounts(id) ON DELETE RESTRICT,
      token_hash varchar(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      CONSTRAINT platform_reset_tokens_expiry CHECK (expires_at > created_at)
    );
    CREATE INDEX platform_reset_tokens_account_idx
      ON platform_password_reset_tokens(platform_account_id);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP TABLE platform_password_reset_tokens;
    DROP TABLE auth_challenges;
    DROP TABLE auth_sessions;
    DROP TABLE mfa_recovery_codes;
    DROP TABLE mfa_factors;
    DROP TABLE platform_accounts;
  `);
};
