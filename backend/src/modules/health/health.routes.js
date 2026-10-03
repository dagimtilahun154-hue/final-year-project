'use strict';
/**
 * src/modules/health/health.routes.js
 * Health Routes — §8.6 | SRS: FR-HIR-01–06
 */
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { allowRoles } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validator');
const { createRecordSchema } = require('./health.validator');
const c = require('./health.controller');

router.get('/child/:id', auth, allowRoles('admin', 'caregiver', 'parent'), c.getChildHealth);
router.post('/', auth, allowRoles('admin', 'caregiver'), validate(createRecordSchema), c.createRecord);
router.patch('/:id/notify', auth, allowRoles('admin', 'caregiver'), c.markNotified);

module.exports = router;
