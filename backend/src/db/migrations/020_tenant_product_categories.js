'use strict';
exports.up = async knex => {
  await knex.raw(`
    ALTER TABLE product_categories ADD COLUMN daycare_id integer REFERENCES daycares(id);
    ALTER TABLE product_categories DROP CONSTRAINT product_categories_name_unique;
    CREATE UNIQUE INDEX categories_global_name ON product_categories(lower(name)) WHERE daycare_id IS NULL;
    CREATE UNIQUE INDEX categories_tenant_name ON product_categories(daycare_id,lower(name)) WHERE daycare_id IS NOT NULL;
    CREATE FUNCTION check_product_category_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE owner_id integer;
    BEGIN
      IF NEW.category_id IS NOT NULL THEN
        SELECT daycare_id INTO owner_id FROM product_categories WHERE id=NEW.category_id FOR SHARE;
        IF owner_id IS NOT NULL AND owner_id IS DISTINCT FROM NEW.daycare_id THEN
          RAISE EXCEPTION 'Product category belongs to a different daycare' USING ERRCODE='23503';
        END IF;
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER product_category_tenant BEFORE INSERT OR UPDATE OF category_id,daycare_id ON products
      FOR EACH ROW EXECUTE FUNCTION check_product_category_tenant();
    CREATE FUNCTION immutable_category_owner() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.daycare_id IS DISTINCT FROM OLD.daycare_id THEN
        RAISE EXCEPTION 'Category ownership cannot be changed' USING ERRCODE='23514';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER category_owner BEFORE UPDATE OF daycare_id ON product_categories
      FOR EACH ROW EXECUTE FUNCTION immutable_category_owner();
  `);
};
exports.down = async knex => {
  const owned = await knex('product_categories').whereNotNull('daycare_id').first();
  if (owned) throw new Error('Export and resolve tenant categories before rollback; categories will not be merged.');
  await knex.raw(`DROP TRIGGER category_owner ON product_categories;
    DROP FUNCTION immutable_category_owner();
    DROP TRIGGER product_category_tenant ON products;
    DROP FUNCTION check_product_category_tenant();
    DROP INDEX categories_global_name; DROP INDEX categories_tenant_name;
    ALTER TABLE product_categories DROP COLUMN daycare_id;
    ALTER TABLE product_categories ADD CONSTRAINT product_categories_name_unique UNIQUE(name);`);
};
