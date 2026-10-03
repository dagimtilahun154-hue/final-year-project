'use strict';
/**
 * Migration 010 — All Indexes
 * Applies all indexes from §6.1 of backend_architecture_plan_v2.md
 * Depends on: All previous migrations (001–009)
 * SRS Refs: NFR-PERF-01, NFR-PERF-02
 *
 * Index naming convention: idx_<table_abbrev>_<column(s)>
 * Partial indexes are used where only a subset of rows is queried
 * (saves index space and improves scan speed on filtered queries).
 */

exports.up = async (knex) => {
  // ─── users ──────────────────────────────────────────────────────────────
  // (PRIMARY KEY id and UNIQUE email already indexed by PostgreSQL)
  await knex.raw(`CREATE INDEX idx_users_role_id     ON users(role_id)`);
  await knex.raw(`CREATE INDEX idx_users_status      ON users(status)`);
  // Composite: role + status together — admin user list filters on both
  await knex.raw(`CREATE INDEX idx_users_role_status ON users(role_id, status)`);

  // ─── children ───────────────────────────────────────────────────────────
  await knex.raw(`CREATE INDEX idx_children_group_id      ON children(group_id)`);
  await knex.raw(`CREATE INDEX idx_children_caregiver_id  ON children(caregiver_id)`);
  await knex.raw(`CREATE INDEX idx_children_enrollment    ON children(enrollment_status)`);
  // Composite: caregiver + enrollment — used on caregiver dashboard
  await knex.raw(`CREATE INDEX idx_children_caregiver_enr ON children(caregiver_id, enrollment_status)`);

  // ─── guardian_links ─────────────────────────────────────────────────────
  // (UNIQUE (child_id, user_id) already indexed)
  await knex.raw(`CREATE INDEX idx_gl_user_id     ON guardian_links(user_id)`);
  await knex.raw(`CREATE INDEX idx_gl_child_id    ON guardian_links(child_id)`);
  // Partial: only pickup-authorized guardians — used constantly at checkout (Query 7)
  await knex.raw(`CREATE INDEX idx_gl_pickup_auth ON guardian_links(child_id) WHERE pickup_authorized = TRUE`);

  // ─── care_instructions ──────────────────────────────────────────────────
  await knex.raw(`CREATE INDEX idx_ci_child_id ON care_instructions(child_id)`);
  // Partial: only allergy rows — used by AI meal suggestion allergy guard (Query in AI flow)
  await knex.raw(`CREATE INDEX idx_ci_allergy   ON care_instructions(child_id) WHERE category = 'allergy'`);

  // ─── attendance ─────────────────────────────────────────────────────────
  // Most queried table — needs strongest indexing
  await knex.raw(`CREATE INDEX idx_att_child_id   ON attendance(child_id)`);
  await knex.raw(`CREATE INDEX idx_att_event_time ON attendance(event_time DESC)`);
  // Composite: child + date — "today's status for child X" (LATERAL JOIN in Query 1 & 2)
  await knex.raw(`CREATE INDEX idx_att_child_date ON attendance(child_id, event_time DESC)`);
  // Composite: date + event_type — admin attendance grid
  await knex.raw(`CREATE INDEX idx_att_date_type  ON attendance(event_time, event_type)`);

  // ─── daily_reports ──────────────────────────────────────────────────────
  // (UNIQUE (child_id, report_date) already indexed)
  await knex.raw(`CREATE INDEX idx_dr_caregiver_id   ON daily_reports(caregiver_id)`);
  await knex.raw(`CREATE INDEX idx_dr_report_date    ON daily_reports(report_date DESC)`);
  // Composite: date + caregiver — admin completion monitor (Query 6)
  await knex.raw(`CREATE INDEX idx_dr_date_caregiver ON daily_reports(report_date, caregiver_id)`);

  // ─── report_meals ───────────────────────────────────────────────────────
  await knex.raw(`CREATE INDEX idx_rm_report_id  ON report_meals(report_id)`);
  // Partial: fetch only meals when building meal summaries
  await knex.raw(`CREATE INDEX idx_rm_meal_type  ON report_meals(report_id, meal_type)`);

  // ─── report_activities ─────────────────────────────────────────────────
  await knex.raw(`CREATE INDEX idx_ra_report_id ON report_activities(report_id)`);
  await knex.raw(`CREATE INDEX idx_ra_type      ON report_activities(report_id, activity_type)`);

  // ─── health_records ─────────────────────────────────────────────────────
  await knex.raw(`CREATE INDEX idx_hr_child_id    ON health_records(child_id)`);
  await knex.raw(`CREATE INDEX idx_hr_recorded_at ON health_records(recorded_at DESC)`);
  // Composite: child + date — parent health history view
  await knex.raw(`CREATE INDEX idx_hr_child_date  ON health_records(child_id, recorded_at DESC)`);
  // Partial: unnotified records — admin notification queue
  await knex.raw(`CREATE INDEX idx_hr_unnotified  ON health_records(child_id) WHERE parent_notified = FALSE`);

  // ─── messages ───────────────────────────────────────────────────────────
  // Inbox query always filters by recipient
  await knex.raw(`CREATE INDEX idx_msg_recipient ON messages(recipient_id, created_at DESC)`);
  await knex.raw(`CREATE INDEX idx_msg_sender    ON messages(sender_id, created_at DESC)`);
  // Partial: unread messages — notification bell count
  await knex.raw(`CREATE INDEX idx_msg_unread    ON messages(recipient_id) WHERE read_at IS NULL`);

  // ─── announcements ──────────────────────────────────────────────────────
  await knex.raw(`CREATE INDEX idx_ann_created_at ON announcements(created_at DESC)`);
  await knex.raw(`CREATE INDEX idx_ann_expires_at ON announcements(expires_at)`);
  // Note: idx_ann_active removed — PostgreSQL requires IMMUTABLE functions in partial index
  // predicates; NOW() is VOLATILE. Active announcement filtering done at service/query layer.
  // For meal plan sub-tab
  await knex.raw(`CREATE INDEX idx_ann_type       ON announcements(announcement_type, created_at DESC)`);

  // ─── orders ─────────────────────────────────────────────────────────────
  await knex.raw(`CREATE INDEX idx_ord_parent_id     ON orders(parent_id)`);
  await knex.raw(`CREATE INDEX idx_ord_order_status  ON orders(order_status)`);
  await knex.raw(`CREATE INDEX idx_ord_created_at    ON orders(created_at DESC)`);
  // Composite: parent + status — "my orders" view filtered by status
  await knex.raw(`CREATE INDEX idx_ord_parent_status ON orders(parent_id, order_status)`);

  // ─── order_items ────────────────────────────────────────────────────────
  await knex.raw(`CREATE INDEX idx_oi_order_id   ON order_items(order_id)`);
  await knex.raw(`CREATE INDEX idx_oi_product_id ON order_items(product_id)`);

  // ─── products ───────────────────────────────────────────────────────────
  await knex.raw(`CREATE INDEX idx_prod_category  ON products(category_id)`);
  // Partial: only available products — parent store listing (Query 5)
  await knex.raw(`CREATE INDEX idx_prod_available ON products(category_id) WHERE available = TRUE`);

  // ─── events ─────────────────────────────────────────────────────────────
  await knex.raw(`CREATE INDEX idx_evt_date          ON events(event_date ASC)`);
  // Partial: only active (non-cancelled) future events — parent calendar view
  await knex.raw(`CREATE INDEX idx_evt_active_future ON events(event_date ASC) WHERE cancelled = FALSE`);

  // ─── audit_logs ─────────────────────────────────────────────────────────
  await knex.raw(`CREATE INDEX idx_aud_actor_id    ON audit_logs(actor_id)`);
  await knex.raw(`CREATE INDEX idx_aud_created_at  ON audit_logs(created_at DESC)`);
  await knex.raw(`CREATE INDEX idx_aud_target      ON audit_logs(target_table, target_id)`);
  // GIN index on JSONB metadata — allows fast filtering on metadata fields
  await knex.raw(`CREATE INDEX idx_aud_metadata_gin ON audit_logs USING GIN (metadata)`);

  // ─── guardian_verification_events ───────────────────────────────────────
  await knex.raw(`CREATE INDEX idx_gve_child_id    ON guardian_verification_events(child_id)`);
  await knex.raw(`CREATE INDEX idx_gve_verified_at ON guardian_verification_events(verified_at DESC)`);
  // Composite: child + date — checkout verification history
  await knex.raw(`CREATE INDEX idx_gve_child_date  ON guardian_verification_events(child_id, verified_at DESC)`);
};

exports.down = async (knex) => {
  // Drop all custom indexes (PKs and UNIQUE constraints are dropped with their tables)
  const indexes = [
    'idx_users_role_id', 'idx_users_status', 'idx_users_role_status',
    'idx_children_group_id', 'idx_children_caregiver_id', 'idx_children_enrollment', 'idx_children_caregiver_enr',
    'idx_gl_user_id', 'idx_gl_child_id', 'idx_gl_pickup_auth',
    'idx_ci_child_id', 'idx_ci_allergy',
    'idx_att_child_id', 'idx_att_event_time', 'idx_att_child_date', 'idx_att_date_type',
    'idx_dr_caregiver_id', 'idx_dr_report_date', 'idx_dr_date_caregiver',
    'idx_rm_report_id', 'idx_rm_meal_type',
    'idx_ra_report_id', 'idx_ra_type',
    'idx_hr_child_id', 'idx_hr_recorded_at', 'idx_hr_child_date', 'idx_hr_unnotified',
    'idx_msg_recipient', 'idx_msg_sender', 'idx_msg_unread',
    'idx_ann_created_at', 'idx_ann_expires_at', 'idx_ann_type',
    'idx_ord_parent_id', 'idx_ord_order_status', 'idx_ord_created_at', 'idx_ord_parent_status',
    'idx_oi_order_id', 'idx_oi_product_id',
    'idx_prod_category', 'idx_prod_available',
    'idx_evt_date', 'idx_evt_active_future',
    'idx_aud_actor_id', 'idx_aud_created_at', 'idx_aud_target', 'idx_aud_metadata_gin',
    'idx_gve_child_id', 'idx_gve_verified_at', 'idx_gve_child_date',
  ];

  for (const idx of indexes) {
    await knex.raw(`DROP INDEX IF EXISTS ${idx}`);
  }
};
