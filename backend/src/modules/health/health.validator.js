'use strict';
/**
 * src/modules/health/health.validator.js
 * Validation schema for Health & Incident Records.
 * SRS Refs: FR-HIR-01–06
 */
const { Joi } = require('../../middleware/validator');

const createRecordSchema = Joi.object({
  child_id: Joi.number().integer().required(),
  record_type: Joi.string().valid('health', 'incident').required(),
  description: Joi.string().required(),
  severity: Joi.string().valid('low', 'moderate', 'high').allow(null),
  parent_notified: Joi.boolean().default(false),
});

module.exports = {
  createRecordSchema,
};
