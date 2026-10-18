'use strict';
require('dotenv').config();
const db = require('./src/config/db');

async function verifyDatabase() {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('             ANKELBA DATABASE INTEGRITY & SCHEMA VERIFICATION               ');
  console.log('             Database: ankelba_dev  |  Host: localhost:5432                 ');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;
  const assert = (condition, name, details = '') => {
    if (condition) {
      passed++;
      console.log(`  ✅ [PASS] ${name}${details ? ` — ${details}` : ''}`);
    } else {
      failed++;
      console.error(`  ❌ [FAIL] ${name}${details ? ` — ${details}` : ''}`);
    }
  };

  try {
    // -------------------------------------------------------------------------
    // 1. Connection & Target Database
    // -------------------------------------------------------------------------
    console.log('[1] Database Connection & Target Environment:');
    const dbNameRes = await db.query('SELECT current_database(), current_user, version()');
    const currentDb = dbNameRes.rows[0].current_database;
    assert(currentDb === 'ankelba_dev', 'Connected to target database', `Target: ${currentDb}`);
    console.log(`      PostgreSQL Version: ${dbNameRes.rows[0].version.split(',')[0]}`);

    // -------------------------------------------------------------------------
    // 2. Main Data Entities / Tables Verification (SRS §4.8, §6.1)
    // -------------------------------------------------------------------------
    console.log('\n[2] Main Data Entities & Tables (SRS §4.8, §6.1):');
    const expectedTables = [
      'roles',
      'users',
      'groups',
      'children',
      'emergency_contacts',
      'care_instructions',
      'guardian_links',
      'biometric_references',
      'front_desk_assignments',
      'attendance',
      'guardian_verification_events',
      'daily_reports',
      'report_meals',
      'report_activities',
      'health_records',
      'announcements',
      'messages',
      'alerts',
      'events',
      'product_categories',
      'products',
      'orders',
      'order_items',
      'payments',
      'audit_logs',
      'password_reset_tokens',
    ];

    const { rows: tRows } = await db.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    const existingTables = tRows.map((r) => r.tablename);

    let missing = [];
    const counts = {};
    for (const tbl of expectedTables) {
      if (existingTables.includes(tbl)) {
        const cRes = await db.query(`SELECT COUNT(*)::int AS count FROM ${tbl}`);
        counts[tbl] = cRes.rows[0].count;
      } else {
        missing.push(tbl);
      }
    }
    assert(missing.length === 0, `All ${expectedTables.length} SRS-mandated tables exist`, missing.length ? `Missing: ${missing.join(', ')}` : `${expectedTables.length}/${expectedTables.length} verified`);

    console.log('      Table Row Summary:');
    for (const [tbl, cnt] of Object.entries(counts)) {
      console.log(`        • ${tbl.padEnd(30)} ${String(cnt).padStart(4)} rows`);
    }

    // -------------------------------------------------------------------------
    // 3. Schema Constraints & Indexes (SRS §4.8, FR-DB-03, FR-DB-04)
    // -------------------------------------------------------------------------
    console.log('\n[3] Schema Constraints, Keys & Performance Indexes:');
    
    // Foreign Keys
    const { rows: fkRows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM information_schema.table_constraints
       WHERE constraint_type = 'FOREIGN KEY' AND constraint_schema = 'public'`
    );
    const fkCount = fkRows[0]?.count || 0;
    assert(fkCount >= 25, `Foreign Key Constraints enforce referential integrity`, `Found: ${fkCount}`);

    // CHECK Constraints
    const { rows: chkRows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM information_schema.table_constraints
       WHERE constraint_type = 'CHECK' AND constraint_schema = 'public'`
    );
    const chkCount = chkRows[0]?.count || 0;
    assert(chkCount >= 30, `CHECK Constraints enforce domain/range validation`, `Found: ${chkCount}`);

    // Unique Constraints
    const { rows: uqRows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM information_schema.table_constraints
       WHERE constraint_type = 'UNIQUE' AND constraint_schema = 'public'`
    );
    const uqCount = uqRows[0]?.count || 0;
    assert(uqCount >= 5, `UNIQUE Constraints prevent duplicate accounts and links`, `Found: ${uqCount}`);

    // Indexes
    const { rows: idxRows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM pg_indexes WHERE schemaname = 'public'`
    );
    const idxCount = idxRows[0]?.count || 0;
    assert(idxCount >= 40, `B-Tree Performance Indexes for search and lookups`, `Found: ${idxCount}`);

    // -------------------------------------------------------------------------
    // 4. Referential Integrity & Orphan Records Check (SRS §6.2)
    // -------------------------------------------------------------------------
    console.log('\n[4] Referential Integrity & Zero Orphan Records Check (SRS §6.2):');
    
    // Orphan emergency contacts
    const orphContacts = await db.query(
      `SELECT COUNT(*)::int as count FROM emergency_contacts ec
       LEFT JOIN children c ON c.id = ec.child_id WHERE c.id IS NULL`
    );
    assert(orphContacts.rows[0].count === 0, 'Zero orphan emergency_contacts');

    // Orphan care instructions
    const orphCare = await db.query(
      `SELECT COUNT(*)::int as count FROM care_instructions ci
       LEFT JOIN children c ON c.id = ci.child_id WHERE c.id IS NULL`
    );
    assert(orphCare.rows[0].count === 0, 'Zero orphan care_instructions');

    // Orphan guardian links
    const orphGuardians = await db.query(
      `SELECT COUNT(*)::int as count FROM guardian_links gl
       LEFT JOIN children c ON c.id = gl.child_id
       LEFT JOIN users u ON u.id = gl.user_id
       WHERE c.id IS NULL OR u.id IS NULL`
    );
    assert(orphGuardians.rows[0].count === 0, 'Zero orphan guardian_links');

    // Orphan attendance records
    const orphAtt = await db.query(
      `SELECT COUNT(*)::int as count FROM attendance a
       LEFT JOIN children c ON c.id = a.child_id WHERE c.id IS NULL`
    );
    assert(orphAtt.rows[0].count === 0, 'Zero orphan attendance records');

    // Orphan daily reports
    const orphRep = await db.query(
      `SELECT COUNT(*)::int as count FROM daily_reports dr
       LEFT JOIN children c ON c.id = dr.child_id WHERE c.id IS NULL`
    );
    assert(orphRep.rows[0].count === 0, 'Zero orphan daily_reports');

    // Orphan order items
    const orphOrderItems = await db.query(
      `SELECT COUNT(*)::int as count FROM order_items oi
       LEFT JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.id IS NULL OR p.id IS NULL`
    );
    assert(orphOrderItems.rows[0].count === 0, 'Zero orphan order_items');

    // Orphan payments
    const orphPayments = await db.query(
      `SELECT COUNT(*)::int as count FROM payments py
       LEFT JOIN orders o ON o.id = py.order_id WHERE o.id IS NULL`
    );
    assert(orphPayments.rows[0].count === 0, 'Zero orphan payments');

    // -------------------------------------------------------------------------
    // 5. Guardian Verification & Biometrics Audit (SRS §4.10)
    // -------------------------------------------------------------------------
    console.log('\n[5] Guardian Verification & Biometrics Integrity (SRS §4.10):');
    
    // Guardian verification events
    const gvRes = await db.query(
      `SELECT gve.id, gve.child_id, c.full_name as child_name,
              gve.guardian_user_id, u.name as guardian_name,
              gve.result, gve.method, gve.manual_reason, gve.verified_at
       FROM guardian_verification_events gve
       JOIN children c ON c.id = gve.child_id
       JOIN users u ON u.id = gve.guardian_user_id
       ORDER BY gve.verified_at DESC LIMIT 5`
    );
    assert(gvRes.rows.length > 0, `Guardian verification events found in database (${gvRes.rows.length} sample records verified)`);
    console.log('      Recent Guardian Verification Events:');
    for (const gv of gvRes.rows) {
      console.log(`        • ID ${gv.id} | Child: ${gv.child_name} | Guardian: ${gv.guardian_name} | Method: ${gv.method} | Result: ${gv.result}`);
      if (gv.manual_reason) {
        console.log(`          Reason: "${gv.manual_reason.slice(0, 50)}..."`);
      }
    }

    // Biometric references
    const bioRes = await db.query(
      `SELECT br.id, br.guardian_link_id, br.active, br.enrolled_at,
              c.full_name as child_name, u.name as guardian_name
       FROM biometric_references br
       JOIN guardian_links gl ON gl.id = br.guardian_link_id
       JOIN children c ON c.id = gl.child_id
       JOIN users u ON u.id = gl.user_id`
    );
    assert(bioRes.rows.length > 0, `Active biometric verification references verified (${bioRes.rows.length} enrolled)`);
    for (const b of bioRes.rows) {
      console.log(`        • Bio ID ${b.id} | Guardian: ${b.guardian_name} | Child: ${b.child_name} | Active: ${b.active} | Enrolled: ${b.enrolled_at}`);
    }

    // -------------------------------------------------------------------------
    // 6. Security & Audit Logging (SRS §4.13, FR-AUD-01 to 04)
    // -------------------------------------------------------------------------
    console.log('\n[6] Audit Logging Integrity (SRS §4.13):');
    const auditRes = await db.query(
      `SELECT action, COUNT(*)::int as count FROM audit_logs GROUP BY action ORDER BY count DESC`
    );
    assert(auditRes.rows.length > 0, `Audit logs present with distinct tracked actions (${auditRes.rows.length} action types)`);
    for (const a of auditRes.rows) {
      console.log(`        • ${a.action.padEnd(30)} ${a.count} entries`);
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log(`  DATABASE VERIFICATION SUMMARY:  ${passed} PASSED  |  ${failed} FAILED`);
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('Database verification error:', err);
    failed++;
  } finally {
    await db.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

verifyDatabase();
