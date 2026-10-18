'use strict';

const Joi = require('joi');
const { failure } = require('../daycare-auth/errors');

const transport = Joi.string().valid('cookie', 'bearer').default('cookie');
const email = Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(255).required();
const loginSchema = Joi.object({
  email, password: Joi.string().min(1).max(128).required(), transport,
}).unknown(false).required();
const setupSchema = Joi.object({ challenge_token: Joi.string().max(256).required() }).unknown(false).required();
const verifySchema = Joi.object({
  challenge_token: Joi.string().max(256).required(),
  totp_code: Joi.string().pattern(/^\d{6}$/),
  recovery_code: Joi.string().min(1).max(256),
  transport,
}).xor('totp_code', 'recovery_code').unknown(false).required();
const bootstrapSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(), email,
  password: Joi.string().min(1).max(72).required(),
}).unknown(false).required();

function validate(schema, input, message) {
  const result = schema.validate(input, { convert: true, abortEarly: false });
  if (result.error) throw failure(422, message);
  return result.value;
}
const validateLoginInput = input => validate(loginSchema, input, 'Email, password and transport must be valid');
const validateSetupInput = input => validate(setupSchema, input, 'MFA challenge must be valid');
const validateVerifyInput = input => validate(verifySchema, input, 'MFA challenge, verification code and transport must be valid');
function validateBootstrapInput(input) {
  const result = validate(bootstrapSchema, input, 'Owner name, email and password must be valid');
  const bytes = Buffer.byteLength(result.password, 'utf8');
  if (bytes < 12 || bytes > 72 || result.password.includes('\0')) {
    throw failure(422, 'Owner password must be between 12 and 72 UTF-8 bytes');
  }
  return result;
}
function jsonInput(validateInput) {
  return (req, res, next) => {
    try {
      if (!req.is('application/json')) throw failure(415, 'Content-Type must be application/json');
      req.platformInput = validateInput(req.body);
      next();
    } catch (error) { next(error); }
  };
}

module.exports = { validateLoginInput, validateSetupInput, validateVerifyInput, validateBootstrapInput, jsonInput };
