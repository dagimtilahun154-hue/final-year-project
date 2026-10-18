# Daycare authentication: checkpoint 1

Date: 16 October 2026.

Historical checkpoint record: [checkpoint 2](AUTH_CHECKPOINT_2.md) now adds
preview password recovery, mandatory privileged MFA and separate platform-owner
authentication. Its contract supersedes the deferred endpoints and follow-up
items below. The default-off activation boundary remains in place.

## Outcome and activation boundary

Implemented the approved backend checkpoint: daycare-code login, revocable
sessions, live account/tenant checks, and tenant-scoped account management.
The implementation is an opt-in **development/test preview**, not an activated
change to the current application or a production release.

`DAYCARE_AUTH_ENABLED` defaults to false. With it disabled, the existing login,
recovery, registration and JWT behavior remains unchanged; the new guarantees
below apply only to the enabled preview. This compatibility boundary permits the
coordinated frontend change agreed for checkpoint 3. The preview never falls back
to legacy authentication after a failed request.

No frontend files, existing migrations, dependencies or configured database data
were changed. The current database has not received migrations 012a or 014–016.

## Decisions

| Decision | Reason and boundary |
| --- | --- |
| Keep separate accounts for each daycare | Credentials, recovery, status and sessions belong to a local account; email does not identify a shared person across companies. |
| Introduce an explicit preview switch | Updating the API independently would break the current parent, staff and platform login consumers. Both old and new implementations are never simultaneously accepted in enabled mode. |
| Reject preview activation outside `development` or `test` | MFA, secure owner provisioning, client cutover and operational-record isolation remain unfinished. |
| Use opaque session tokens with server-side hashes | Logout and security changes can revoke access without waiting for an existing JWT to expire. |
| Keep global email uniqueness | Allowing repeated emails must wait until all authentication, recovery, provisioning and profile consumers are migrated together. |
| Defer password recovery rather than reuse the old handler | Checkpoint 2 will use the selected local test inbox. No reset secret is returned by the preview's unavailable recovery endpoints. |
| Keep platform authentication separate | Legacy owners and platform sessions cannot authenticate as daycare users. Platform sign-in and owner appointment workflows remain checkpoint 2/later work. |

## Implemented API contract

### Authentication

`POST /api/auth/login` accepts only JSON:

```json
{
  "daycare_code": "dc-1",
  "email": "parent@example.invalid",
  "password": "the-account-password",
  "transport": "cookie"
}
```

`daycare_code` and email are trimmed and lowercased. Unknown fields, missing code
and invalid inputs are rejected. The server resolves the role; the request cannot
select a role or substitute another daycare ID. Unknown code/email, wrong
password and unavailable accounts share a generic credential-denial response.

- `cookie` is the default transport. Success sets a `daycare_session` HttpOnly,
  SameSite=Strict cookie scoped to `/api`; JSON contains safe user metadata,
  `csrf_token` and `expires_at`, with no raw bearer token.
- `bearer` returns the opaque `token` for a native client and does not set a new
  session cookie. Secure native persistence is part of the client checkpoint.
- Tokens have a `dc1.` prefix and 32 cryptographically random bytes. Only a SHA-256
  digest is stored in `auth_sessions`. The prefix separates this token format from
  legacy JWTs; authorization still comes from database checks.
- Sessions expire after eight hours by default, using database time. Configuration
  accepts integer lifetimes between five minutes and 24 hours. Idle-timeout and
  additional privileged-session policies remain later work.
- `GET /api/auth/me` returns account/daycare metadata only. It does not query
  linked children, health information, messages or other private records. Cookie
  responses also provide the session-bound CSRF token.
- `POST /api/auth/logout` revokes the stored session. Proven logout remains
  idempotent for expired or already-revoked sessions. Cookie removal happens only
  after credential/Origin/CSRF checks succeed; rejected requests cannot clear it.
- Authentication responses are marked `Cache-Control: no-store`.

The shared authentication middleware rejects malformed credentials, JWTs,
platform/null-tenant principals, mismatched header/cookie credentials, expired or
revoked sessions and non-active accounts/daycares. It checks live state on every
protected request and derives `req.user` and `req.daycareId` from the session.
Supplied tenant selectors cannot retarget it.

### Request protection

Preview CORS uses an exact configured Origin allowlist. Login rejects an
unapproved Origin and requires JSON. Cookie-authenticated unsafe requests require
a session-derived `X-CSRF-Token`; this applies through the shared middleware to
existing protected routes as well as new account routes. Missing/malformed bearer
credentials never fall back to a cookie. Native requests without an Origin use
explicit bearer credentials for protected operations.

Local HTTP cookies deliberately omit Secure in this development/test-only mode.
Production activation is blocked, so this is not a production cookie policy.
Missing migrations fail with a sanitized 503 instead of a legacy-session fallback.

### Account management

The preview replaces `/api/users` with tenant-scoped queries and writes:

| Operation | Allowed principal and restrictions |
| --- | --- |
| List/count/get daycare accounts | Active daycare admin; results and target IDs restricted to their daycare. |
| Create account | Daycare admin can create caregiver/parent only. Role, status and tenant injection are rejected. |
| Edit or deactivate another account | Daycare admin; target must be a caregiver/parent in their daycare. Administrator targets are denied. |
| Read/update own profile | Any active daycare account; only name/email fields, with no role/tenant/status changes. |

Newly created caregiver/parent accounts use the supplied initial password only
within this preview. Invitation-based activation and password delivery are not
implemented here and must replace this temporary provisioning flow before rollout.
No admin-appointment endpoint is introduced: only the future platform workflow
may appoint or replace a daycare administrator.

Email changes revoke the target account's sessions and legacy recovery tokens;
the response requires reauthentication. Status changes revoke sessions even when
reactivating an account, so old sessions cannot return. Scoped audit events and
account changes commit in the same transaction. Unique-email failures return a
generic conflict without disclosing another daycare's email or constraint details.

Public parent signup is denied in preview. Both legacy daycare-registration
aliases (`/api/saas/register-daycare` and `/api/register-daycare`) are also closed,
because the old handler creates an administrator before the agreed approval flow.
Forgot/reset/change-password endpoints return unavailable until checkpoint 2;
they do not call the existing unscoped password handlers.

## Concurrency and implementation structure

Pure factories in `src/modules/daycare-auth` and `src/modules/daycare-users`
receive their PostgreSQL pool. Routes call controllers, services decide policy,
and repositories own parameterized SQL. Only `daycare-auth/runtime.js` composes
the factories with the configured application pool.

Login and account writes lock the daycare first, then user rows in a consistent
order. Account writes re-read the acting administrator inside the transaction,
including current role and status. Login's session and audit insert are atomic.
A client whose rollback fails is discarded rather than returned to the pool.

Existing operational modules now receive the preview's authenticated tenant
context when enabled, but their individual record queries have **not** all been
made tenant-safe. Passing these tests does not establish child/report/message
isolation, restricted database roles or RLS. No real-customer pilot is authorized
by this checkpoint.

## Review and verification

Independent design/implementation review: **APPROVED** for this bounded preview.
The review's concrete findings were resolved:

- Verify logout proof before clearing cookies; regression rejects cross-origin
  and invalid-proof logout without cookie removal or revocation.
- Serialize account changes and session issuance; actual PostgreSQL lock-contention
  tests cover both orderings of login versus deactivation.
- Discard clients after failed rollback; fault-injection tests verify it.
- Exercise actual application routing, not just isolated factories: JWT rejection
  on operational routes, both registration aliases, CORS/CSRF and preview-off
  compatibility are covered.

Run from `backend`:

```powershell
npm run test:daycare-auth
npm run test:foundation
```

Authentication suite: **40 tests passed, zero failed or skipped** on PostgreSQL
18.6. It covers configuration gates, scoped credentials and account operations,
session replay/status checks, Origin/CSRF, real application composition, transaction
races, atomic audit failures, missing storage and failed rollback cleanup.

The existing foundation suite also passed **21 tests**, for **61 passing checks**
across the two suites. Syntax checks passed for 25 changed/new JavaScript files.
Final metadata checks found zero remaining temporary databases, the configured
application database still ending at migration 013, and its preview flag disabled.
Hash comparisons confirmed all frontend files, migrations 001–016, legacy
auth/users service files and the dependency lockfile were unchanged.

Database tests create generated local databases from `template0`. Each process
registers exact names, verifies `current_database()`, closes HTTP servers/child
processes/pools before cleanup, and drops only its own databases without FORCE.
No application database is accepted as a test-write target. Production MFA,
recovery-email delivery, repeated-email support and full tenant isolation are not
claimed by these tests.

References used in the design:
[OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
[tenant context](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html).

## Next checkpoint

Daycare-scoped password recovery through the selected local test inbox, mandatory
MFA for privileged accounts and controlled platform-owner authentication. The
shared login interface, coordinated activation and removal of global email
uniqueness follow only after all dependent paths are migrated and verified.
