exports.up = async knex => {
 await knex.schema.createTable('front_desk_assignments', t=>{
  t.increments('id').primary(); t.integer('staff_id').notNullable().references('id').inTable('users');
  t.integer('group_id').references('id').inTable('groups'); t.timestamp('starts_at',{useTz:true}).notNullable(); t.timestamp('ends_at',{useTz:true}).notNullable();
  t.boolean('can_attendance').notNullable().defaultTo(true); t.boolean('can_pickup').notNullable().defaultTo(false);
  t.string('status',20).notNullable().defaultTo('active'); t.integer('assigned_by').notNullable().references('id').inTable('users');
  t.timestamp('created_at',{useTz:true}).notNullable().defaultTo(knex.fn.now()); t.timestamp('revoked_at',{useTz:true});
  t.index(['staff_id','starts_at','ends_at']);
 });
 await knex.raw("ALTER TABLE front_desk_assignments ADD CONSTRAINT desk_valid_shift CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '16 hours'), ADD CONSTRAINT desk_status CHECK (status IN ('active','revoked')), ADD CONSTRAINT desk_capability CHECK (can_attendance OR can_pickup)");
 await knex.schema.alterTable('guardian_verification_events',t=>{t.integer('attendance_id').unique().references('id').inTable('attendance');t.text('manual_reason');});
};
exports.down = async knex => {await knex.schema.alterTable('guardian_verification_events',t=>{t.dropColumn('attendance_id');t.dropColumn('manual_reason');});await knex.schema.dropTable('front_desk_assignments');};
