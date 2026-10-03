'use strict';
/**
 * src/modules/groups/groups.service.js
 * Business logic for Daycare Groups/Class Management.
 * SRS Refs: FR-CH-05, FR-DB-02
 */
const db = require('../../config/db');

const listGroups = async () => {
  const { rows } = await db.query(
    `SELECT g.id, g.name, g.description,
            COUNT(c.id) FILTER (WHERE c.enrollment_status = 'active') AS active_children_count
     FROM groups g
     LEFT JOIN children c ON c.group_id = g.id
     GROUP BY g.id, g.name, g.description
     ORDER BY g.name ASC`
  );
  return { data: rows };
};

const createGroup = async (body) => {
  try {
    const { rows } = await db.query(
      `INSERT INTO groups (name, description) VALUES ($1, $2) RETURNING *`,
      [body.name, body.description || null]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      const e = new Error('A group with this name already exists');
      e.statusCode = 409;
      throw e;
    }
    throw err;
  }
};

const updateGroup = async (groupIdParam, body) => {
  const groupId = parseInt(groupIdParam, 10);
  const fields = [];
  const vals = [];
  let idx = 1;

  if (body.name !== undefined) { fields.push(`name = $${idx++}`); vals.push(body.name); }
  if (body.description !== undefined) { fields.push(`description = $${idx++}`); vals.push(body.description || null); }

  if (fields.length === 0) {
    const err = new Error('No fields provided for update');
    err.statusCode = 422;
    throw err;
  }

  vals.push(groupId);
  const { rows } = await db.query(
    `UPDATE groups SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals
  );

  if (rows.length === 0) {
    const err = new Error('Group not found');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
};

const deleteGroup = async (groupIdParam) => {
  const groupId = parseInt(groupIdParam, 10);

  // Prevent delete if children are still assigned
  const { rows: check } = await db.query(
    `SELECT COUNT(*) AS count FROM children WHERE group_id = $1 AND enrollment_status = 'active'`,
    [groupId]
  );

  if (parseInt(check[0].count, 10) > 0) {
    const err = new Error('Cannot delete a group with active enrolled children. Reassign children first.');
    err.statusCode = 409;
    throw err;
  }

  const { rows } = await db.query(
    `DELETE FROM groups WHERE id = $1 RETURNING id, name`,
    [groupId]
  );

  if (rows.length === 0) {
    const err = new Error('Group not found');
    err.statusCode = 404;
    throw err;
  }
  return { message: `Group "${rows[0].name}" deleted successfully` };
};

module.exports = { listGroups, createGroup, updateGroup, deleteGroup };
