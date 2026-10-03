'use strict';
/**
 * Dashboard Routes — /api/dashboard
 * Admin-only aggregated statistics.
 */
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { allowRoles } = require('../../middleware/rbac');
const c = require('./dashboard.controller');

router.get('/', auth, allowRoles('admin'), c.getStats);

module.exports = router;
