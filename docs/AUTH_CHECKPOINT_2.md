# Authentication security: checkpoint 2

Date: 16 October 2026.

## Outcome and activation boundary

This checkpoint adds daycare-scoped password recovery, mandatory authenticator
verification for daycare administrators, and separate platform-owner
authentication. Recovery messages use the selected local test inbox. These are
backend capabilities in the existing opt-in **development/test preview**.

`DAYCARE_AUTH_ENABLED` still defaults to false. Disabled mode continues to use
the existing application authentication. Enabled mode accepts only the preview
authentication paths and does not fall back to legacy credentials after a failed
request. Preview activation requires `NODE_ENV=development` or `test`; production
activation remains blocked.

No frontend changes or migration application to the configured application
database are part of this checkpoint. Migration 017 has been exercised only in
generated test databases. The configured database has not received it, and no
platform owner has been bootstrapped there. The local inbox sends no real email.

The account model remains separate for each daycare. A parent's account,
password, recovery links, role and sessions belong to that daycare. Global email
uniqueness remains in place until the dependent clients and account workflows
are migrated together; this checkpoint does not enable repeated email addresses
across daycares.

## Privileged sign-in

Parents and caregivers retain the checkpoint 1 login/session contract. Daycare
administrators and platform owners must complete MFA before receiving a session:

1. A correct password returns HTTP 202 with `mfa_required`,
   `enrollment_required`, `purpose`, `challenge_token` and `expires_at`. It does
   not return a session token or set a session cookie.
2. For initial enrollment, POST the challenge to `/mfa/setup`. The response
   supplies an authenticator secret, `otpauth_uri` and a replacement challenge.
   Setup consumes the original challenge. The client must use the replacement
   challenge when verifying the first code.
3. POST the replacement challenge and `totp_code` to `/mfa/verify`. Successful
   verification confirms the factor and issues the session. First enrollment
   returns ten recovery codes once; the client must provide a way to save them.
4. Subsequent password logins return a `login_mfa` challenge. Verify it with an
   authenticator code or one unused `recovery_code`, then receive the session.

All challenge and verification requests use JSON and the existing Origin
allowlist. `/mfa/verify` accepts `transport: "cookie"` by default or `"bearer"`.
Cookie responses include a session-bound `csrf_token`; unsafe authenticated
requests require its `X-CSRF-Token` header. Bearer responses return the opaque
session token instead.

| Principal | Route prefix | Session token | Cookie |
| --- | --- | --- | --- |
| Daycare administrator | `/api/auth` | `dc1.` | `daycare_session` |
| Platform owner | `/api/platform/auth` | `pf1.` | `platform_session` |

Platform sign-in accepts email/password without a daycare selector. Its
`/login`, `/mfa/setup`, `/mfa/verify`, `/me` and `/logout` routes use a separate
principal and CSRF domain. Platform sessions cannot authenticate daycare routes;
daycare sessions and challenges cannot authenticate platform routes. Platform
authentication does not grant access to private child, health or message records.
The platform-management dashboard and daycare approval/admin-appointment screens
remain later work.

An existing confirmed factor cannot be replaced with only a password or a new
enrollment request. Recovery codes require a password-proven login challenge,
are consumed once and retain the existing factor. This checkpoint provides no
public MFA-reset or factor-replacement endpoint. A privileged user who loses both
their authenticator and recovery codes needs a separately designed recovery
procedure; a password reset does not bypass MFA.

## Password recovery and changes

| Operation | Daycare route | Platform route |
| --- | --- | --- |
| Request a reset | `POST /api/auth/forgot-password` | `POST /api/platform/auth/forgot-password` |
| Apply a reset | `POST /api/auth/reset-password` | `POST /api/platform/auth/reset-password` |
| Change a known password | `PATCH /api/auth/change-password` | `PATCH /api/platform/auth/change-password` |

Daycare requests require `daycare_code`. Forgot-password also requires `email`;
reset-password requires `token` and `new_password`. Platform requests use the same
fields without `daycare_code`. Authenticated password changes require
`current_password` and `new_password`. New passwords must occupy 12–72 UTF-8
bytes. The daycare change-password route also accepts POST for compatibility.

Valid forgot-password requests return HTTP 202 with the same message whether an
eligible account exists or the request is throttled:

> If the account is eligible, recovery instructions have been sent.

Reset links expire after 30 minutes. A new request invalidates previous reset
links for that account. Token prefixes separate daycare (`dr1.`) and platform
(`pr1.`) recovery, and only token hashes are stored in reset-token tables. Legacy
reset tokens are never accepted by preview recovery.

Links are built from the configured trusted origin, never the request Host.
Their tokens are in the URL fragment. The future reset screen must read the
fragment and submit the token in a JSON request body; reset endpoints do not read
query-string tokens. Reset screens are not implemented in this backend checkpoint.

A successful reset or authenticated password change atomically updates the
password, invalidates remaining reset links and login challenges, revokes the
account's sessions, queues a password-change notice and records the audit event.
It preserves MFA enrollment and does not log the user in automatically. Account
email/status changes also invalidate outstanding login challenges and preview
and legacy password-reset links. Reactivation cannot revive an earlier link.

## Local test inbox

The database outbox holds encrypted message payloads rather than sending SMTP
mail. Recipient addresses remain database metadata. Message ciphertext is bound
to the exact message and principal, so copying it to another account/message does
not make it decryptable there. Reset messages expire after 30 minutes and
password-change notices after 24 hours; expired rows are hidden by inbox commands.
Expiration does not itself delete the stored rows. Automated retention cleanup is
later operational work.

From `backend`, after preparing an isolated local preview database:

```powershell
npm run auth:inbox -- list
npm run auth:inbox -- view <message-uuid>
```

`list` displays message ID, kind and timestamps only. It does not display
recipients, bodies or reset links. `view` explicitly decrypts the selected live
message for the developer. There is no HTTP inbox route. The CLI requires the
enabled development/test preview, valid encryption configuration and a local
PostgreSQL host. Do not put its decrypted output in shared logs.

## Encryption configuration

Enabled preview startup requires both of these environment values:

| Variable | Contract |
| --- | --- |
| `AUTH_ENCRYPTION_KEYS` | JSON object mapping 1–8 key IDs to independent, canonical base64 encodings of exactly 32 random bytes. IDs use 1–40 letters, digits, underscores or hyphens. |
| `AUTH_ENCRYPTION_ACTIVE_KEY_ID` | An ID present in the configured keyring; used for new ciphertext. |
| `AUTH_RESET_BASE_URL` | Optional exact origin already present in `DAYCARE_AUTH_ALLOWED_ORIGINS`; defaults to the first allowed origin. Paths, credentials, query strings and fragments are rejected. |

There are no built-in encryption keys. Keep generated keys outside source
control and do not reuse public test fixtures. MFA secrets and local-mail payloads
use AES-256-GCM with separate HKDF-derived purpose keys and authenticated context.
Missing keys, changed ciphertext or wrong principal/message context fail closed
with a sanitized unavailable response.

For key rotation, add a new key ID and change the active ID while retaining older
keys needed to decrypt existing factors and live messages. Selecting a new active
key does not re-encrypt old rows. Removing an old key before migrating its rows
makes those rows unreadable. Durable attempt-budget identifiers also use the
active key, so a rotation starts a new keyed budget namespace.

## First platform owner

The first owner is created deliberately through the local CLI, not public HTTP
registration:

```powershell
npm run auth:bootstrap-owner -- --name "Owner Name" --email "owner@example.invalid"
```

The invocation must receive exactly one password line through piped standard
input. The example above shows arguments only and will not bootstrap an owner
without that input. Do not put a password literal in shell history, arguments or
environment variables. The CLI rejects interactive/argument passwords and known
owner-password environment variables, validates configuration before opening a
pool, and requires local PostgreSQL plus the enabled development/test preview.

Bootstrap locks the platform registry and succeeds only when it contains no
platform accounts. It cannot overwrite, copy or promote an existing legacy
account. The new owner starts in `pending_activation`; first password sign-in and
successful MFA enrollment activate it. This does not falsely mark the email as
verified. No default password or automatic owner creation is provided. This
command has not been run against the configured application database.

## Storage, abuse protection and verification

Migration `017_authentication_security_workflows.js` adds
`daycare_password_reset_tokens`, `auth_mail_outbox` and `auth_attempt_buckets`.
It uses composite user/daycare foreign keys and exclusive daycare/platform
principal checks. Existing migrations 014–016 provide session, challenge, factor,
recovery-code and platform-account storage.

MFA challenges expire after five minutes. TOTP uses six digits, 30-second steps
and an adjacent-step allowance; an already used step cannot issue another
session. Challenges and recovery codes are single-use, with consumption and
session issuance in one transaction. Privileged sessions require a confirmed,
unrevoked factor and a recorded MFA verification.
Verification reads current time after acquiring locks, so a queued request cannot
extend a challenge or the allowed TOTP window.

Password login has a persistent per-account-selector budget of 20 attempts per
15 minutes. Forgot-password and authenticated password changes use five per
15 minutes. MFA permits five failed proofs per principal per 15 minutes and
tracks individual challenge attempts; starting a fresh challenge does not reset
that principal's failure budget. Failed-proof counters commit before an error is
returned. Existing application-level request limiting remains in place as well.

Run the focused verification commands from `backend`:

```powershell
npm run test:auth-security
npm run test:daycare-auth
npm run test:foundation
```

The security tests cover authenticator vectors, enrollment/challenge replay,
recovery-code consumption, persisted failure budgets, encryption context/tamper
checks, reset scoping and invalidation, transaction rollback and separate
platform sessions/bootstrap. Application and foundation suites verify composition,
compatibility, database constraints and upgrade/rollback behavior. Database
integration tests use generated local databases and remove only databases owned
by their test process. These commands do not use the general `npm test` audit
script.

Verified on 16 October 2026:

| Focused suite | Passed | Failed |
| --- | ---: | ---: |
| Authentication security | 50 | 0 |
| Daycare authentication and full application integration | 43 | 0 |
| Foundation migrations, constraints, upgrades and rollback | 22 | 0 |
| Total | 115 | 0 |

Syntax checks passed for 41 relevant JavaScript files. A read-only metadata check
confirmed the configured database still ends at `013_multi_tenant_saas.js`, has
none of the new preview security tables, and has preview authentication disabled.
No generated authentication/foundation test databases remained. Independent code
review verified the lock-wait timing and status/recovery invalidation corrections
and found no remaining concrete blockers within this checkpoint's scope.

This checkpoint does not establish full tenant isolation for operational
child/report/message queries, RLS or restricted database roles. It does not
deliver real email, production monitoring/retention, the shared login UI,
invitation-based account activation, administrator appointment or payments.
Those remaining workflows and the coordinated client cutover are required before
production activation or a real-customer pilot.

## Next checkpoint

Build and verify the client authentication screens against these contracts:
daycare-code login, a separate platform entry, authenticator enrollment and
verification, recovery-code saving/use, local password reset, safe session
persistence and role-derived navigation. Keep preview activation deliberate until
the client and dependent account workflows are migrated together. Full operational
tenant isolation remains a separate required security checkpoint.
