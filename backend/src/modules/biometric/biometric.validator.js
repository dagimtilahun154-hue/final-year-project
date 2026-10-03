'use strict';
/**
 * src/modules/biometric/biometric.validator.js
 * Validation schemas for Biometric enrollment & guardian verification.
 * SRS Refs: FR-BIO-01–10
 */
const { Joi } = require('../../middleware/validator');

const enrollSchema = Joi.object({
  guardian_link_id: Joi.number().integer().required(),
  reference_data: Joi.string().required(),
});

const verifySchema = Joi.object({
  child_id: Joi.number().integer().required(),
  guardian_user_id: Joi.number().integer().required(),
  method: Joi.string().valid('biometric', 'manual').required(),
  sample_data: Joi.string().allow(null, ''),
});

module.exports = {
  enrollSchema,
  verifySchema,
};
