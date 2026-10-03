'use strict';
/**
 * src/modules/children/children.service.js
 * Business logic for Child Profile & Guardian Management.
 * SRS Refs: FR-CH-01–07, UC-03, UC-04, BR-01, BR-02
 * Architecture Plan: §8.3
 */
const db = require('../../config/db');
const {auditedWrite,writeAudit} = require('../../utils/auditedWrite');
async function validateAssignment(client,body) {
 if(body.caregiver_id) {
  const {rows}=await client.query("SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 AND u.status='active' AND r.name='caregiver'",[body.caregiver_id]);
  if(!rows.length)throw Object.assign(new Error('Choose an active caregiver.'),{statusCode:422});
 }
}

/**
 * Authorization helper — Query 4 from §6.2:
 * Index-only scan on UNIQUE(child_id, user_id) index.
 */
const isParentLinked = async (parentUserId, childId) => {
  const { rows } = await db.query(
    `SELECT EXISTS(SELECT 1 FROM guardian_links WHERE user_id = $1 AND child_id = $2) AS linked`,
    [parentUserId, childId]
  );
  return rows[0].linked === true;
};

/**
 * List children (Admin sees all, Caregiver sees assigned only)
 */
const listChildren = async (query = {}, user) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const statusFilter = query.status === 'all' ? null : (query.status || 'active');
  const groupId = query.group_id ? parseInt(query.group_id, 10) : null;
  
  // Caregivers can only see their assigned children (BR-01)
  let caregiverId = query.caregiver_id ? parseInt(query.caregiver_id, 10) : null;
  if (user.role === 'caregiver') {
    caregiverId = user.id;
  }

  // Count query
  const countRes = await db.query(
    `SELECT COUNT(*) AS total FROM children c
     WHERE ($1::text IS NULL OR c.enrollment_status = $1)
       AND ($2::integer IS NULL OR c.group_id = $2)
       AND ($3::integer IS NULL OR c.caregiver_id = $3)`,
    [statusFilter, groupId, caregiverId]
  );
  const total = parseInt(countRes.rows[0].total, 10);

  // Data query with group and caregiver details
  const { rows } = await db.query(
    `SELECT c.id, c.full_name, c.dob, c.gender, c.enrollment_status, c.photo_url, c.created_at,
            g.name AS group_name, u.name AS caregiver_name
     FROM children c
     LEFT JOIN groups g ON g.id = c.group_id
     LEFT JOIN users u  ON u.id = c.caregiver_id
     WHERE ($1::text IS NULL OR c.enrollment_status = $1)
       AND ($2::integer IS NULL OR c.group_id = $2)
       AND ($3::integer IS NULL OR c.caregiver_id = $3)
     ORDER BY g.name NULLS LAST, c.full_name ASC
     LIMIT $4 OFFSET $5`,
    [statusFilter, groupId, caregiverId, limit, offset]
  );

  return {
    data: rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Register new child profile (Admin only)
 * Optional transactional insertion of emergency contacts & care instructions
 */
const createChild = async (body, actorId) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await validateAssignment(client,body);

    const insertChildText = `
      INSERT INTO children (full_name, dob, gender, group_id, caregiver_id, enrollment_status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const childVals = [
      body.full_name,
      body.dob,
      body.gender || null,
      body.group_id || null,
      body.caregiver_id || null,
      body.enrollment_status || 'active',
    ];
    const childRes = await client.query(insertChildText, childVals);
    const child = childRes.rows[0];

    // Batch insert emergency contacts if provided
    const contacts = [];
    if (Array.isArray(body.emergency_contacts) && body.emergency_contacts.length > 0) {
      for (const contact of body.emergency_contacts) {
        const contactRes = await client.query(
          `INSERT INTO emergency_contacts (child_id, name, relationship, phone)
           VALUES ($1, $2, $3, $4) RETURNING id, name, relationship, phone`,
          [child.id, contact.name, contact.relationship, contact.phone]
        );
        contacts.push(contactRes.rows[0]);
      }
    }

    // Batch insert care instructions if provided
    const instructions = [];
    if (Array.isArray(body.care_instructions) && body.care_instructions.length > 0) {
      for (const inst of body.care_instructions) {
        const instRes = await client.query(
          `INSERT INTO care_instructions (child_id, category, instruction_text)
           VALUES ($1, $2, $3) RETURNING id, category, instruction_text`,
          [child.id, inst.category, inst.instruction_text]
        );
        instructions.push(instRes.rows[0]);
      }
    }

    await writeAudit(client,actorId,'CHILD_REGISTERED','children',child.id);
    await client.query('COMMIT');

    return {
      ...child,
      emergency_contacts: contacts,
      care_instructions: instructions,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Get detailed child profile (3-query pattern to avoid cartesian product)
 * Checks authorization for parents & caregivers.
 */
const getChild = async (id, user) => {
  const childId = parseInt(id, 10);

  // Authorization check for parent role (FR-UAM-05)
  if (user.role === 'parent') {
    const linked = await isParentLinked(user.id, childId);
    if (!linked) {
      const err = new Error('Access denied: You are not linked to this child record');
      err.statusCode = 403;
      throw err;
    }
  }

  // Query 1: Child details with group & caregiver names
  const { rows: childRows } = await db.query(
    `SELECT c.*, g.name AS group_name, u.name AS caregiver_name
     FROM children c
     LEFT JOIN groups g ON g.id = c.group_id
     LEFT JOIN users u  ON u.id = c.caregiver_id
     WHERE c.id = $1`,
    [childId]
  );

  if (childRows.length === 0) {
    const err = new Error('Child profile not found');
    err.statusCode = 404;
    throw err;
  }

  const child = childRows[0];

  // Authorization check for caregiver role
  if (user.role === 'caregiver' && child.caregiver_id !== user.id) {
    const err = new Error('Access denied: You are not assigned to this child');
    err.statusCode = 403;
    throw err;
  }

  // Query 2: Emergency contacts
  const { rows: contacts } = await db.query(
    `SELECT id, name, relationship, phone FROM emergency_contacts WHERE child_id = $1 ORDER BY id ASC`,
    [childId]
  );

  // Query 3: Care instructions
  const { rows: instructions } = await db.query(
    `SELECT id, category, instruction_text FROM care_instructions WHERE child_id = $1 ORDER BY category ASC, id ASC`,
    [childId]
  );

  return {
    ...child,
    emergency_contacts: contacts,
    care_instructions: instructions,
  };
};

/**
 * Update child profile (Admin only, partial update)
 */
const updateChild = async (id, body, actorId) => auditedWrite(actorId, 'CHILD_UPDATED', 'children', async client => {
  await validateAssignment(client,body);
  const childId = parseInt(id, 10);

  const fields = [];
  const values = [];
  let idx = 1;

  const allowedKeys = ['full_name', 'dob', 'gender', 'group_id', 'caregiver_id', 'enrollment_status', 'photo_url'];

  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      fields.push(`${key} = $${idx}`);
      values.push(body[key]);
      idx++;
    }
  }

  if (fields.length === 0) {
    const err = new Error('No valid fields provided for update');
    err.statusCode = 422;
    throw err;
  }

  values.push(childId);
  const queryText = `UPDATE children SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;

  const { rows } = await client.query(queryText, values);
  if (rows.length === 0) {
    const err = new Error('Child profile not found');
    err.statusCode = 404;
    throw err;
  }

  return rows[0];
});

/**
 * Link parent/guardian to child (Admin only)
 */
const addGuardian = async (childId, body, adminUserId) => {
  const cId = parseInt(childId, 10);
  const targetUserId = parseInt(body.user_id, 10);

  // Verify child exists
  const childCheck = await db.query(`SELECT 1 FROM children WHERE id = $1`, [cId]);
  if (childCheck.rows.length === 0) {
    const err = new Error('Child profile not found');
    err.statusCode = 404;
    throw err;
  }

  // Verify target user exists, is active, and has role='parent' (FR-CH-04, BR-02)
  const userCheck = await db.query(
    `SELECT u.id, u.status, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [targetUserId]
  );

  if (userCheck.rows.length === 0 || userCheck.rows[0].status !== 'active' || userCheck.rows[0].role_name !== 'parent') {
    const err = new Error('Target user must be an active user account with the parent role');
    err.statusCode = 422;
    throw err;
  }

  try {
    return await auditedWrite(adminUserId,'GUARDIAN_LINKED','guardian_links',async client => {
    const { rows } = await client.query(
      `INSERT INTO guardian_links (child_id, user_id, relationship, pickup_authorized, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [cId, targetUserId, body.relationship, body.pickup_authorized ?? false, adminUserId]
    );

    return rows[0];
    }, {child_id:cId,pickup_authorized:!!body.pickup_authorized});
  } catch (err) {
    if (err.code === '23505') {
      const dupErr = new Error('This parent is already linked to the child');
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }
};

/**
 * Get linked guardians for a child (Admin only)
 * Includes biometric enrollment status check via LEFT JOIN
 */
const getGuardians = async (childId) => {
  const cId = parseInt(childId, 10);

  const childCheck = await db.query(`SELECT 1 FROM children WHERE id = $1`, [cId]);
  if (childCheck.rows.length === 0) {
    const err = new Error('Child profile not found');
    err.statusCode = 404;
    throw err;
  }

  const { rows } = await db.query(
    `SELECT gl.id AS guardian_link_id, u.id AS user_id, u.name, u.email,
            gl.relationship, gl.pickup_authorized,
            CASE WHEN br.id IS NOT NULL THEN TRUE ELSE FALSE END AS biometric_enrolled,
            gl.created_at
     FROM guardian_links gl
     JOIN users u ON u.id = gl.user_id
     LEFT JOIN biometric_references br ON br.guardian_link_id = gl.id AND br.active = TRUE
     WHERE gl.child_id = $1
     ORDER BY gl.created_at ASC`,
    [cId]
  );

  return { data: rows };
};

/**
 * Remove parent/guardian link (Admin only)
 */
const removeGuardian = async (childId, guardianLinkId) => {
  const cId = parseInt(childId, 10);
  const glId = parseInt(guardianLinkId, 10);

  const { rows } = await db.query(
    `DELETE FROM guardian_links WHERE id = $1 AND child_id = $2 RETURNING id`,
    [glId, cId]
  );

  if (rows.length === 0) {
    const err = new Error('Guardian link not found for this child');
    err.statusCode = 404;
    throw err;
  }

  return true;
};

module.exports = {
  isParentLinked,
  listChildren,
  createChild,
  getChild,
  updateChild,
  addGuardian,
  getGuardians,
  removeGuardian,
};
