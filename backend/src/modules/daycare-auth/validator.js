'use strict';

const Joi = require('joi');
const { failure } = require('./errors');

const loginSchema = Joi.object({
  daycare_code: Joi.string().trim().lowercase().max(64)
    .pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/).required(),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(255).required(),
  password: Joi.string().min(1).max(128).required(),
  transport: Joi.string().valid('cookie', 'bearer').default('cookie'),
}).unknown(false).required();

function validateLogin(req, res, next) {
  if (!req.is('application/json')) return next(failure(415, 'Content-Type must be application/json'));
  try {
    req.authInput = validateLoginInput(req.body);
    return next();
  } catch (error) { return next(error); }
}

function validateLoginInput(input) {
  const result = loginSchema.validate(input, { abortEarly: false, convert: true });
  if (result.error) throw failure(422, 'Daycare code, email, password and transport must be valid');
  return result.value;
}

function checkTenantSelectors(req, daycareId) {
  for (const source of [req.body, req.query, req.params]) {
    if (!source || typeof source !== 'object') continue;
    for (const key of ['daycare_id', 'daycareId']) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      const value = source[key];
      if (!['string', 'number'].includes(typeof value)
        || !/^[1-9][0-9]*$/.test(String(value)) || String(value) !== String(daycareId)) {
        throw failure(403, 'Daycare context does not match the authenticated account');
      }
    }
  }
}

module.exports = { loginSchema, validateLogin, validateLoginInput, checkTenantSelectors };
