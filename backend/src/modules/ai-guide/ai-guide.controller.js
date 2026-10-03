'use strict';
/**
 * src/modules/ai-guide/ai-guide.controller.js
 * Controller for AI Parent Guide Assistant.
 */
const svc = require('./ai-guide.service');

const getGuidance = async (req, res, next) => {
  try {
    const result = await svc.getGuidance(req.body, req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

module.exports = {
  getGuidance,
};
