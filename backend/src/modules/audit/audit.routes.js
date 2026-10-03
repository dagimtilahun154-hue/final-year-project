'use strict';
// Audit Routes — §8.13 | SRS: FR-AUD-01–05
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { allowRoles } = require('../../middleware/rbac');
const c = require('./audit.controller');

// Admin-only audit log access (FR-AUD-05)
router.get('/', auth, allowRoles('admin'), c.listAuditLogs);

module.exports = router;
