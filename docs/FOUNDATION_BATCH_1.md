# Account foundation: first implementation batch

Date: 16 October 2026.

Follow-up: the clean-install blocker recorded below is repaired in
[batch 2](FOUNDATION_BATCH_2_SETUP.md). The results below describe batch 1 at the
time it was completed; the current test suite also covers the setup repair.

## Approved boundary

The user approved additive schema migrations and tests in separate temporary databases. This batch does not apply migrations to the configured application database, change current login behavior, move existing accounts, change credentials, or edit migrations 001–013.

The accepted product model is a separate account at each daycare. The platform owner has a separate account and manages organizations and platform operations. Daycare administrators manage their own daycare's people and daily records. MFA will be required for the owner and daycare administrators when the later authentication batch is connected.

## Schema decisions

| Migration | Additions | Compatibility boundary |
| --- | --- | --- |
| 014 | Daycare login code, primary-admin reference, setup metadata, supporting tenant/account indexes | Login code remains nullable for existing registration code. Existing centers receive deterministic `dc-<id>` codes only when this migration is applied. No primary admin is guessed. |
| 015 | Platform accounts, MFA factors and recovery codes, authentication sessions and challenges, platform password-reset tokens | New tables start empty. Existing user IDs, passwords, roles, status and reset-token records are preserved. |
| 016 | Account invitations and platform audit events | Supports the agreed later workflows without implementing invitations, delivery or platform-management endpoints. |

### Account ownership

- Retain the existing global `users.email` uniqueness constraint. Adding the same email at two daycares remains unavailable until scoped authentication and recovery are deployed together in a later batch.
- Add uniqueness for a normalized email within a daycare and an explicit `(daycare_id, id)` key for same-daycare foreign keys.
- Fail a migration on existing normalized-email conflicts instead of merging or reassigning accounts.
- A principal on a new security record is either a complete daycare/user pair or a platform account. Explicit null checks reject incomplete or mixed principals.
- Optional MFA-factor references must also match that principal, including the platform-account case.
- The primary-admin foreign key proves daycare membership. Administrator-role and appointment permissions must be enforced by the later service layer; the new field does not grant privileges.

### Security storage

- Store hashes of session, challenge, invitation and recovery secrets; never raw bearer secrets.
- Store authenticator secrets as encrypted envelopes with a key identifier. The authentication service must supply actual encryption; a column name cannot prove that content is encrypted.
- Support one confirmed, unrevoked authenticator per principal while allowing an unconfirmed replacement during rotation.
- Enforce expiry ordering, hash shape and consistent invitation acceptance metadata.
- Keep historical platform audit actors and tenant references through restrictive foreign keys rather than cascading deletion.
- Runtime authorization, token consumption, MFA validation, encryption, audit access restrictions and database row-level security are later work. This batch does not claim to enforce those behaviors.

### Daycare metadata

- Login codes are stable public routing identifiers, not credentials.
- Existing daycare status and access rules remain untouched.
- `setup_status` records new setup metadata; it does not make an existing center operational or block current access.
- Completing setup requires a completion timestamp. Reversing completion clears it.
- The primary-administrator reference starts empty pending verified assignment.

## Decision and review log

The standard brainstorming workflow required a structured review before this security-sensitive implementation.

| Reviewer | Disposition | Objection and resolution |
| --- | --- | --- |
| Skeptic | APPROVED | Explicit principal null checks; same-principal factor tests; no composite `ON DELETE SET NULL`; preserve audit actors; exact test-database cleanup. Accepted. |
| Constraint guardian | APPROVED | Reverse only 016, 015 and 014; never execute migration 013's destructive rollback in these tests. Keep existing account behavior and global email constraint. Accepted. |
| User advocate | APPROVED | State clearly that codes/readiness are transitional and no auth/MFA/RLS behavior is enabled. Isolated tests establish no production/recovery guarantee. Accepted. |
| Integrator | APPROVED | All objections resolved; authorized additive batch may proceed. |
| Implementation review | APPROVED | New migrations, guarded tests, and the explicit historical-prerequisite fixture match the approved boundary. Passing tests describe prepared-baseline upgrades, not a repaired clean install. |

## Isolated verification

The test runner:

1. Accept only a local PostgreSQL host and connect to the `postgres` maintenance database for database creation and removal.
2. Generate unique `ankelba_foundation_test_<pid>_<time>_<random>` database names and record the exact names created by this process.
3. Create each test database from `template0`; never migrate the database named by `DB_NAME`.
4. Verify `current_database()` before migrations and test writes.
5. Reproduce the existing clean-install failure in migration 013, then test the new migrations against a separately prepared baseline matching the current database prerequisite, using synthetic fixtures.
6. Compare legacy account/credential, child, guardian, attendance and audit records before and after upgrade and rollback.
7. Test invalid tenant relationships, incomplete principals, mismatched MFA factors, malformed hashes, expiry ordering and duplicate-email preflight failure.
8. Reverse only the new migrations, reapply them, and verify compatibility.
9. Close owned clients before dropping only the exact generated databases. Never use forced cleanup against other databases.

The PostgreSQL test account needs permission to create temporary databases. A test failure must be visible; unavailable database access is not a passing or skipped security check.

Run from `backend`:

```powershell
npm run test:foundation
```

This command uses local `DB_HOST`, `DB_PORT`, `DB_USER` and `DB_PASSWORD` settings. `DB_NAME` is only an exclusion guard; it is never a test-write target. Do not substitute the existing generic `npm test` or migration CLI commands: those use the configured application environment.

### Results on 16 October 2026

- PostgreSQL 18.6: **15 tests passed, zero failed or skipped**. This includes ten schema-invariant subtests, the database guard, explicit reproduction of the historical clean-install failure, legacy upgrade/rollback/reapply preservation, and atomic rejection of normalized-email conflicts.
- The expected-error tests intentionally print migration failures for missing `profile_complete` in 013 and conflicting normalized emails in 014. Their assertions confirm the errors and rollback behavior; these are not clean-install success claims.
- JavaScript syntax checks passed for all three migrations and the test runner. The targeted package-script whitespace check passed. The full working-tree whitespace check reports pre-existing issues outside this batch; those files were left untouched.
- A separate metadata-only check found **zero remaining temporary test databases**. The configured application database still ends at **013**, with none of the checked new security tables or the new daycare login-code column installed.
- SHA-256 comparisons confirmed migrations 001–013 and the inspected authentication/configuration/blueprint files were unchanged. The only edited existing file in this batch is `backend/package.json`, adding `test:foundation`. Existing dependency changes in that file and the existing lockfile were preserved; no packages were installed.

### Existing clean-install blocker

Migration 013 inserts `users.profile_complete`, but migrations 001–012 do not create that column. The current database received it through the separate `backend/migrate_profile_complete.js` script. A fully empty database cannot run the unmodified historical migration chain. New migrations 014–016 cannot repair an earlier failure.

The test runner has an explicit regression that reproduces this failure. Other scenarios apply migrations through 012, add only the missing boolean column inside the generated temporary database, then apply 013 and the new migrations. This setup is named `prepareLegacyBaseline`; it never runs the existing manual script or changes the configured database. Passing these tests establishes upgrade compatibility with the prepared baseline, not a working clean-install command. A supported bootstrap repair requires a later change to the historical setup path.

## Later batches

Scoped login and recovery, MFA enforcement, invitation delivery, application review, the super-admin workspace, tenant-wide API scoping, restricted runtime roles and RLS remain pending. The pilot recovery objectives (15-minute maximum data loss and four-hour restoration) also require deployment and restore validation; these migrations do not establish those guarantees.
