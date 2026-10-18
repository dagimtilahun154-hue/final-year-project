'use strict';
/**
 * Service functions for Emergency Contacts & Care Instructions (standalone CRUD).
 * Added as Phase 5 Priority 1 — child profile editing support.
 */
const db = require('../../config/db');
const { auditedWrite } = require('../../utils/auditedWrite');

// ── Emergency Contacts ───────────────────────────────────────────────────────

const addContact = async (childId, body, actor) => {
  const actorId = typeof actor === 'object' && actor !== null ? actor.id : actor;
  const isSuperAdmin = typeof actor === 'object' && actor !== null && actor.role === 'super_admin';
  const daycareId = typeof actor === 'object' && actor !== null ? actor.daycare_id : null;
  const cId = parseInt(childId, 10);

  return auditedWrite(actor, 'EMERGENCY_CONTACT_ADDED', 'emergency_contacts', async client => {
    const check = await client.query(`SELECT id, daycare_id FROM children WHERE id = $1`, [cId]);
    if (check.rows.length === 0 || (!isSuperAdmin && check.rows[0].daycare_id !== daycareId)) {
      const e = new Error('Child not found');
      e.statusCode = 404;
      throw e;
    }

    const { rows } = await client.query(
      `INSERT INTO emergency_contacts (child_id, name, relationship, phone)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [cId, body.name, body.relationship, body.phone]
    );
    return rows[0];
  }, {}, daycareId);
};

const updateContact = async (contactId, body, actor) => {
  const isSuperAdmin = typeof actor === 'object' && actor !== null && actor.role === 'super_admin';
  const daycareId = typeof actor === 'object' && actor !== null ? actor.daycare_id : null;
  const id = parseInt(contactId, 10);

  return auditedWrite(actor, 'EMERGENCY_CONTACT_UPDATED', 'emergency_contacts', async client => {
    const check = await client.query(
      `SELECT ec.id FROM emergency_contacts ec JOIN children c ON c.id = ec.child_id WHERE ec.id = $1 AND ($2::boolean OR c.daycare_id = $3)`,
      [id, isSuperAdmin, daycareId]
    );
    if (check.rows.length === 0) {
      const e = new Error('Emergency contact not found');
      e.statusCode = 404;
      throw e;
    }

    const fields = []; const vals = []; let idx = 1;
    if (body.name !== undefined) { fields.push(`name = $${idx++}`); vals.push(body.name); }
    if (body.relationship !== undefined) { fields.push(`relationship = $${idx++}`); vals.push(body.relationship); }
    if (body.phone !== undefined) { fields.push(`phone = $${idx++}`); vals.push(body.phone); }
    if (fields.length === 0) { const e = new Error('No fields provided'); e.statusCode = 422; throw e; }
    vals.push(id);
    const { rows } = await client.query(
      `UPDATE emergency_contacts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return rows[0];
  }, {}, daycareId);
};

const deleteContact = async (contactId, actor = null) => {
  const isSuperAdmin = typeof actor === 'object' && actor !== null && actor.role === 'super_admin';
  const daycareId = typeof actor === 'object' && actor !== null ? actor.daycare_id : null;
  const id = parseInt(contactId, 10);

  const check = await db.query(
    `SELECT ec.id FROM emergency_contacts ec JOIN children c ON c.id = ec.child_id WHERE ec.id = $1 AND ($2::boolean OR c.daycare_id = $3)`,
    [id, isSuperAdmin, daycareId]
  );
  if (check.rows.length === 0) {
    const e = new Error('Emergency contact not found');
    e.statusCode = 404;
    throw e;
  }

  const { rows } = await db.query(`DELETE FROM emergency_contacts WHERE id = $1 RETURNING id`, [id]);
  return { message: 'Emergency contact deleted' };
};

// ── Care Instructions ────────────────────────────────────────────────────────

const addInstruction = async (childId, body, actor) => {
  const isSuperAdmin = typeof actor === 'object' && actor !== null && actor.role === 'super_admin';
  const daycareId = typeof actor === 'object' && actor !== null ? actor.daycare_id : null;
  const cId = parseInt(childId, 10);

  return auditedWrite(actor, 'CARE_INSTRUCTION_ADDED', 'care_instructions', async client => {
    const check = await client.query(`SELECT id, daycare_id FROM children WHERE id = $1`, [cId]);
    if (check.rows.length === 0 || (!isSuperAdmin && check.rows[0].daycare_id !== daycareId)) {
      const e = new Error('Child not found');
      e.statusCode = 404;
      throw e;
    }

    const { rows } = await client.query(
      `INSERT INTO care_instructions (child_id, category, instruction_text)
       VALUES ($1, $2, $3) RETURNING *`,
      [cId, body.category, body.instruction_text]
    );
    return rows[0];
  }, {}, daycareId);
};

const updateInstruction = async (instructionId, body, actor) => {
  const isSuperAdmin = typeof actor === 'object' && actor !== null && actor.role === 'super_admin';
  const daycareId = typeof actor === 'object' && actor !== null ? actor.daycare_id : null;
  const id = parseInt(instructionId, 10);

  return auditedWrite(actor, 'CARE_INSTRUCTION_UPDATED', 'care_instructions', async client => {
    const check = await client.query(
      `SELECT ci.id FROM care_instructions ci JOIN children c ON c.id = ci.child_id WHERE ci.id = $1 AND ($2::boolean OR c.daycare_id = $3)`,
      [id, isSuperAdmin, daycareId]
    );
    if (check.rows.length === 0) {
      const e = new Error('Care instruction not found');
      e.statusCode = 404;
      throw e;
    }

    const fields = []; const vals = []; let idx = 1;
    if (body.category !== undefined) { fields.push(`category = $${idx++}`); vals.push(body.category); }
    if (body.instruction_text !== undefined) { fields.push(`instruction_text = $${idx++}`); vals.push(body.instruction_text); }
    if (fields.length === 0) { const e = new Error('No fields provided'); e.statusCode = 422; throw e; }
    vals.push(id);
    const { rows } = await client.query(
      `UPDATE care_instructions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return rows[0];
  }, {}, daycareId);
};

const deleteInstruction = async (instructionId, actor = null) => {
  const isSuperAdmin = typeof actor === 'object' && actor !== null && actor.role === 'super_admin';
  const daycareId = typeof actor === 'object' && actor !== null ? actor.daycare_id : null;
  const id = parseInt(instructionId, 10);

  const check = await db.query(
    `SELECT ci.id FROM care_instructions ci JOIN children c ON c.id = ci.child_id WHERE ci.id = $1 AND ($2::boolean OR c.daycare_id = $3)`,
    [id, isSuperAdmin, daycareId]
  );
  if (check.rows.length === 0) {
    const e = new Error('Care instruction not found');
    e.statusCode = 404;
    throw e;
  }

  const { rows } = await db.query(`DELETE FROM care_instructions WHERE id = $1 RETURNING id`, [id]);
  return { message: 'Care instruction deleted' };
};

module.exports = { addContact, updateContact, deleteContact, addInstruction, updateInstruction, deleteInstruction };
