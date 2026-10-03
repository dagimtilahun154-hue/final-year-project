'use strict';
/**
 * src/modules/communication/communication.service.js
 * Business logic for Announcements, Direct Messages, and Urgent Alerts.
 * SRS Refs: FR-COM-01–08, UC-07
 */
const db = require('../../config/db');

// ─────────────────────────────────────────────────────────────
// 1. ANNOUNCEMENTS
// ─────────────────────────────────────────────────────────────
const createAnnouncement = async (body, user) => {
  const { rows } = await db.query(
    `INSERT INTO announcements (author_id, title, body, announcement_type, audience, target_group_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      user.id,
      body.title,
      body.body,
      body.announcement_type || 'general',
      body.audience || 'all',
      body.target_group_id || null,
      body.expires_at || null,
    ]
  );
  return rows[0];
};

const listAnnouncements = async (query = {}, user) => {
  const typeFilter = query.type || null;

  const { rows } = await db.query(
    `SELECT a.id, a.title, a.body, a.announcement_type, a.audience, a.expires_at, a.created_at,
            u.name AS author_name, g.name AS target_group_name
     FROM announcements a
     JOIN users u ON u.id = a.author_id
     LEFT JOIN groups g ON g.id = a.target_group_id
     WHERE (a.expires_at IS NULL OR a.expires_at > NOW())
       AND ($1::text IS NULL OR a.announcement_type = $1)
     ORDER BY a.created_at DESC`,
    [typeFilter]
  );

  return { data: rows };
};

const listMealPlans = async (query = {}, user) => {
  const groupId = query.group_id ? parseInt(query.group_id, 10) : null;

  const { rows } = await db.query(
    `SELECT a.id, a.title, a.body, a.audience, a.target_group_id, a.expires_at, a.created_at,
            u.name AS author_name, g.name AS target_group_name
     FROM announcements a
     JOIN users u ON u.id = a.author_id
     LEFT JOIN groups g ON g.id = a.target_group_id
     WHERE a.announcement_type = 'meal_plan'
       AND (a.expires_at IS NULL OR a.expires_at > NOW())
       AND ($1::int IS NULL OR a.target_group_id = $1 OR a.audience = 'all')
     ORDER BY a.created_at DESC`,
    [groupId]
  );

  return { data: rows };
};

// ─────────────────────────────────────────────────────────────
// 2. DIRECT MESSAGES
// ─────────────────────────────────────────────────────────────
const sendMessage = async (body, user) => {
  const recipientId = parseInt(body.recipient_id, 10);

  // Verify recipient exists and is active
  const { rows: recipRows } = await db.query(
    `SELECT id, name, status FROM users WHERE id = $1`,
    [recipientId]
  );
  if (recipRows.length === 0 || recipRows[0].status !== 'active') {
    const err = new Error('Recipient user not found or inactive');
    err.statusCode = 404;
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO messages (sender_id, recipient_id, subject, body)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [user.id, recipientId, body.subject || null, body.body]
  );

  return rows[0];
};

const listMessages = async (query = {}, user) => {
  const withUserId = query.with_user_id ? parseInt(query.with_user_id, 10) : null;

  const { rows } = await db.query(
    `SELECT m.id, m.sender_id, m.recipient_id, m.subject, m.body, m.read_at, m.created_at,
            s.name AS sender_name, r.name AS recipient_name
     FROM messages m
     JOIN users s ON s.id = m.sender_id
     JOIN users r ON r.id = m.recipient_id
     WHERE (m.sender_id = $1 OR m.recipient_id = $1)
       AND ($2::integer IS NULL OR m.sender_id = $2 OR m.recipient_id = $2)
     ORDER BY m.created_at DESC`,
    [user.id, withUserId]
  );

  return { data: rows };
};

const markMessageRead = async (messageIdParam, user) => {
  const msgId = parseInt(messageIdParam, 10);

  const { rows } = await db.query(
    `UPDATE messages SET read_at = NOW() WHERE id = $1 AND recipient_id = $2 RETURNING *`,
    [msgId, user.id]
  );

  if (rows.length === 0) {
    const err = new Error('Message not found or you are not the recipient');
    err.statusCode = 404;
    throw err;
  }

  return rows[0];
};

// ─────────────────────────────────────────────────────────────
// 3. URGENT ALERTS
// ─────────────────────────────────────────────────────────────
const createAlert = async (body, user) => {
  const { rows } = await db.query(
    `INSERT INTO alerts (author_id, title, urgency, recipient_scope, target_user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      user.id,
      body.title,
      body.urgency || 'normal',
      body.recipient_scope || 'all',
      body.target_user_id || null,
    ]
  );

  return rows[0];
};

const listAlerts = async (user) => {
  const { rows } = await db.query(
    `SELECT al.id, al.title, al.urgency, al.recipient_scope, al.created_at,
            u.name AS author_name
     FROM alerts al
     JOIN users u ON u.id = al.author_id
     WHERE al.recipient_scope = 'all'
        OR al.target_user_id = $1
     ORDER BY al.created_at DESC`,
    [user.id]
  );

  return { data: rows };
};

module.exports = {
  createAnnouncement,
  listAnnouncements,
  listMealPlans,
  sendMessage,
  listMessages,
  markMessageRead,
  createAlert,
  listAlerts,
};
