'use strict';
/**
 * src/modules/attendance/attendance.validator.js
 * Validation schemas for attendance events.
 * SRS Refs: FR-ATT-01–04
 */
const { Joi } = require('../../middleware/validator');

const recordAttendanceSchema = Joi.object({
  child_id: Joi.number().integer().required(),
  event_type: Joi.string().valid('checkin', 'checkout', 'absent').required(),
  notes: Joi.string().max(500).allow(null, ''),
});

module.exports = {
  recordAttendanceSchema,
};
