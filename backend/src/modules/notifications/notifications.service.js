'use strict';
/**
 * src/modules/notifications/notifications.service.js
 * Aggregated Notifications Inbox Service — §8.7, §8.10, §8.6
 * Computes badge counts and aggregates recent items for navigation headers.
 */
const db = require('../../config/db');

const getNotifications = async (user) => {
  const userId = user.id;
  const userRole = user.role;

  // 1. Unread direct messages
  const { rows: unreadMsgRows } = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM messages
     WHERE recipient_id = $1 AND read_at IS NULL`,
    [userId]
  );
  const unreadMessagesCount = unreadMsgRows[0]?.count || 0;

  // Recent unread messages (up to 5)
  const { rows: recentMessages } = await db.query(
    `SELECT m.id, m.sender_id, u.name AS sender_name, m.subject, m.body, m.created_at
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.recipient_id = $1 AND m.read_at IS NULL
     ORDER BY m.created_at DESC
     LIMIT 5`,
    [userId]
  );

  // 2. Active alerts applicable to this user (scope = 'all' or targeted to this user)
  const { rows: alertCountRows } = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM alerts
     WHERE recipient_scope = 'all' OR target_user_id = $1`,
    [userId]
  );
  const activeAlertsCount = alertCountRows[0]?.count || 0;

  // Recent alerts (up to 5)
  const { rows: recentAlerts } = await db.query(
    `SELECT id, title, urgency, recipient_scope, created_at
     FROM alerts
     WHERE recipient_scope = 'all' OR target_user_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId]
  );

  let unnotifiedHealthCount = 0;
  let unpaidOrdersCount = 0;

  // 3. Role-specific items
  if (userRole === 'admin' || userRole === 'caregiver') {
    // Unnotified health/incident records (FR-HIR-04)
    const { rows: healthRows } = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM health_records
       WHERE parent_notified = FALSE`
    );
    unnotifiedHealthCount = healthRows[0]?.count || 0;
  }

  if (userRole === 'parent') {
    // Unpaid orders for this parent
    const { rows: orderRows } = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM orders
       WHERE parent_id = $1 AND payment_status = 'unpaid' AND order_status != 'cancelled'`,
      [userId]
    );
    unpaidOrdersCount = orderRows[0]?.count || 0;
  }

  const totalBadges =
    unreadMessagesCount +
    activeAlertsCount +
    unnotifiedHealthCount +
    unpaidOrdersCount;

  return {
    total_badges: totalBadges,
    unread_messages: {
      count: unreadMessagesCount,
      recent: recentMessages,
    },
    alerts: {
      count: activeAlertsCount,
      recent: recentAlerts,
    },
    unnotified_health_records: {
      count: unnotifiedHealthCount,
    },
    unpaid_orders: {
      count: unpaidOrdersCount,
    },
  };
};

module.exports = {
  getNotifications,
};
