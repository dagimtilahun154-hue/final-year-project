'use strict';
/**
 * src/modules/audit/audit.controller.js
 * Controller for Audit Logging & Security Trail.
 */
const svc = require('./audit.service');

const listAuditLogs = async (req, res, next) => {
  try {
    const result = await svc.listAuditLogs(req.query);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

module.exports = {
  listAuditLogs,
};
