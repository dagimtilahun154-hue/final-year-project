'use strict';
/**
 * src/modules/search/search.service.js
 * Global Search Service — multi-entity search scoped to user role permissions.
 */
const db = require('../../config/db');

const globalSearch = async (searchTerm, user) => {
  const q = (searchTerm || '').trim();
  if (q.length < 2) {
    const err = new Error('Search query must be at least 2 characters');
    err.statusCode = 422;
    throw err;
  }

  const term = `%${q}%`;
  const results = {
    children: [],
    users: [],
    products: [],
    events: [],
    announcements: [],
  };

  // 1. Children search (Role scoped)
  if (user.role === 'admin') {
    const { rows } = await db.query(
      `SELECT c.id, c.full_name, c.dob, c.gender, c.enrollment_status, g.name AS group_name
       FROM children c
       LEFT JOIN groups g ON g.id = c.group_id
       WHERE c.full_name ILIKE $1
       LIMIT 10`,
      [term]
    );
    results.children = rows;
  } else if (user.role === 'caregiver') {
    const { rows } = await db.query(
      `SELECT c.id, c.full_name, c.dob, c.gender, c.enrollment_status, g.name AS group_name
       FROM children c
       LEFT JOIN groups g ON g.id = c.group_id
       WHERE c.caregiver_id = $1 AND c.full_name ILIKE $2
       LIMIT 10`,
      [user.id, term]
    );
    results.children = rows;
  } else if (user.role === 'parent') {
    const { rows } = await db.query(
      `SELECT c.id, c.full_name, c.dob, c.gender, c.enrollment_status, g.name AS group_name
       FROM guardian_links gl
       JOIN children c ON c.id = gl.child_id
       LEFT JOIN groups g ON g.id = c.group_id
       WHERE gl.user_id = $1 AND c.full_name ILIKE $2
       LIMIT 10`,
      [user.id, term]
    );
    results.children = rows;
  }

  // 2. Users search (Admin only)
  if (user.role === 'admin') {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.status, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.name ILIKE $1 OR u.email ILIKE $1
       LIMIT 10`,
      [term]
    );
    results.users = rows;
  }

  // 3. Products search (All authenticated users)
  const { rows: prodRows } = await db.query(
    `SELECT p.id, p.name, p.price, p.stock_qty, p.available, c.name AS category_name
     FROM products p
     LEFT JOIN product_categories c ON c.id = p.category_id
     WHERE (p.name ILIKE $1 OR p.description ILIKE $1)
       AND (p.available = TRUE OR $2 = 'admin')
     LIMIT 10`,
    [term, user.role]
  );
  results.products = prodRows;

  // 4. Events search (All authenticated users)
  const { rows: eventRows } = await db.query(
    `SELECT id, title, description, event_date, event_time, event_type
     FROM events
     WHERE (title ILIKE $1 OR description ILIKE $1)
       AND cancelled = FALSE
     ORDER BY event_date ASC
     LIMIT 10`,
    [term]
  );
  results.events = eventRows;

  // 5. Announcements search (All authenticated users)
  const { rows: annRows } = await db.query(
    `SELECT id, title, body, announcement_type, audience, created_at
     FROM announcements
     WHERE (title ILIKE $1 OR body ILIKE $1)
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC
     LIMIT 10`,
    [term]
  );
  results.announcements = annRows;

  const totalMatches =
    results.children.length +
    results.users.length +
    results.products.length +
    results.events.length +
    results.announcements.length;

  return {
    query: q,
    total_matches: totalMatches,
    results,
  };
};

module.exports = {
  globalSearch,
};
