'use strict';
/**
 * Parent-Safe Child Care API
 * Allows a parent/guardian to submit care information for their own linked child.
 * SRS Refs: FR-CH-02, FR-CH-03, FR-CH-06
 *
 * Routes:
 *   GET    /api/parent/children            — list parent's linked children
 *   GET    /api/parent/children/:id        — get full child profile (care + contacts)
 *   PUT    /api/parent/children/:id/care   — replace all care_instructions for a child
 *   PUT    /api/parent/children/:id/emergency-contacts — replace emergency contacts
 *   PATCH  /api/parent/profile-complete    — mark parent account as profile-complete
 */
const db = require('../../config/db');

/** Assert the requesting parent is actually linked to the child. */
async function assertParentOwnsChild(userOrId, childId) {
  const userId = typeof userOrId === 'object' ? userOrId.id : userOrId;
  const user = typeof userOrId === 'object' ? userOrId : null;

  const { rows } = await db.query(
    `SELECT gl.id, c.daycare_id 
     FROM guardian_links gl
     JOIN children c ON c.id = gl.child_id
     WHERE gl.user_id = $1 AND gl.child_id = $2 
     LIMIT 1`,
    [userId, childId]
  );
  if (!rows.length) {
    const err = new Error('Child not linked to this account.');
    err.status = 403;
    throw err;
  }
  if (!user?.daycare_id || rows[0].daycare_id !== user.daycare_id) {
    const err = new Error('Child not linked to this account.');
    err.status = 403;
    throw err;
  }
}

/** GET /api/parent/children */
const listMyChildren = async (req, res, next) => {
  try {
    const isSuper = req.user.role === 'super_admin';
    const daycareId = req.user.daycare_id || null;

    const { rows } = await db.query(
      `SELECT c.id, c.full_name, c.dob, c.gender, c.enrollment_status, c.photo_url, c.group_id, c.daycare_id,
              c.caregiver_id, cg.name AS caregiver_name,
              g.name AS group_name, gl.relationship, gl.pickup_authorized
       FROM guardian_links gl
       JOIN children c ON c.id = gl.child_id
       LEFT JOIN groups g ON g.id = c.group_id
       LEFT JOIN users cg ON cg.id = c.caregiver_id
       WHERE gl.user_id = $1
         AND ($2::boolean = TRUE OR c.daycare_id = $3)
       ORDER BY c.full_name`,
      [req.user.id, isSuper, daycareId]
    );
    res.json({ children: rows });
  } catch (err) {
    next(err);
  }
};

/** GET /api/parent/children/:id */
const getMyChild = async (req, res, next) => {
  try {
    const childId = parseInt(req.params.id, 10);
    await assertParentOwnsChild(req.user, childId);

    const [childRes, careRes, contactsRes] = await Promise.all([
      db.query(
        `SELECT c.id, c.full_name, c.dob, c.gender, c.enrollment_status, c.photo_url, c.group_id,
                c.caregiver_id, cg.name AS caregiver_name,
                g.name AS group_name, gl.relationship, gl.pickup_authorized
         FROM children c
         JOIN guardian_links gl ON gl.child_id = c.id AND gl.user_id = $2
         LEFT JOIN groups g ON g.id = c.group_id
         LEFT JOIN users cg ON cg.id = c.caregiver_id
         WHERE c.id = $1`,
        [childId, req.user.id]
      ),

      db.query(
        `SELECT id, category, instruction_text FROM care_instructions WHERE child_id = $1 ORDER BY category`,
        [childId]
      ),
      db.query(
        `SELECT id, name, relationship, phone FROM emergency_contacts WHERE child_id = $1 ORDER BY id`,
        [childId]
      ),
    ]);

    if (!childRes.rows.length) {
      return res.status(404).json({ error: 'Child not found.' });
    }

    res.json({
      child: {
        ...childRes.rows[0],
        care_instructions: careRes.rows,
        emergency_contacts: contactsRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/parent/children/:id/care
 * Body: { instructions: [{ category: string, instruction_text: string }] }
 * Replaces all care instructions for the child (upsert pattern — delete then insert).
 * Categories: 'allergy', 'medication', 'diet', 'note', 'routine'
 */
const updateCareInstructions = async (req, res, next) => {
  try {
    const childId = parseInt(req.params.id, 10);
    await assertParentOwnsChild(req.user, childId);

    const { instructions } = req.body;
    if (!Array.isArray(instructions)) {
      return res.status(400).json({ error: 'instructions must be an array.' });
    }

    // Map frontend/friendly categories to valid DB enum values ('allergy', 'dietary', 'medical_note', 'general')
    const CATEGORY_MAP = {
      allergy: 'allergy',
      dietary: 'dietary',
      diet: 'dietary',
      medical_note: 'medical_note',
      medication: 'medical_note',
      general: 'general',
      note: 'general',
      routine: 'general',
    };

    for (const inst of instructions) {
      if (!CATEGORY_MAP[inst.category]) {
        return res.status(400).json({
          error: `Invalid category: ${inst.category}. Allowed: ${Object.keys(CATEGORY_MAP).join(', ')}`,
        });
      }
      if (!inst.instruction_text || inst.instruction_text.trim().length < 2) {
        return res.status(400).json({ error: 'instruction_text must be at least 2 characters.' });
      }
    }

    // Transactional replace with dedicated pool client
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await require('./children.profile-save').authorize(client, req.user, childId);
      await client.query(`DELETE FROM care_instructions WHERE child_id = $1`, [childId]);

      const inserted = [];
      for (const inst of instructions) {
        const normalizedCat = CATEGORY_MAP[inst.category];
        const { rows } = await client.query(
          `INSERT INTO care_instructions (child_id, category, instruction_text) VALUES ($1, $2, $3) RETURNING *`,
          [childId, normalizedCat, inst.instruction_text.trim()]
        );
        inserted.push(rows[0]);
      }
      await client.query('COMMIT');

      res.json({ message: 'Care instructions updated.', care_instructions: inserted });
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/parent/children/:id/emergency-contacts
 * Body: { contacts: [{ name, relationship, phone }] }
 * Replaces all emergency contacts for the child.
 */
const updateEmergencyContacts = async (req, res, next) => {
  try {
    const childId = parseInt(req.params.id, 10);
    await assertParentOwnsChild(req.user, childId);

    const { contacts } = req.body;
    if (!Array.isArray(contacts)) {
      return res.status(400).json({ error: 'contacts must be an array.' });
    }
    if (contacts.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 emergency contacts allowed.' });
    }

    for (const c of contacts) {
      if (!c.name || c.name.trim().length < 2) {
        return res.status(400).json({ error: 'Each contact must have a name (min 2 chars).' });
      }
      if (!c.phone || c.phone.trim().length < 7) {
        return res.status(400).json({ error: 'Each contact must have a valid phone number.' });
      }
    }

    // Transactional replace with dedicated pool client
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await require('./children.profile-save').authorize(client, req.user, childId);
      await client.query(`DELETE FROM emergency_contacts WHERE child_id = $1`, [childId]);

      const inserted = [];
      for (const c of contacts) {
        const { rows } = await client.query(
          `INSERT INTO emergency_contacts (child_id, name, relationship, phone) VALUES ($1, $2, $3, $4) RETURNING *`,
          [childId, c.name.trim(), (c.relationship || '').trim(), c.phone.trim()]
        );
        inserted.push(rows[0]);
      }
      await client.query('COMMIT');

      res.json({ message: 'Emergency contacts updated.', emergency_contacts: inserted });
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/parent/profile-complete
 * Marks the parent user account as profile_complete = true.
 */
const markProfileComplete = async (req, res, next) => {
  try {
    await db.query(
      `UPDATE users SET profile_complete = true, updated_at = NOW() WHERE id = $1`,
      [req.user.id]
    );
    res.json({ message: 'Profile marked as complete.', profile_complete: true });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/parent/children/:id/profile
 * Allows parent to fulfill and update their child's identity data (full_name, dob, gender, group_id, relationship).
 */
const updateChildProfile = async (req, res, next) => {
  try {
    const childId = parseInt(req.params.id, 10);
    await assertParentOwnsChild(req.user, childId);

    const {
      full_name,
      dob,
      gender,
      group_id,
      relationship,
      pickup_authorized,
      photo_url,
      parent_name,
    } = req.body;

    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Child full name is required.' });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await require('./children.profile-save').authorize(client, req.user, childId);

      // Update child row (parents cannot change group_id/classroom assignment)
      const childUpdate = await client.query(
        `UPDATE children
         SET full_name = $1,
             dob = COALESCE($2, dob),
             gender = COALESCE($3, gender),
             photo_url = COALESCE($4, photo_url)
         WHERE id = $5
         RETURNING *`,
        [
          full_name.trim(),
          dob ? dob : null,
          gender ? gender.toLowerCase() : null,
          photo_url !== undefined ? photo_url : null,
          childId,
        ]
      );

      // Update relationship on guardian_links (parents cannot self-authorize pickup)
      if (relationship && relationship.trim()) {
        await client.query(
          `UPDATE guardian_links
           SET relationship = $1
           WHERE user_id = $2 AND child_id = $3`,
          [relationship.trim(), req.user.id, childId]
        );
      }

      // Optionally update parent name in users table if provided
      let updatedParentName = null;
      if (parent_name && parent_name.trim()) {
        const uRes = await client.query(
          `UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING name, email`,
          [parent_name.trim(), req.user.id]
        );
        if (uRes.rows.length) {
          updatedParentName = uRes.rows[0].name;
        }
      }

      await client.query('COMMIT');

      // Fetch group name if assigned
      let groupName = null;
      if (childUpdate.rows[0].group_id) {
        const gRes = await db.query('SELECT name FROM groups WHERE id = $1', [childUpdate.rows[0].group_id]);
        if (gRes.rows.length) groupName = gRes.rows[0].name;
      }

      // Fetch updated guardian link
      const glRes = await db.query(
        'SELECT relationship, pickup_authorized FROM guardian_links WHERE user_id = $1 AND child_id = $2',
        [req.user.id, childId]
      );
      const linkData = glRes.rows[0] || { relationship: relationship || 'Parent', pickup_authorized: true };

      res.json({
        message: 'Child profile updated successfully.',
        child: {
          ...childUpdate.rows[0],
          group_name: groupName,
          relationship: linkData.relationship,
          pickup_authorized: linkData.pickup_authorized,
        },
        parent: {
          id: req.user.id,
          name: updatedParentName || req.user.name,
          email: req.user.email,
        },
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listMyChildren,
  getMyChild,
  updateChildProfile,
  updateCareInstructions,
  updateEmergencyContacts,
  markProfileComplete,
};

