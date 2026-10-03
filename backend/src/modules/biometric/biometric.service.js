'use strict';
/**
 * src/modules/biometric/biometric.service.js
 * Business logic for Biometric Enrollment & Guardian Verification.
 * SRS Refs: FR-BIO-01–10, FR-AUD-03
 */
const db = require('../../config/db');
const { isParentLinked } = require('../children/children.service');
const { logAudit } = require('../audit/audit.service');

/**
 * Enroll biometric reference for an authorized adult guardian link (Admin only).
 */
const enroll = async (body, user) => {
  const linkId = parseInt(body.guardian_link_id, 10);

  // 1. Verify guardian link exists
  const { rows: linkRows } = await db.query(
    `SELECT id, user_id, child_id FROM guardian_links WHERE id = $1 AND pickup_authorized=TRUE`,
    [linkId]
  );

  if (linkRows.length === 0) {
    const err = new Error('Guardian link not found');
    err.statusCode = 404;
    throw err;
  }

  const link = linkRows[0];

  // 2. Upsert biometric reference
  const { rows } = await db.query(
    `INSERT INTO biometric_references (guardian_link_id, user_id, reference_data, enrolled_by, active)
     VALUES ($1, $2, $3, $4, TRUE)
     ON CONFLICT (guardian_link_id)
     DO UPDATE SET reference_data = EXCLUDED.reference_data, enrolled_by = EXCLUDED.enrolled_by, active = TRUE, enrolled_at = NOW()
     RETURNING *`,
    [linkId, link.user_id, body.reference_data, user.id]
  );

  await logAudit(user.id, 'BIOMETRIC_ENROLLED', 'biometric_references', rows[0].id, { guardian_link_id: linkId, user_id: link.user_id });

  return rows[0];
};

/**
 * Verify guardian identity during child pickup (Admin / Caregiver).
 * Records verification event in audit log (FR-AUD-03).
 */
const verify = async () => {
 const error=new Error('Use the front-desk pickup flow. Standalone biometric verification is unavailable until the device provider is configured.'); error.statusCode=503; throw error;
};

/**
 * Get active biometric reference for a guardian link.
 */
const getGuardianBiometric = async (guardianLinkIdParam) => {
  const linkId = parseInt(guardianLinkIdParam, 10);

  const { rows } = await db.query(
    `SELECT br.id, br.guardian_link_id, br.user_id, br.enrolled_at, br.active,
            u.name AS guardian_name
     FROM biometric_references br
     JOIN users u ON u.id = br.user_id
     WHERE br.guardian_link_id = $1 AND br.active = TRUE`,
    [linkId]
  );

  if (rows.length === 0) {
    const err = new Error('No active biometric reference enrolled for this guardian link');
    err.statusCode = 404;
    throw err;
  }

  return rows[0];
};

module.exports = {
  enroll,
  verify,
  getGuardianBiometric,
};
