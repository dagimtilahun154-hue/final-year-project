'use strict';
/**
 * src/modules/attendance/attendance.controller.js
 * Attendance Controller — thin layer calling service.
 */
const svc = require('./attendance.service');

const recordAttendance = async (req, res, next) => {
  try {
    const result = await svc.recordAttendance(req.body, req.user);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
};

const getChildAttendance = async (req, res, next) => {
  try {
    const result = await svc.getChildAttendance(req.params.id, req.query, req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

const listAttendance = async (req, res, next) => {
  try {
    const result = await svc.listAttendance(req.query, req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

const getAttendanceSummary = async (req, res, next) => {
  try {
    const result = await svc.getAttendanceSummary(req.query, req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

module.exports = {
  recordAttendance,
  getChildAttendance,
  listAttendance,
  getAttendanceSummary,
};
