'use strict';
/**
 * Users Service — admin user management
 * SRS Refs: FR-UAM-04, FR-UAM-08
 */
const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const {auditedWrite} = require('../../utils/auditedWrite');

const listUsers = async ({ page = 1, limit = 20, role, status }) => {
  const offset = (page - 1) * limit;
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.status, r.name AS role, u.created_at
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE ($1::TEXT IS NULL OR r.name = $1)
       AND ($2::TEXT IS NULL OR u.status = $2)
     ORDER BY u.created_at DESC
     LIMIT $3 OFFSET $4`,
    [role || null, status || null, limit, offset]
  );
  const { rows: cnt } = await db.query(`SELECT COUNT(*) FROM users`);
  return { data: rows, total: parseInt(cnt[0].count), page: +page, limit: +limit };
};

const getUserById = async (id) => {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.status, r.name AS role, u.created_at, u.updated_at
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [id]
  );
  if (!rows[0]) { const e = new Error('User not found'); e.status = 404; throw e; }
  return rows[0];
};

const createUser = async ({ name, email, password, role }, actorId) => {
  const hash = await bcrypt.hash(password, 10);
  return auditedWrite(actorId, 'USER_REGISTERED', 'users', async client => {
    const {rows: roles} = await client.query('SELECT id FROM roles WHERE name=$1', [role]);
    if (!roles[0]) throw Object.assign(new Error('Invalid role'), {statusCode:422});
    const {rows} = await client.query('INSERT INTO users(name,email,password_hash,role_id) VALUES($1,$2,$3,$4) RETURNING id,name,email,status,created_at', [name.trim(),email.trim().toLowerCase(),hash,roles[0].id]);
    return rows[0];
  }, {role});
};
const updateUser = async (id, {name,email}, actorId) => auditedWrite(actorId, 'USER_UPDATED', 'users', async client => {
  const {rows} = await client.query('UPDATE users SET name=COALESCE($1,name),email=COALESCE($2,email),updated_at=NOW() WHERE id=$3 RETURNING id,name,email,status,updated_at',[name?.trim()||null,email?.trim().toLowerCase()||null,id]);
  if(!rows[0])throw Object.assign(new Error('User not found'),{statusCode:404});
  return rows[0];
});
const updateStatus = async (id, status, actorId) => auditedWrite(actorId, 'USER_STATUS_CHANGED', 'users', async client => {
  if(Number(id)===actorId && status!=='active')throw Object.assign(new Error('You cannot deactivate your own account.'),{statusCode:422});
  const {rows} = await client.query('UPDATE users SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,name,status',[status,id]);
  if(!rows[0])throw Object.assign(new Error('User not found'),{statusCode:404});
  return rows[0];
}, {status});

/**
 * Self-service profile retrieval (any authenticated user)
 */
const getMyProfile = async (user) => {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.status, r.name AS role, u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [user.id]
  );
  if (!rows[0]) {
    const e = new Error('User not found');
    e.status = 404;
    throw e;
  }
  const profile = rows[0];

  if (user.role === 'parent') {
    const { rows: children } = await db.query(
      `SELECT c.id, c.full_name, c.dob, c.gender, c.enrollment_status, g.name AS group_name
       FROM guardian_links gl
       JOIN children c ON c.id = gl.child_id
       LEFT JOIN groups g ON g.id = c.group_id
       WHERE gl.user_id = $1`,
      [user.id]
    );
    profile.linked_children = children;
  } else if (user.role === 'caregiver') {
    const { rows: children } = await db.query(
      `SELECT c.id, c.full_name, c.dob, c.gender, c.enrollment_status, g.name AS group_name
       FROM children c
       LEFT JOIN groups g ON g.id = c.group_id
       WHERE c.caregiver_id = $1`,
      [user.id]
    );
    profile.assigned_children = children;
  }

  return profile;
};

/**
 * Self-service profile update (name, email)
 */
const updateMyProfile = async (user, { name, email }) => {
  if (email) {
    const existing = await db.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2`,
      [email.trim(), user.id]
    );
    if (existing.rows.length > 0) {
      const e = new Error('Email is already in use by another account');
      e.status = 409;
      throw e;
    }
  }

  const { rows } = await db.query(
    `UPDATE users
     SET name = COALESCE($1, name),
         email = COALESCE($2, email),
         updated_at = NOW()
     WHERE id = $3
     RETURNING id, name, email, status, updated_at`,
    [name ? name.trim() : null, email ? email.toLowerCase().trim() : null, user.id]
  );
  if (!rows[0]) {
    const e = new Error('User not found');
    e.status = 404;
    throw e;
  }
  return rows[0];
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updateStatus,
  getMyProfile,
  updateMyProfile,
};
