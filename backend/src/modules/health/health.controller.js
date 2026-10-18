'use strict';
/**
 * src/modules/health/health.controller.js
 * Controller for Health & Incident Reporting.
 */
const svc = require('./health.service');

const createRecord = async (req, res, next) => {
  try {
    const result = await svc.createRecord(req.body, req.user);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
};

const getChildHealth = async (req, res, next) => {
  try {
    const result = await svc.getChildHealth(req.params.id, req.query, req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

const markNotified = async (req, res, next) => {
  try {
    const result = await svc.markNotified(req.params.id, req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

module.exports = {
  createRecord,
  getChildHealth,
  markNotified,
};
