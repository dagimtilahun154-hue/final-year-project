'use strict';
/**
 * Auth Validators — Joi schemas for auth endpoints
 * SRS Refs: NFR-USA-03, NFR-SEC-04
 */
const { Joi } = require('../../middleware/validator');

const loginSchema = Joi.object({
  email:    Joi.string().email().max(255).required()
              .messages({ 'string.email': 'Please enter a valid email address' }),
  password: Joi.string().min(6).max(128).required()
              .messages({ 'string.min': 'Password must be at least 6 characters' }),
});

module.exports = { loginSchema };
