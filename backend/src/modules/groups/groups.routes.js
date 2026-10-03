'use strict';
/**
 * Groups Routes — /api/groups
 * SRS Refs: FR-CH-05
 */
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { allowRoles } = require('../../middleware/rbac');
const c = require('./groups.controller');

router.get('/',     auth, c.listGroups);                           // All authenticated
router.post('/',    auth, allowRoles('admin'), c.createGroup);     // Admin only
router.patch('/:id', auth, allowRoles('admin'), c.updateGroup);   // Admin only
router.delete('/:id', auth, allowRoles('admin'), c.deleteGroup);  // Admin only

module.exports = router;
