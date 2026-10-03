'use strict';
/**
 * src/modules/notifications/notifications.controller.js
 */
const notificationsService = require('./notifications.service');

const getNotifications = async (req, res, next) => {
  try {
    const data = await notificationsService.getNotifications(req.user);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifications,
};
