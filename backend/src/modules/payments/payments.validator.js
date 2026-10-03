'use strict';
/**
 * src/modules/payments/payments.validator.js
 * Validation schemas for Payment processing.
 * SRS Refs: FR-ECM-07–10
 */
const { Joi } = require('../../middleware/validator');

const initiatePaymentSchema = Joi.object({
  order_id: Joi.number().integer().required(),
  method: Joi.string().valid('pay_at_daycare', 'digital').required(),
});

module.exports = {
  initiatePaymentSchema,
};
