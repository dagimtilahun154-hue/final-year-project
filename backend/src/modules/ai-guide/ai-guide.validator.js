'use strict';
/**
 * src/modules/ai-guide/ai-guide.validator.js
 * Validation schema for AI Parent Guide inquiries.
 * SRS Refs: FR-AI-01–10
 */
const { Joi } = require('../../middleware/validator');

const aiGuideSchema = Joi.object({
  question: Joi.string().max(1000).required(),
  child_id: Joi.number().integer().allow(null),
});

module.exports = {
  aiGuideSchema,
};
