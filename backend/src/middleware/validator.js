'use strict';
/**
 * src/middleware/validator.js
 * Generic Joi schema validation middleware factory.
 * SRS Refs: NFR-USA-03, NFR-REL-02, FR-DB-03
 *
 * Usage:
 *   const { validate } = require('../middleware/validator');
 *   router.post('/users', auth, allowRoles('admin'), validate(createUserSchema), createUser);
 */
const Joi = require('joi');

/**
 * Factory — returns middleware that validates req.body against a Joi schema.
 * On failure, passes a structured ValidationError to the centralized errorHandler.
 *
 * @param {Joi.Schema} schema - Joi schema to validate req.body against
 * @param {'body'|'params'|'query'} [target='body'] - Which request part to validate
 * @returns {Function} Express middleware
 */
const validate = (schema, target = 'body') => (req, res, next) => {
  const data = req[target];
  const { error, value } = schema.validate(data, {
    abortEarly: false,    // collect ALL validation errors at once
    stripUnknown: true,   // silently drop unknown fields (NFR-SEC-04)
  });

  if (error) {
    // Mark as Joi error so errorHandler formats it correctly
    error.isJoi = true;
    return next(error);
  }

  // Replace the request target with the validated + sanitized value
  req[target] = value;
  next();
};

module.exports = { validate, Joi };
