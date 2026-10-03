'use strict';
/**
 * src/modules/attendance/attendance.routes.js
 * Attendance Routes — §8.4 | SRS: FR-ATT-01–07
 */
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { allowRoles } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validator');
const { recordAttendanceSchema } = require('./attendance.validator');
const c = require('./attendance.controller');

router.get('/', auth, allowRoles('admin'), c.listAttendance);
router.get('/summary', auth, allowRoles('admin', 'caregiver', 'parent'), c.getAttendanceSummary);
router.get('/child/:id', auth, allowRoles('admin', 'caregiver', 'parent'), c.getChildAttendance);
router.post('/', auth, allowRoles('admin', 'caregiver'), validate(recordAttendanceSchema), c.recordAttendance);

module.exports = router;
