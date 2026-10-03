'use strict';
/**
 * src/modules/notifications/notifications.routes.js
 * Aggregated Notifications & Badges — all authenticated users
 */
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const notificationsController = require('./notifications.controller');

router.get('/', auth, notificationsController.getNotifications);

module.exports = router;
