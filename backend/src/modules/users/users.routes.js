'use strict';
/**
 * Users Routes — Admin-only user management
 * SRS Refs: FR-UAM-04, FR-UAM-08, §8.2
 */
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { allowRoles } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validator');
const { createUserSchema, updateUserSchema, updateStatusSchema, updateMyProfileSchema } = require('./users.validator');
const usersController = require('./users.controller');

// Self-service profile endpoints (all authenticated roles)
router.get('/profile/me', auth, usersController.getMyProfile);
router.patch('/profile/me', auth, validate(updateMyProfileSchema), usersController.updateMyProfile);

const adminOnly = [auth, allowRoles('admin')];

router.get('/',           ...adminOnly,                              usersController.listUsers);
router.post('/',          ...adminOnly, validate(createUserSchema),  usersController.createUser);
router.get('/:id',        ...adminOnly,                              usersController.getUser);
router.patch('/:id',      ...adminOnly, validate(updateUserSchema),  usersController.updateUser);
router.patch('/:id/status', ...adminOnly, validate(updateStatusSchema), usersController.updateStatus);

module.exports = router;
