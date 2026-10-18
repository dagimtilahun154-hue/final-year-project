'use strict';

exports.up = async knex => {
  await knex.raw(`
    ALTER TABLE users ADD COLUMN security_revision text;
    ALTER TABLE daycares ADD COLUMN security_revision text;
    UPDATE users SET security_revision = extract(epoch from updated_at)::text;
    UPDATE daycares SET security_revision = extract(epoch from updated_at)::text;
    ALTER TABLE users ALTER COLUMN security_revision SET DEFAULT gen_random_uuid()::text,
      ALTER COLUMN security_revision SET NOT NULL;
    ALTER TABLE daycares ALTER COLUMN security_revision SET DEFAULT gen_random_uuid()::text,
      ALTER COLUMN security_revision SET NOT NULL;
    CREATE FUNCTION refresh_user_security_revision() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF ROW(NEW.email, NEW.password_hash, NEW.status, NEW.role_id, NEW.daycare_id)
        IS DISTINCT FROM ROW(OLD.email, OLD.password_hash, OLD.status, OLD.role_id, OLD.daycare_id) THEN
        NEW.security_revision := gen_random_uuid()::text;
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER user_security_revision BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION refresh_user_security_revision();
    CREATE FUNCTION refresh_daycare_security_revision() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.security_revision := gen_random_uuid()::text;
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER daycare_security_revision BEFORE UPDATE ON daycares
      FOR EACH ROW EXECUTE FUNCTION refresh_daycare_security_revision();
  `);
};

exports.down = async knex => {
  // Returning to timestamp fingerprints deliberately invalidates sessions.
  await knex.raw(`
    UPDATE users SET updated_at = clock_timestamp();
    UPDATE daycares SET updated_at = clock_timestamp();
    DROP TRIGGER user_security_revision ON users;
    DROP TRIGGER daycare_security_revision ON daycares;
    DROP FUNCTION refresh_user_security_revision();
    DROP FUNCTION refresh_daycare_security_revision();
    ALTER TABLE users DROP COLUMN security_revision;
    ALTER TABLE daycares DROP COLUMN security_revision;
  `);
};
