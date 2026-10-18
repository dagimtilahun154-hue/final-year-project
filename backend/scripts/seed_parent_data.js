'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

async function seedParentData() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    console.log('Seeding parent and child data...');

    const passHash1234 = await bcrypt.hash('1234', 10);
    const passHashParent = await bcrypt.hash('Parent@123!', 10);

    // 1. Ensure parent@gmail.com exists
    let parentRes = await client.query('SELECT id FROM users WHERE email = $1', ['parent@gmail.com']);
    let parentId;
    if (parentRes.rows.length === 0) {
      const ins = await client.query(
        `INSERT INTO users (name, email, password_hash, role_id, status, profile_complete)
         VALUES ($1, $2, $3, 3, 'active', true)
         RETURNING id`,
        ['Hana Tesfaye', 'parent@gmail.com', passHash1234]
      );
      parentId = ins.rows[0].id;
      console.log(`Created parent user parent@gmail.com (ID: ${parentId})`);
    } else {
      parentId = parentRes.rows[0].id;
      await client.query('UPDATE users SET password_hash = $1, status = \'active\', profile_complete = true WHERE id = $2', [passHash1234, parentId]);
      console.log(`Updated parent user parent@gmail.com (ID: ${parentId})`);
    }

    // Also support parent@ankelba.dev with same ID or alias
    let devParentRes = await client.query('SELECT id FROM users WHERE email = $1', ['parent@ankelba.dev']);
    if (devParentRes.rows.length === 0) {
      await client.query(
        `INSERT INTO users (name, email, password_hash, role_id, status, profile_complete)
         VALUES ($1, $2, $3, 3, 'active', true)`,
        ['Hana Tesfaye', 'parent@ankelba.dev', passHash1234]
      );
    }

    // Support newparent@ankelba.dev for wizard testing
    let newParentRes = await client.query('SELECT id FROM users WHERE email = $1', ['newparent@ankelba.dev']);
    if (newParentRes.rows.length === 0) {
      await client.query(
        `INSERT INTO users (name, email, password_hash, role_id, status, profile_complete)
         VALUES ($1, $2, $3, 3, 'active', false)`,
        ['Sara New Parent', 'newparent@ankelba.dev', passHash1234]
      );
    }

    // 2. Ensure toddler group exists
    let groupRes = await client.query("SELECT id FROM groups WHERE name ILIKE '%Toddler%' LIMIT 1");
    let groupId = groupRes.rows[0]?.id || 1;

    // 3. Find caregiver id (demo caregiver)
    let cgRes = await client.query("SELECT id FROM users WHERE role_id = 2 AND status = 'active' LIMIT 1");
    let caregiverId = cgRes.rows[0]?.id || null;

    // 4. Create or update child record
    let childRes = await client.query("SELECT id FROM children WHERE full_name = 'Liya Hana'");
    let childId;
    if (childRes.rows.length === 0) {
      const cIns = await client.query(
        `INSERT INTO children (full_name, dob, gender, group_id, caregiver_id, enrollment_status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING id`,
        ['Liya Hana', '2023-05-12', 'female', groupId, caregiverId]
      );
      childId = cIns.rows[0].id;
      console.log(`Created child Liya Hana (ID: ${childId})`);
    } else {
      childId = childRes.rows[0].id;
      await client.query(
        `UPDATE children SET dob = '2023-05-12', gender = 'female', group_id = $1, caregiver_id = $2, enrollment_status = 'active' WHERE id = $3`,
        [groupId, caregiverId, childId]
      );
      console.log(`Updated child Liya Hana (ID: ${childId})`);
    }

    // 5. Link parent to child via guardian_links
    let linkRes = await client.query('SELECT id FROM guardian_links WHERE child_id = $1 AND user_id = $2', [childId, parentId]);
    if (linkRes.rows.length === 0) {
      await client.query(
        `INSERT INTO guardian_links (child_id, user_id, relationship, pickup_authorized, created_by)
         VALUES ($1, $2, 'Mother', true, $2)`,
        [childId, parentId]
      );
      console.log(`Linked parent ${parentId} to child ${childId}`);
    } else {
      await client.query(
        `UPDATE guardian_links SET relationship = 'Mother', pickup_authorized = true WHERE id = $1`,
        [linkRes.rows[0].id]
      );
    }

    // 6. Care instructions (Allergies & Dietary)
    await client.query('DELETE FROM care_instructions WHERE child_id = $1', [childId]);
    await client.query(
      `INSERT INTO care_instructions (child_id, category, instruction_text)
       VALUES
         ($1, 'allergy', 'Peanuts (Groundnuts) — Anaphylaxis risk; carries auto-injector'),
         ($1, 'dietary', 'Cow milk / Dairy — Lactose intolerant; provide oat or soy substitute')`,
      [childId]
    );
    console.log('Added care instructions for Liya Hana');

    // 7. Emergency Contacts
    await client.query('DELETE FROM emergency_contacts WHERE child_id = $1', [childId]);
    await client.query(
      `INSERT INTO emergency_contacts (child_id, name, relationship, phone)
       VALUES
         ($1, 'Abebe Tesfaye', 'Father', '+251 91 123 4567'),
         ($1, 'Tirunesh Dibaba', 'Aunt', '+251 92 345 6789')`,
      [childId]
    );
    console.log('Added emergency contacts for Liya Hana');

    await client.query('COMMIT');
    console.log('✅ Successfully seeded parent and enrolled child data!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding parent data:', err);
    throw err;
  } finally {
    client.release();
    await db.end();
  }
}

seedParentData();
