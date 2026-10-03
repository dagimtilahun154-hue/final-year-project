'use strict';
const { Joi } = require('../../middleware/validator');

const createUserSchema = Joi.object({
  name:     Joi.string().max(150).required(),
  email:    Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(128).required(),
  role:     Joi.string().valid('admin','caregiver','parent').required(),
});

const updateUserSchema = Joi.object({
  name:  Joi.string().max(150),
  email: Joi.string().email().max(255),
}).min(1);

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('active','inactive').required(),
});

const updateMyProfileSchema = Joi.object({
  name:  Joi.string().max(150),
  email: Joi.string().email().max(255),
}).min(1);

module.exports = { createUserSchema, updateUserSchema, updateStatusSchema, updateMyProfileSchema };
