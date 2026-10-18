# Backend Phase 2 — isolation and integrity

18 October 2026. Changes in this batch are confined to backend/.

## Implemented and applied

- Migration 019: required daycare ownership on operational tables, 20 composite tenant foreign keys,
  derived ownership and composite relationships on guardian links and order items.
- Preflight rejects missing or inconsistent ownership without guessing, merging, deleting or reassigning records.
- Existing data passed preflight and the post-migration audit.
- Service checks for child, health, report and attendance reads no longer skip tenant validation when
  the caller lacks a daycare ID. Pickup rejects unowned guardians.
- Migration 020: tenant-owned product categories and per-daycare uniqueness. Existing shared categories
  remain readable templates and cannot be renamed/deleted through tenant APIs. Category counts only
  include the caller's products. Product category ownership is checked in API code and database triggers.
- Unique-constraint responses no longer return raw PostgreSQL details.

## Frontend integration notes

No frontend edits are necessary for existing endpoint names or request shapes.
Category responses now include daycare_id. Null means a shared read-only template.
POST creates a private category for the signed-in administrator's daycare. PATCH/DELETE of another
tenant's category or a shared template returns 404. A referenced category cannot be deleted (409).
Refresh category lists after creating or modifying categories.

## Verification

Combined backend suites: tenant-integrity, profile-reliability and phases 2, 3, 4, 6.
60 reported entries passed (including enclosing suite entries).
New tests explicitly apply migrations 019 and 020 in generated temporary databases, reject direct SQL
cross-tenant assignments and relationships, exercise scoped categories, and test rollback/reapply.
Older regression suites retain their original migration baseline; passing them is not complete coverage
of every workflow on the upgraded schema.

Read-only operational check: `node scripts/tenant-integrity-audit.cjs`.
It reports counts and relationship names, not personal records.

## Remaining before Phase 2 is complete

The configured database role is a superuser with BYPASSRLS. RLS is NOT active protection yet.
The next package must separate migration privileges from runtime privileges, establish authenticated
tenant context for every pooled query/transaction, handle login/recovery/platform aggregates separately,
and verify policies with a non-owner, non-superuser role. Include pool reuse, rollback, background tasks
and concurrent requests. Do not enable blanket policies before these paths are compatible.

Broader relationship coverage remains for biometric verification/audit actors and the full operational
write-path audit. Admin care/contact writers also need the same locking convention as the new parent
atomic-save endpoint. This batch must not be represented as complete RLS or a completed Phase 2.

## Rollback

019 removes constraints/derived tenant columns without deleting business records.
020 refuses rollback while tenant-owned categories exist: resolve/export those categories deliberately;
do not merge independent daycare categories just to restore global uniqueness.
Code using tenant categories must be rolled back together with 020.
