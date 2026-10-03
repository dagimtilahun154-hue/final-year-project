'use strict';
/**
 * src/middleware/auth.js
 * JWT authentication middleware.
 * Reads token from Authorization header (Bearer) OR HttpOnly cookie.
 * Verifies signature, checks expiry, attaches req.user.
 * SRS Refs: FR-UAM-01, FR-UAM-07, NFR-SEC-07
 */
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const auth = async (req, res, next) => {
  try {
    // Support both HttpOnly cookie and Authorization header
    let token = null;

    // 1. Try Authorization header first (Bearer <token>)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    // 2. Fall back to HttpOnly cookie (preferred for browser clients)
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, secret);

    const { rows } = await db.query('SELECT u.id,u.status,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',[decoded.userId]);
    if (!rows[0] || rows[0].status !== 'active') return res.status(401).json({error:'Account is inactive or unavailable'});
    req.user = {id:rows[0].id,role:rows[0].role};

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid session token' });
    }
    next(err);
  }
};

module.exports = auth;
