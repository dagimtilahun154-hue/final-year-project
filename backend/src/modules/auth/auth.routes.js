'use strict';
/**
 * Auth Routes — POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
 * SRS Refs: UC-01, FR-UAM-01, FR-UAM-07
 * Architecture Plan: §8.1
 */
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { validate } = require('../../middleware/validator');
const { loginSchema } = require('./auth.validator');
const authController = require('./auth.controller');

// POST /api/auth/login — public (rate-limited in app.js)
router.post('/login', validate(loginSchema), authController.login);

// POST /api/auth/logout — requires auth (clears session)
router.post('/logout', auth, authController.logout);

// GET /api/auth/me — returns current user's profile
router.get('/me', auth, authController.me);

// POST /api/auth/forgot-password — public, returns reset token (dev: in response; prod: via email)
router.post('/forgot-password', authController.forgotPassword);

// POST /api/auth/reset-password — public, consumes token and sets new password
router.post('/reset-password', authController.resetPassword);

// PATCH /api/auth/change-password — authenticated, requires current password
router.patch('/change-password', auth, authController.changePassword);

module.exports = router;
