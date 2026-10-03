'use strict';
/**
 * Auth Service — business logic for authentication
 * SRS Refs: FR-UAM-01, FR-UAM-07, NFR-SEC-03, NFR-SEC-07
 * Architecture Plan: §4 (auth flow diagram)
 * Uses: db pool (raw SQL), bcryptjs, jsonwebtoken, crypto
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../../config/db');
const logger = require('../../config/logger');

/**
 * Authenticate a user by email + password.
 * Uses the users.email unique index — single row lookup, no full scan.
 * @param {string} email
 * @param {string} password
 * @returns {{ token: string, user: object }}
 */
const login = async (email, password) => {
  // Fetch user by email (uses UNIQUE index on email — fast single-row lookup)
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.password_hash, u.status, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = $1`,
    [email.toLowerCase().trim()]
  );

  const user = rows[0];

  // Non-specific error message — don't reveal whether email exists (NFR-SEC-04)
  if (!user) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  if (user.status !== 'active') {
    const err = new Error('Account is disabled');
    err.status = 401;
    throw err;
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  // Sign JWT — never include password_hash in payload
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  logger.info(`User ${user.id} (${user.role}) authenticated`);

  return {
    token,
    user: {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    },
  };
};

/**
 * Get current user profile (for GET /api/auth/me)
 * @param {number} userId
 * @returns {object} user
 */
const getCurrentUser = async (userId) => {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.status, r.name AS role, u.created_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [userId]
  );

  if (!rows[0]) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  return rows[0];
};

/**
 * Request a password reset token.
 * Returns token in response (production would email it instead).
 */
const forgotPassword = async (email) => {
  const { rows } = await db.query(
    `SELECT id, email, status FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );

  // Always respond the same to avoid email enumeration (NFR-SEC-04)
  if (!rows[0] || rows[0].status !== 'active') {
    return { message: 'If that email is registered and active, a reset token has been issued.' };
  }

  const user = rows[0];

  // Generate a secure random token (32 bytes → 64 hex chars)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Invalidate existing unused tokens for this user first
  await db.query(
    `UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE`,
    [user.id]
  );

  // Insert new token
  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  logger.info(`Password reset token issued for user ${user.id}`);

  // In production: send email with reset link containing rawToken
  // For dev/demo: return token directly in response
  return {
    message: 'Reset token issued successfully.',
    reset_token: rawToken, // dev-mode: remove in production email flow
    expires_at: expiresAt,
  };
};

/**
 * Consume a password reset token and set new password.
 */
const resetPassword = async (rawToken, newPassword) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const { rows } = await db.query(
    `SELECT id, user_id, expires_at, used
     FROM password_reset_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  if (rows.length === 0) {
    const err = new Error('Invalid or expired reset token');
    err.statusCode = 400;
    throw err;
  }

  const record = rows[0];

  if (record.used) {
    const err = new Error('Reset token has already been used');
    err.statusCode = 400;
    throw err;
  }

  if (new Date(record.expires_at) < new Date()) {
    const err = new Error('Reset token has expired');
    err.statusCode = 400;
    throw err;
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, record.user_id]
    );
    await client.query(
      `UPDATE password_reset_tokens SET used = TRUE WHERE id = $1`,
      [record.id]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  logger.info(`Password reset completed for user ${record.user_id}`);
  return { message: 'Password has been reset successfully.' };
};

/**
 * Change own password (requires current password — authenticated flow).
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const { rows } = await db.query(
    `SELECT id, password_hash FROM users WHERE id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) {
    const err = new Error('Current password is incorrect');
    err.statusCode = 401;
    throw err;
  }

  if (currentPassword === newPassword) {
    const err = new Error('New password must be different from current password');
    err.statusCode = 422;
    throw err;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [newHash, userId]
  );

  logger.info(`Password changed for user ${userId}`);
  return { message: 'Password changed successfully.' };
};

module.exports = { login, getCurrentUser, forgotPassword, resetPassword, changePassword };
