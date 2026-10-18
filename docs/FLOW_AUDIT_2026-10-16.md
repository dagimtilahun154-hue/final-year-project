# Registration-to-daily-operation code audit

Date: 16 October 2026. Scope: current frontend/backend source, approved SaaS flow, focused checks and isolated reproductions. Application code was not changed.

The end-to-end flow is not complete or safe for independent daycares yet. The highest-priority current-runtime defects are public reset-token disclosure, unscoped account/operational APIs, parent-controlled pickup authorization and an unverified public payment callback. Functional breaks include records saved without daycare ownership, failing desk assignments, identity handoff, overwritten child safety data and sample-ID navigation.

The tested new auth preview is deliberately disabled. Its 115 passing checkpoint checks establish those backend contracts; they do not prove the older registration, operational APIs or live frontend flows are correct. Disabling that preview is an intentional boundary, not a defect. Turning it on by itself would break current clients and would not fix unscoped operational services.

## Flow map

| Stage | Current break or gap |
| --- | --- |
| Daycare application | Legacy form creates pending admin using a supplied password; success points to owner area. Invitations/status tracking pending. |
| Owner approval | Basic approve/reject/suspend/reactivate exists; lifecycle reasons/retries/new platform principal are not integrated. |
| Staff/parent setup | Legacy account CRUD is global and creates tenantless users; owner-only appointment rule is not enforced. |
| Child enrollment | Admin child/group inserts lose daycare ID; public signup creates its own fabricated child; child-parent permissions need enforcement. |
| Sign-in | Main app and staff portal have separate token stores, with an unsafe built-in-admin fallback. New MFA/code flow not connected. |
| Caregiver daily work | Desk assignment throws; ordinary report/health entry UI is missing; resource scope and tenant stamping remain incomplete. |
| Parent daily work | Wrong-child editing, safety-data replacement, fixed staff/report IDs, stale presence and guardian preview contracts break real use. |
| Oversight | Existing counts/logs are not the planned advanced console; audit ownership and coverage are incomplete. |

## Confirmed backend defects

### B01 — Critical: Public recovery exposes a usable reset token

Anyone supplying an active account's email receives the raw recovery token and can submit it to the public reset endpoint. The 'dev/demo' comment is not an environment guard. This affects the currently selected legacy auth; the disabled preview recovery does not expose tokens.

Evidence: [Legacy recovery](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/auth/auth.service.js:162>), [Public routes](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/auth/auth.routes.js:26>).

Verification: Root dependency-stub reproduction confirmed token returned; no real credentials, email or database used.

### B02 — Critical: Daycare account administration is platform-wide

The legacy list/get/update/status queries do not restrict daycare_id. A daycare admin can target another daycare's accounts; targets are not restricted to caregiver/parent and can include another admin or the legacy owner.

Evidence: [User queries](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/users/users.service.js:10>), [Target writes](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/users/users.service.js:44>).

Verification: Static route/controller/service trace.

### B03 — Critical: Daily-operation authorization does not isolate daycares

Passing authentication does not establish resource ownership. Operational child/group/order/report/event/search/dashboard/audit queries omit tenant checks. Portal attendance/pickup lets an admin act on an arbitrary child without comparing daycare IDs. The tenant helper has no route callers and there are no RLS policies.

Evidence: [Child lookup](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/children/children.service.js:154>), [Child listing](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/children/children.service.js:49>), [Portal authorization](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/portal/portal.service.js:20>), [Orders](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/store/store.service.js:237>).

Verification: Root reproduced cross-daycare child read/list and attendance write using synthetic records in a generated, subsequently removed database.

### B04 — High: New accounts and operational records lose daycare ownership

Legacy account creation and child/group/report/health/event/announcement/product/order insertions omit daycare_id. Nullable columns accept NULL. The scoped portal subsequently filters these records out, making saves appear to vanish. NULL-tenant accounts also encounter unsafe global fallback queries.

Evidence: [Account insert](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/users/users.service.js:35>), [Child insert](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/children/children.service.js:93>), [Group insert](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/groups/groups.service.js:24>), [Report insert](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/reports/reports.service.js:42>), [Scoped snapshot](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/portal/portal.service.js:79>).

Verification: Root reproduced tenantless staff, child, group and report; new child/report absent from its daycare snapshot.

### B05 — High: Public parent signup bypasses administrator-controlled enrollment

The active public signup creates an active parent, a fabricated active child and a pickup-authorized link without a daycare. These writes lack one transaction, so failure can leave partial accounts. This conflicts with the agreed daycare-admin registration flow.

Evidence: [Public signup](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/auth/auth.routes.js:17>), [Signup writes](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/auth/auth.service.js:303>).

Verification: Static route/service trace. Preview signup is deliberately closed.

### B06 — High: Suspension and credential changes do not revoke existing legacy access

Legacy middleware checks user status but does not reject a suspended daycare. Existing JWTs also are not invalidated when a password is reset/changed; the token has no live revocation/version check. Users can remain authenticated until token expiry. The new preview sessions address this, but are not active.

Evidence: [Request authentication](</C:/Users/Mistire/Desktop/final year project/backend/src/middleware/auth.js:39>), [Password reset](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/auth/auth.service.js:236>), [Password change](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/auth/auth.service.js:263>).

Verification: Static middleware and lifecycle trace.

### B07 — High: Daycare admins can create administrator accounts

The legacy create-user validator accepts admin and the role is inserted by name. There is no platform-owner appointment workflow enforcing the agreed privilege boundary.

Evidence: [Allowed roles](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/users/users.validator.js:4>), [Role insertion](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/users/users.service.js:35>).

Verification: Static route/validator/service trace. Preview forbids this.

### B08 — High: Parents can authorize their own pickup and change classroom assignment

A linked parent can submit pickup_authorized=true to the child-profile endpoint. It writes their guardian permission directly; pickup trusts it. The same request can set any group_id, and omission clears the existing group.

Evidence: [Parent group write](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/children/children.parent.service.js:248>), [Pickup permission write](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/children/children.parent.service.js:271>).

Verification: Root reproduced false-to-true pickup authorization against an isolated database; group behavior confirmed from SQL.

### B09 — High: Safety-record replacement is not an actual pooled transaction

Care/contact handlers call BEGIN, DELETE, INSERT and COMMIT via independent pool.query calls instead of one checked-out client. Under concurrent use/failures, rollback cannot guarantee restoration of deleted allergies, medication notes or contacts.

Evidence: [Care replacement](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/children/children.parent.service.js:130>), [Contact replacement](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/children/children.parent.service.js:178>), [Pool export](</C:/Users/Mistire/Desktop/final year project/backend/src/config/db.js:13>).

Verification: Static connection/transaction trace; no concurrency load run against the application database.

### B10 — High: Creating a front-desk duty assignment throws an error

saveDuty does not assign the return value of activeActor, and its staff SELECT omits daycare_id. The INSERT parameter evaluates staff.daycare_id || actor.daycare_id, where actor is undefined. Normal duty creation fails before insertion.

Evidence: [Duty creation](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/portal/portal.service.js:31>).

Verification: Root dependency-stub reproduction: ReferenceError: actor is not defined; no INSERT executed.

### B11 — High: Caregivers can update and read unrelated health records through notify

The notify route allows caregivers, then passes only an arbitrary record ID to an unscoped UPDATE ... RETURNING *. It does not check assigned child, daycare or record ownership.

Evidence: [Health route](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/health/health.routes.js:16>), [Unscoped update](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/health/health.service.js:111>).

Verification: Reviewer dependency-stub reproduction and static route trace.

### B12 — High: Announcement audiences and message recipients are not enforced

Announcement listing/search ignore the requesting user's group/audience. Caller-supplied meal-plan group filters are optional. Alerts addressed to all are global, and alerts lack tenant ownership. Sending a message only checks that its recipient ID is active, allowing cross-daycare targeting.

Evidence: [Announcement listing](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/communication/communication.service.js:30>), [Recipient check](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/communication/communication.service.js:73>), [Announcement search](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/search/search.service.js:108>).

Verification: Static authorization/query trace.

### B13 — Critical: A public payment callback can mark an order paid without verification

The mounted webhook has no signature/provider validation. A matching transaction reference with omitted status defaults to success, then updates payment to paid and order to confirmed. Deferring payments does not disable this existing mutable endpoint.

Evidence: [Public webhook](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/payments/payments.routes.js:16>), [Body-only controller](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/payments/payments.controller.js:17>), [Success default](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/payments/payments.service.js:92>).

Verification: Reviewer dependency-stub reproduction; no provider/payment request made.

### B14 — Medium: Report-completion counts multiply reports across children

The monitor joins reports by caregiver/date rather than child. With two assigned children and one report, it counts two submitted and zero missing. More reports multiply the joined rows.

Evidence: [Monitor join](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/reports/reports.service.js:226>).

Verification: Static SQL analysis; deterministic two-child/one-report join behavior.

### B15 — Medium: Report access is inconsistent after caregiver reassignment

History permits the child's current caregiver, while report detail authorizes the original report author. The new caregiver can list an old report but cannot open it; the old author can retain direct access.

Evidence: [Detail authorization](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/reports/reports.service.js:146>), [History authorization](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/reports/reports.service.js:196>).

Verification: Static authorization comparison.

### B16 — Medium: Order cancellation and status updates do not reconcile state

Order creation deducts stock, but cancellation does not restore it. Allowed status enums can replace any prior status without a transition policy. Payment initiation/callbacks can also overwrite paid/collected/cancelled states.

Evidence: [Stock deduction](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/store/store.service.js:137>), [Status update](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/store/store.service.js:251>), [Payment state update](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/payments/payments.service.js:129>).

Verification: Static inventory/state-transition trace. Payment feature remains deferred.

### B17 — Medium: Daily dates and presence metrics disagree

Portal operations use Addis Ababa dates; legacy metrics use database CURRENT_DATE/event_time::date, and report defaults use UTC dates. These disagree near midnight when DB/session timezone differs. Dashboard check-in counting also does not consistently remove checked-out children.

Evidence: [Portal calendar](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/portal/portal.service.js:4>), [Report default](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/reports/reports.validator.js:11>), [Attendance dates](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/attendance/attendance.service.js:82>), [Dashboard presence](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/dashboard/dashboard.service.js:31>).

Verification: Static time/presence rule comparison; timezone-dependent trigger stated explicitly.

### B18 — Medium: Operational audit records are incomplete or hidden

Operational audit helpers omit daycare_id, so new events disappear from tenant-filtered audit views. Several record changes are not audited; the older logger suppresses persistence errors. This cannot yet support the promised complete management history.

Evidence: [Audit insert](</C:/Users/Mistire/Desktop/final year project/backend/src/utils/auditedWrite.js:5>), [Suppressed failures](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/audit/audit.service.js:20>), [Portal audit filter](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/portal/portal.service.js:108>).

Verification: Static audit-write/read trace.

## Confirmed frontend defects

### F01 — High: Staff login does not transfer the same identity to the portal

The main login stores ankelba_auth_token and redirects to /admin or /staff; the portal reads ankelba_portal_token and does not enable cookie credentials. A fresh login can result in a second login, a stale portal identity or the fallback in F02.

Evidence: [Main token storage](</C:/Users/Mistire/Desktop/final year project/frontend/src/api/client.ts:5>), [Staff redirect](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/auth/LoginScreen.tsx:78>), [Portal token storage](</C:/Users/Mistire/Desktop/final year project/frontend/src/portal/api.ts:5>).

Verification: Static browser storage/API trace.

### F02 — High: The portal can silently authenticate a built-in administrator

On missing/invalid portal session, Portal calls ensureDevSession without a development guard. That helper attempts a real built-in-admin login. If that account remains valid, visiting staff login can open the seeded administrator's workspace.

Evidence: [Automatic fallback](</C:/Users/Mistire/Desktop/final year project/frontend/src/portal/Portal.web.tsx:204>), [Fallback login helper](</C:/Users/Mistire/Desktop/final year project/frontend/src/portal/api.ts:89>).

Verification: Static execution path; embedded credentials deliberately omitted from this report.

### F03 — High: The visual preview can send real database mutations

Preview save buttons still call portalApi.save before falling back to local state on error. Preview also runs live session/snapshot effects. With a usable portal session and server, clicking Save in preview can mutate actual application records.

Evidence: [Live call before preview fallback](</C:/Users/Mistire/Desktop/final year project/frontend/src/portal/Portal.web.tsx:308>), [Session effect](</C:/Users/Mistire/Desktop/final year project/frontend/src/portal/Portal.web.tsx:200>).

Verification: Static path; no preview action was clicked during this audit.

### F04 — High: Editing care information can erase existing safety data

The wizard initializes care/contact fields empty and does not hydrate saved care/contacts before editing. Submitting newly entered values invokes whole-list replacement endpoints, deleting earlier allergy/medication instructions or contacts that were never loaded.

Evidence: [Empty state](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/auth/ChildProfileWizardScreen.tsx:1541>), [Load](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/auth/ChildProfileWizardScreen.tsx:1569>), [Replacement calls](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/auth/ChildProfileWizardScreen.tsx:1731>).

Verification: Static state/API contract trace. Separate from backend transaction defect B09.

### F05 — High: Editing the second child targets the first linked child

The child-profile edit button passes no child ID. The wizard chooses children[0], so opening child B and editing can update child A.

Evidence: [Edit navigation](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/profile/ChildProfileScreen.tsx:140>), [First-child target](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/auth/ChildProfileWizardScreen.tsx:1578>).

Verification: Static navigation and target-selection trace.

### F06 — Medium: There is no functioning active-child switch for daily screens

ChildContext selects the first linked child, and no screen calls setSelectedChild. Opening another profile does not update the active child used by home, reports and guardians.

Evidence: [Selection context](</C:/Users/Mistire/Desktop/final year project/frontend/src/context/ChildContext.tsx:46>), [Profile navigation](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/profile/ProfileScreen.tsx:101>), [Report context](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/reports/ReportsScreen.tsx:19>).

Verification: Repository-wide call-site search and state trace.

### F07 — High: Parent messages target sample staff IDs

Inbox/chat use fixed caregiver/office account IDs rather than staff belonging to the child's daycare. Real staff conversations can disappear; sends can fail or reach another active account because B12 does not enforce recipient scope.

Evidence: [Fixed thread mapping](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/messages/MessagesScreen.tsx:70>), [Chat defaults](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/messages/CaregiverChatScreen.tsx:28>).

Verification: Static recipient/API trace; no messages sent.

### F08 — Medium: Report buttons can open a fixed unrelated report

Child profile always navigates to report 1, and home falls back to report 1 when none exists. Most families receive 403/404; a parent linked to the report's other child can open the wrong child's report.

Evidence: [Fixed report navigation](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/profile/ChildProfileScreen.tsx:113>), [Home fallback](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/home/HomeScreen.tsx:138>).

Verification: Static route-ID trace; backend ownership checks still apply.

### F09 — Medium: Home can present old attendance/report data as today's

Home fetches all-time history and takes its latest row, then renders today's presence/highlights without checking the current local date. An old unclosed check-in can show a child at daycare today.

Evidence: [History loading](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/home/HomeScreen.tsx:82>), [Presence rendering](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/home/HomeScreen.tsx:226>).

Verification: Static date/state trace.

### F10 — Medium: Saving a guardian draft opens an unavailable-details page

AddGuardian stores a local draft and passes guardianId; GuardianDetails expects a guardian object and does not resolve the ID.

Evidence: [Save/navigation](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/profile/AddGuardianScreen.tsx:30>), [Required route data](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/profile/GuardianDetailsScreen.tsx:20>).

Verification: Static route contract mismatch.

### F11 — Medium: Real pickup navigation resolves sample guardians

GuardianDetails passes a real database guardian-link ID, while PickupVerification looks it up in hardcoded design guardians. Matching sample IDs can display a different adult; other IDs are unavailable. It is not real pickup history.

Evidence: [Real ID navigation](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/profile/GuardianDetailsScreen.tsx:110>), [Sample lookup](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/profile/PickupVerificationScreen.tsx:18>), [Design data](</C:/Users/Mistire/Desktop/final year project/frontend/src/context/DesignContext.tsx:31>).

Verification: Static data-source/ID trace.

### F12 — Medium: Stock quantities use incompatible field names

The backend returns stock_qty; the parent screen expects stock_quantity and defaults a missing value to 10. Out-of-stock goods may appear purchasable until the backend rejects checkout.

Evidence: [Frontend default](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/store/DaycareStoreScreen.tsx:160>), [Backend field](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/store/store.service.js:18>).

Verification: Static response/type/render contract comparison.

### F13 — Medium: Reading a chat does not clear its unread count

Badges use read_at, but parent chat/inbox never call the existing mark-read endpoint, so unread counts remain after reading.

Evidence: [Unread computation](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/messages/MessagesScreen.tsx:95>), [Chat loading](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/messages/CaregiverChatScreen.tsx:40>), [Read endpoint](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/communication/communication.routes.js:26>).

Verification: API call-site search and static badge trace.

### F14 — Low: Daycare registration success points to the platform-owner area

The completion screen's action routes the applicant to /super-admin rather than a daycare login or application-status screen. This does not itself grant owner authorization, but sends the applicant to the wrong workflow.

Evidence: [Success action](</C:/Users/Mistire/Desktop/final year project/frontend/src/portal/LandingPage.web.tsx:310>).

Verification: Static navigation trace.

## Unfinished work

These are missing product/workflow capabilities, separated from the confirmed defects above. Some work overlaps the remediation needed for those defects.

- **U01 — Connect frontend authentication to the tested preview.** Daycare code, HTTP 202 MFA challenges, enrollment, backup saving/use, separate owner context, CSRF/session persistence, reset completion screen, and loading linked children from the proper parent API. Keep activation deliberate until contracts and tenant operations are ready.
- **U02 — Complete organization onboarding and account activation.** Application review, nominated-admin invitation, secure acceptance, retries/expiry/reissue, administrator replacement, resumable setup and auditable lifecycle transitions. Legacy registration immediately collects a password; approval only flips status. Rejection reasons are not durably handled.
- **U03 — Finish tenant enforcement and ownership migration.** Tenant-filter every resource read/write, enforce same-daycare relationships, backfill orphan ownership safely, add non-null constraints/RLS/restricted roles as designed, and cover two-daycare end-to-end cases without merging their data.
- **U04 — Enable independent accounts with the same email.** Global users.email uniqueness is intentionally retained. Removing it requires coordinated login/recovery/provisioning/profile cutover. Separate accounts are agreed; repeated-email use is not yet supported.
- **U05 — Build the professional platform-management console.** Dedicated applications, daycare detail/setup, primary admins, lifecycle history, platform audit, analytics, settings, system logs, service/database health and operational diagnostics. Existing owner APIs/UI must be moved onto the separate platform principal.
- **U06 — Build ordinary caregiver daily work.** The staff portal currently exposes only front-desk workspace and loads children through active desk duties. It lacks the ordinary assigned-child workspace and daily report/meal/activity/health entry screens; backend create APIs alone do not complete that workflow.
- **U07 — Provide correction and review workflows.** Attendance tells users to use a reviewed correction process, but none exists. Reports have create/read but no safe edit/correction workflow, so errors cannot be corrected through the intended UI/API.
- **U08 — Finish parent profiles, guardians and health information.** Persist parent personal-information edits; submit guardian requests for daycare approval; show actual authorized guardians and pickup/verification history; add parent health/incident views. Remove sample-data navigation dependencies.
- **U09 — Deliver real notification and acknowledgement flows.** Notification lists/read/dismiss state, health delivery/parent acknowledgement, persistent preferences and event reminders. Current settings/reminders live in memory and health notification is only a writable flag.
- **U10 — Publish approved promotional aggregate counts.** Landing page daycare/parent/child totals need a purpose-built aggregate data source and accurate definitions. Public pages should receive numbers rather than private records.
- **U11 — Complete production operations.** Real email delivery after the local inbox phase, retention/cleanup, backup and restore verification, key-rotation procedures, monitoring, deploy configuration and full lifecycle tests. A generic health endpoint and log files are not the planned operations console.
- **U12 — Complete or explicitly disable external-provider features.** Biometric device verification is deliberately unavailable; manual verified pickup exists. The AI guide is a keyword/rules responder. Real provider-backed payments, verification/idempotency/refunds remain deferred; the currently exposed unverified webhook is still B13.

## Verification performed for this audit

- Frontend TypeScript: `tsc --noEmit --incremental false` — passed.
- Frontend utility/model tests: `node --experimental-strip-types --test scripts/portal.test.cjs scripts/review.test.cjs` — 9 passed. These are utility/sample-model tests, not real-user journey tests.
- Root ran an isolated PostgreSQL reproduction with 10 confirmed assertions: cross-daycare child read/list; tenantless staff/child/group/report insertion; saved child/report absent from own portal; cross-daycare attendance write; linked parent self-authorizes pickup. The generated test database was removed and the helper's owned-database registry ended at zero.
- Root dependency stubs confirmed desk assignment throws `ReferenceError: actor is not defined`, and public legacy recovery returns a usable raw token. No real credentials/tokens were printed.
- Reviewer dependency stubs confirmed unscoped health-notify behavior and body-only payment-webhook success. No real messages, emails, provider calls or payments were performed.
- Remaining findings are high-confidence static route/controller/service/state/SQL traces. No browser end-to-end session was run; conditional and timezone-dependent behavior is stated as such.
- The current configured database was not migrated or modified. The general `npm test`, application seed scripts and older portal schema test were not run because they target the configured database. No application code was edited; this report is the audit artifact.

## Recommended implementation order

1. Close the public token leak, automatic seeded-admin login, preview live-write path and unverified payment mutation.
2. Enforce tenant ownership and actor permissions in currently reachable account, child, guardian and operational APIs; safely reconcile existing NULL ownership without merging daycares.
3. Fix desk assignment and safety-data replacement/transaction bugs, then wrong-child and fixed-ID navigation.
4. Complete approved application/invitation/setup workflows and ordinary caregiver report/health work, then integrate the new login/MFA/recovery clients against the full contracts.
5. Build the owner console and parent notification/guardian/health completion flows; standardize dates, reporting metrics, inventory transitions and audit visibility.
6. Run realistic two-daycare registration-to-pickup end-to-end tests before applying the coordinated rollout to the configured application.

