'use strict';
/**
 * src/modules/reports/reports.controller.js
 * Controller layer for Daily Activity Reports.
 */
const svc = require('./reports.service');

const createReport = async (req, res, next) => {
  try {
    const result = await svc.createReport(req.body, req.user);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
};

const getReport = async (req, res, next) => {
  try {
    const result = await svc.getReport(req.params.id, req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

const getChildReports = async (req, res, next) => {
  try {
    const result = await svc.getChildReports(req.params.id, req.query, req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

const listReports = async (req, res, next) => {
  try {
    const result = await svc.listReports(req.query);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

module.exports = {
  createReport,
  getReport,
  getChildReports,
  listReports,
};
