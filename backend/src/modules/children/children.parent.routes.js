'use strict';
/**
 * Parent Routes — parent-safe child profile management
 * SRS Refs: FR-CH-02, FR-CH-03, FR-UAM-05
 * All routes require auth + role=parent (enforced by allowRoles).
 */
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { allowRoles } = require('../../middleware/rbac');
const parentService = require('./children.parent.service');

const parentOnly = [auth, allowRoles('parent')];

// List this parent's linked children
router.get('/children', ...parentOnly, parentService.listMyChildren);

// Get full profile for one linked child (care + contacts)
router.get('/children/:id', ...parentOnly, parentService.getMyChild);

// Update child basic profile (full_name, dob, gender, group_id, relationship)
router.put('/children/:id/profile', ...parentOnly, parentService.updateChildProfile);

// Replace all care instructions for a linked child
router.put('/children/:id/care', ...parentOnly, parentService.updateCareInstructions);

// Replace emergency contacts for a linked child
router.put('/children/:id/emergency-contacts', ...parentOnly, parentService.updateEmergencyContacts);

// Mark parent account profile as complete
router.patch('/profile-complete', ...parentOnly, parentService.markProfileComplete);

module.exports = router;
