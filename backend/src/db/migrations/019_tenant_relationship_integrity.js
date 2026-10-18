'use strict';
const { tables, edges, inspect } = require('../tenant-integrity');
exports.up = async knex => {
  const findings = await inspect(sql => knex.raw(sql));
  if (findings.length) throw new Error('Tenant integrity preflight failed; no ownership will be guessed: ' + JSON.stringify(findings));
  for (const table of tables) {
    await knex.raw(`ALTER TABLE ${table} ADD CONSTRAINT ${table}_tenant_required CHECK(daycare_id IS NOT NULL)`);
    await knex.raw(`ALTER TABLE ${table} ADD CONSTRAINT ${table}_tenant_identity UNIQUE(daycare_id,id)`);
  }
  await knex.raw('ALTER TABLE users ADD CONSTRAINT users_tenant_required CHECK(role_id=0 OR daycare_id IS NOT NULL)');
  for (const [table, column, parent] of edges) {
    await knex.raw(`ALTER TABLE ${table} ADD CONSTRAINT ti_${table}_${column}
      FOREIGN KEY(daycare_id,${column}) REFERENCES ${parent}(daycare_id,id) ON DELETE NO ACTION`);
  }
  // Child-derived relations keep their current API. The database derives ownership
  // from the referenced parent, then composite FKs verify the other side as well.
  for (const [table, column, parent, otherColumn, otherParent] of [
    ['guardian_links','child_id','children','user_id','users'],
    ['order_items','order_id','orders','product_id','products'],
  ]) {
    await knex.raw(`ALTER TABLE ${table} ADD COLUMN daycare_id integer;
      UPDATE ${table} x SET daycare_id=p.daycare_id FROM ${parent} p WHERE p.id=x.${column};
      ALTER TABLE ${table} ALTER COLUMN daycare_id SET NOT NULL;
      CREATE FUNCTION ti_${table}_owner() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        SELECT daycare_id INTO NEW.daycare_id FROM ${parent} WHERE id=NEW.${column};
        RETURN NEW;
      END $$;
      CREATE TRIGGER ti_${table}_owner BEFORE INSERT OR UPDATE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION ti_${table}_owner();
      ALTER TABLE ${table} ADD CONSTRAINT ti_${table}_${column}
        FOREIGN KEY(daycare_id,${column}) REFERENCES ${parent}(daycare_id,id);
      ALTER TABLE ${table} ADD CONSTRAINT ti_${table}_${otherColumn}
        FOREIGN KEY(daycare_id,${otherColumn}) REFERENCES ${otherParent}(daycare_id,id);
    `);
  }
};
exports.down = async knex => {
  for (const table of ['guardian_links', 'order_items']) {
    await knex.raw(`DROP TRIGGER ti_${table}_owner ON ${table}; DROP FUNCTION ti_${table}_owner(); ALTER TABLE ${table} DROP COLUMN daycare_id`);
  }
  for (const [table, column] of [...edges].reverse()) await knex.raw(`ALTER TABLE ${table} DROP CONSTRAINT ti_${table}_${column}`);
  await knex.raw('ALTER TABLE users DROP CONSTRAINT users_tenant_required');
  for (const table of [...tables].reverse()) await knex.raw(`ALTER TABLE ${table} DROP CONSTRAINT ${table}_tenant_required, DROP CONSTRAINT ${table}_tenant_identity`);
};
