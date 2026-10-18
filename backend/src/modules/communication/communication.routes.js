'use strict';
/**
 * src/modules/communication/communication.routes.js
 * Communication Routes — §8.7 | SRS: FR-COM-01–08
 */
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { allowRoles } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validator');
const {
  createAnnouncementSchema,
  sendMessageSchema,
  createAlertSchema,
} = require('./communication.validator');
const c = require('./communication.controller');

// Announcements
router.get('/announcements/meal-plan', auth, c.listMealPlans);
router.get('/announcements', auth, c.listAnnouncements);
router.post('/announcements', auth, allowRoles('admin'), validate(createAnnouncementSchema), c.createAnnouncement);

// Messages
router.get('/messages', auth, c.listMessages);
router.post('/messages', auth, validate(sendMessageSchema), c.sendMessage);
router.patch('/messages/:id/read', auth, c.markMessageRead);
router.get('/contacts', auth, c.listContacts);


// Alerts
router.get('/alerts', auth, c.listAlerts);
router.post('/alerts', auth, allowRoles('admin'), validate(createAlertSchema), c.createAlert);

module.exports = router;
