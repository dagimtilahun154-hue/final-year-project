# Account foundation: setup repair

Date: 16 October 2026.

## Outcome and scope

The normal Knex migration loader can now install the schema into a completely
empty database without the manual `profile_complete` setup step. The repair also
works with legacy databases at migration 013 and databases already using 014–016.
Existing onboarding values, credentials, tenant ownership and migration-history
entries are preserved.

This batch adds one compatibility migration and updates the isolated foundation
tests and setup documentation. Migrations 001–016, application authentication,
frontend code and dependencies are unchanged. The configured application database
has not been migrated.

## Implementation

`backend/src/db/migrations/012a_profile_complete_prerequisite.js` sorts after
`012_front_desk.js` and before `013_multi_tenant_saas.js`. This placement provides
the onboarding column before 013 first uses it, without editing historical files.

- If the column is absent, add `users.profile_complete BOOLEAN NOT NULL DEFAULT
  false`. Existing rows receive false; migration 013 retains its own seed behavior.
- If the column already exists as a non-nullable boolean, leave its definition
  and values untouched.
- If it has an incompatible type or allows nulls, stop with an explicit error.
  No conversion or account-data rewrite is attempted.
- On an existing database, Knex records the previously unseen migration as a new
  history entry. Earlier entries are not renamed, reinserted or replayed. This was
  verified with the installed Knex loader as well as the documented
  [`migrate.latest` behavior](https://knexjs.org/guide/migrations.html#latest).

### Rollback behavior

The compatibility migration's `down` intentionally retains the column and its
values. The column may have been created manually before this migration was
recorded, and existing onboarding code and migration 013 depend on it. A targeted
rollback removes this migration's history entry, while retaining the shared
legacy column. Reapplying it is safe.

Tests undo only named new migrations: 016, 015, 014 and then 012a. They never call
013's destructive `down` or an unbounded rollback. Where the repair itself creates
the column, a targeted rollback is deliberately additive rather than an exact
schema reversal.

## Completed work

- [x] Verify the source of the missing-column dependency and migration ordering.
- [x] Add the compatibility migration without changing 001–016.
- [x] Test fresh setup using the application's standard filesystem migration configuration.
- [x] Test legacy upgrades, repeated setup, preservation and targeted rollback.
- [x] Test existing incompatible column definitions and atomic failure.
- [x] Update setup instructions and record validation results.

## Verification

Run from `backend`:

```powershell
npm run test:foundation
```

The runner uses generated local PostgreSQL databases and the existing database
name/ownership guards. It imports only `migrations` from the application's Knex
configuration; the configured application connection is never used for tests.
Legacy fixtures deliberately exclude 012a and reproduce the former manual column
only in temporary databases, allowing upgrades from the actual previous layout.
The fresh-install scenario has no manual preparation or custom migration source.

PostgreSQL 18.6: **21 tests passed, zero failed or skipped**. Coverage includes:

- Fresh schema installation with 012a executed before 013, non-null onboarding
  defaults, empty new security tables and the existing legacy owner seed.
- A repeat migration run with no pending work or data/history changes.
- Upgrade from the historical 013 layout, named rollback of new migrations and
  reapplication while preserving all captured legacy rows and credentials.
- Upgrade from 016 with only the new compatibility entry appended, preserving
  both complete and incomplete onboarding values and the existing column definition.
- Adding the missing column to populated legacy users; rejecting null values;
  retaining values through the compatibility migration's rollback/reapplication.
- Rejection of nullable-boolean and text-column drift without changing stored
  data, column definitions or prior migration history.
- The existing tenant-reference, MFA-factor, invitation, audit, normalized-email
  conflict and database-target guard checks.

Expected-error scenarios deliberately print failures for the unrepaired
historical chain, incompatible column shapes and duplicate normalized emails.
The assertions verify those failures and preservation; the fresh standard setup
scenario must succeed independently.

Final checks found zero remaining temporary test databases. A metadata-only
transaction confirmed the configured application database still ends at 013,
has no 012a history entry and has none of the eight new security tables installed.
SHA-256 comparisons confirmed migrations 001–016, the Knex configuration,
`package.json` and the lockfile were unchanged during this batch. JavaScript
syntax checks and targeted whitespace checks passed. No packages were installed.

## Remaining work

This establishes schema setup and upgrade compatibility on the tested PostgreSQL
version. It does not enable MFA, scoped authentication, tenant-wide API isolation,
restricted database roles or secure platform-owner provisioning. The existing demo
owner seed in 013 is unchanged. Those behaviors remain part of later approved
authentication and tenant-isolation batches.
