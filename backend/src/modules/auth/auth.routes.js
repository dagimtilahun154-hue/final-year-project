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
const { loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } = require('./auth.validator');
const authController = require('./auth.controller');

// POST /api/auth/login — public (rate-limited in app.js)
router.post('/login', validate(loginSchema), authController.login);

// Parent accounts are provisioned by daycare administrators.
router.post('/register', authController.register);

// POST /api/auth/logout — requires auth (clears session)
router.post('/logout', auth, authController.logout);

// GET /api/auth/me — returns current user's profile
router.get('/me', auth, authController.me);

// Development/test inbox delivery; never returns a reset credential publicly.
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

// POST /api/auth/reset-password — public, consumes token and sets new password
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

// PATCH /api/auth/change-password — authenticated, requires current password
router.patch('/change-password', auth, validate(changePasswordSchema), authController.changePassword);

module.exports = router;
