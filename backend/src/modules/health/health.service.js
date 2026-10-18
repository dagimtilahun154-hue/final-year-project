'use strict';
/**
 * src/modules/health/health.service.js
 * Business logic for Health & Incident Reporting.
 * SRS Refs: FR-HIR-01–06, BR-05
 */
const db = require('../../config/db');
const { isParentLinked } = require('../children/children.service');
const { logAudit } = require('../audit/audit.service');

const MEDICAL_DISCLAIMER = 'Reporting functionality only. This record does not constitute medical diagnosis or advice.';

/**
 * Record a health observation or unusual incident (Admin or Caregiver).
 */
const createRecord = async (body, user) => {
  const childId = parseInt(body.child_id, 10);

  // 1. Verify child exists & belongs to daycare
  const { rows: childRows } = await db.query(
    `SELECT id, caregiver_id, daycare_id FROM children WHERE id = $1`,
    [childId]
  );
  if (childRows.length === 0) {
    const err = new Error('Child profile not found');
    err.statusCode = 404;
    throw err;
  }

  const child = childRows[0];
  if (user.role !== 'super_admin' && user.daycare_id && child.daycare_id !== user.daycare_id) {
    const err = new Error('Child profile not found');
    err.statusCode = 404;
    throw err;
  }

  if (user.role === 'caregiver' && child.caregiver_id !== user.id) {
    const err = new Error('Access denied: You are not assigned to this child');
    err.statusCode = 403;
    throw err;
  }

  // 2. Insert record stamped with child's daycare_id
  const { rows } = await db.query(
    `INSERT INTO health_records (child_id, recorded_by, record_type, description, severity, parent_notified, daycare_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      childId,
      user.id,
      body.record_type,
      body.description,
      body.severity || null,
      body.parent_notified ?? false,
      child.daycare_id,
    ]
  );

  await logAudit(
    user.id,
    'HEALTH_RECORD_CREATED',
    'health_records',
    rows[0].id,
    { child_id: childId, record_type: body.record_type, severity: body.severity },
    null,
    child.daycare_id
  );

  return {
    ...rows[0],
    disclaimer: MEDICAL_DISCLAIMER,
  };
};

/**
 * Fetch health & incident history for a specific child.
 */
const getChildHealth = async (childIdParam, query = {}, user) => {
  const childId = parseInt(childIdParam, 10);

  const { rows: childRows } = await db.query(
    `SELECT id, caregiver_id, daycare_id FROM children WHERE id = $1`,
    [childId]
  );
  if (childRows.length === 0) {
    const err = new Error('Child profile not found');
    err.statusCode = 404;
    throw err;
  }

  const child = childRows[0];
  if (user.role !== 'super_admin' && user.daycare_id && child.daycare_id !== user.daycare_id) {
    const err = new Error('Child profile not found');
    err.statusCode = 404;
    throw err;
  }

  // Authorization checks
  if (user.role === 'parent') {
    const linked = await isParentLinked(user.id, childId);
    if (!linked) {
      const err = new Error('Access denied: You are not linked to this child record');
      err.statusCode = 403;
      throw err;
    }
  } else if (user.role === 'caregiver' && child.caregiver_id !== user.id) {
    const err = new Error('Access denied: You are not assigned to this child');
    err.statusCode = 403;
    throw err;
  }

  const typeFilter = query.record_type || null;

  const { rows } = await db.query(
    `SELECT hr.id, hr.child_id, hr.record_type, hr.description, hr.severity, hr.parent_notified, hr.recorded_at, hr.daycare_id,
            u.name AS recorded_by_name
     FROM health_records hr
     JOIN users u ON u.id = hr.recorded_by
     WHERE hr.child_id = $1
       AND ($2::text IS NULL OR hr.record_type = $2)
     ORDER BY hr.recorded_at DESC`,
    [childId, typeFilter]
  );

  return {
    data: rows,
    disclaimer: MEDICAL_DISCLAIMER,
  };
};

/**
 * Update parent notification status.
 */
const markNotified = async (recordIdParam, user) => {
  const recordId = parseInt(recordIdParam, 10);

  const { rows: existingRows } = await db.query(
    `SELECT hr.*, c.daycare_id, c.caregiver_id
     FROM health_records hr
     JOIN children c ON c.id = hr.child_id
     WHERE hr.id = $1`,
    [recordId]
  );
  if (existingRows.length === 0) {
    const err = new Error('Health record not found');
    err.statusCode = 404;
    throw err;
  }

  const existing = existingRows[0];
  if (user && user.role !== 'super_admin' && user.daycare_id && existing.daycare_id !== user.daycare_id) {
    const err = new Error('Health record not found');
    err.statusCode = 404;
    throw err;
  }

  if (user && user.role === 'caregiver' && existing.caregiver_id !== user.id) {
    const err = new Error('Access denied: You are not assigned to this child');
    err.statusCode = 403;
    throw err;
  }

  const { rows } = await db.query(
    `UPDATE health_records SET parent_notified = TRUE WHERE id = $1 RETURNING *`,
    [recordId]
  );

  await logAudit(
    user.id,
    'HEALTH_RECORD_NOTIFIED',
    'health_records',
    recordId,
    { child_id: existing.child_id, parent_notified: true },
    null,
    existing.daycare_id
  );

  return {
    ...rows[0],
    disclaimer: MEDICAL_DISCLAIMER,
  };
};

module.exports = {
  createRecord,
  getChildHealth,
  markNotified,
};
