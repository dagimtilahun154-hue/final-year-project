'use strict';
/**
 * src/modules/dashboard/dashboard.service.js
 * Admin Dashboard Aggregated Statistics.
 */
const db = require('../../config/db');

const getStats = async () => {
  // Run all aggregation queries in parallel
  const [
    enrollmentRes,
    attendanceRes,
    reportsRes,
    healthRes,
    ordersRes,
    messagesRes,
  ] = await Promise.all([
    // Enrollment counts by status
    db.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE enrollment_status = 'active')   AS active,
        COUNT(*) FILTER (WHERE enrollment_status = 'inactive') AS inactive,
        COUNT(*) FILTER (WHERE enrollment_status = 'waitlist') AS waitlist
      FROM children
    `),
    // Today's attendance summary
    db.query(`
      SELECT
        COUNT(DISTINCT c.id) AS total_enrolled,
        COUNT(DISTINCT a.child_id) FILTER (WHERE a.event_type = 'checkin')  AS checked_in,
        COUNT(DISTINCT a.child_id) FILTER (WHERE a.event_type = 'checkout') AS checked_out,
        COUNT(DISTINCT a.child_id) FILTER (WHERE a.event_type = 'absent')   AS absent
      FROM children c
      LEFT JOIN attendance a ON a.child_id = c.id AND a.event_time::date = CURRENT_DATE
      WHERE c.enrollment_status = 'active'
    `),
    // Today's daily reports
    db.query(`
      SELECT
        COUNT(*) AS submitted_today,
        (SELECT COUNT(*) FROM children WHERE enrollment_status = 'active') - COUNT(*) AS missing_today
      FROM daily_reports
      WHERE report_date = CURRENT_DATE
    `),
    // Unnotified health/incident records
    db.query(`
      SELECT COUNT(*) AS unnotified_health_count
      FROM health_records
      WHERE parent_notified = FALSE
    `),
    // Pending orders count and revenue
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE order_status = 'placed')   AS pending_orders,
        COUNT(*) FILTER (WHERE order_status = 'confirmed') AS confirmed_orders,
        COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid'), 0) AS total_revenue
      FROM orders
    `),
    // Unread messages count (system-wide)
    db.query(`
      SELECT COUNT(*) AS unread_messages
      FROM messages
      WHERE read_at IS NULL
    `),
  ]);

  return {
    enrollment: enrollmentRes.rows[0],
    attendance_today: attendanceRes.rows[0],
    reports_today: reportsRes.rows[0],
    health: healthRes.rows[0],
    orders: ordersRes.rows[0],
    messages: messagesRes.rows[0],
    generated_at: new Date().toISOString(),
  };
};

module.exports = { getStats };
