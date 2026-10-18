'use strict';

const Joi = require('joi');

const positiveInteger = (maximum) => Joi.alternatives().try(
  Joi.number().integer().min(1).max(maximum).strict(),
  Joi.string().pattern(/^[1-9][0-9]{0,9}$/).custom((value, helpers) => {
    const parsed = Number(value);
    return parsed <= maximum ? parsed : helpers.error('any.invalid');
  })
);
const integerId = positiveInteger(2147483647);
const name = Joi.string().trim().min(1).max(150);
const email = Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(255);
const password = Joi.string().custom((value, helpers) => {
  const length = Buffer.byteLength(value, 'utf8');
  return length >= 8 && length <= 72 ? value : helpers.error('any.invalid');
});

const schemas = {
  empty: Joi.object({}).unknown(false),
  id: Joi.object({ id: integerId.required() }).unknown(false),
  list: Joi.object({
    page: positiveInteger(2147483647).default(1),
    limit: positiveInteger(100).default(20),
    role: Joi.string().valid('admin', 'caregiver', 'parent'),
    status: Joi.string().valid('active', 'inactive', 'pending', 'suspended'),
  }).unknown(false),
  create: Joi.object({
    name: name.required(),
    email: email.required(),
    password: password.required(),
    role: Joi.string().valid('caregiver', 'parent').required(),
  }).unknown(false).required(),
  update: Joi.object({ name, email }).min(1).unknown(false).required(),
  status: Joi.object({ status: Joi.string().valid('active', 'inactive').required() }).unknown(false).required(),
};

function validateData(schema, data) {
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: false });
  // Return no supplied values (particularly passwords) in validation errors or logs.
  if (error) throw Object.assign(new Error('Invalid request data'), { statusCode: 422 });
  return value;
}

function validate(schema, target) {
  return (req, res, next) => {
    try {
      req[target] = validateData(schema, req[target]);
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { schemas, validateData, validate };
