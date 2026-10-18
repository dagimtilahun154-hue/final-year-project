# Verification of Phases 1–6

Date: 18 October 2026 (Africa/Addis_Ababa).
Verdict: substantial backend repairs are implemented, but Phases 1–6 of the agreed eight-phase plan are not all complete. This was verification only; no application source or configured database data was changed.

## Scope and phase numbering

The new test files use a different grouping from the agreed plan: their Phase 4 is attendance/front desk, their Phase 5 is reports/health/metrics, and their Phase 6 is communication/audiences. Passing those groups would not establish completion of the original onboarding, login, parent-services and storefront requirements.

| Original phase | Verified progress | Completion assessment |
| --- | --- | --- |
| 1. Security containment | Recovery no longer exposes credentials; old reset tokens are rejected; credential/status changes revoke sessions; public parent signup is closed; payment mutation endpoints are unavailable; portal automatic login and preview live requests are removed. | Core containment checks pass. Ordinary profile updates now invalidate sessions and break a multi-step user flow; this regression needs correction. |
| 2. Daycare separation | Account, child, assignment, report, health, event and communication services have many new tenant checks and ownership writes. | Partial. Notifications still leak another tenant's alerts; NULL-owned records remain shared in several paths; owner access still includes private operational data. Database RLS and ownership cleanup/enforcement remain unfinished. |
| 3. Child safety | Care/contact replacement now uses one checked-out transaction; reassigned caregiver report access has been repaired. | Partial. Wrong-child editing, missing active-child switching and missing hydration of existing safety data remain. Profile saves also interrupt authentication. |
| 4. Registration and unified login | Earlier authentication backend, MFA, recovery and platform identity modules are present. | Not complete. Current client still uses legacy email/password login and separate portal token storage; invitations, setup completion and same-email independent-account cutover are absent. |
| 5. Daily work | Desk assignments, attendance transitions, verified manual pickup, report counts and health permissions have improved. | Partial. Ordinary caregiver report/health entry screens and correction workflows remain missing. Parent report navigation and today's-data handling remain incorrect. |
| 6. Parent/supporting services | Staff contact discovery and chat mark-read calls were added; communication audience tests cover multiple cases. | Partial. Fixed recipient fallbacks, meal-plan audience bypass, guardian requests/history, persistent notifications and store inventory/status defects remain. |

## Findings that still block completion

### V01 — High: Notification aggregation leaks cross-daycare alerts

The authenticated notifications endpoint queries all alerts with recipient_scope='all', without daycare ownership. Its health badge query also counts unnotified records globally. The repaired communication alerts endpoint is correctly scoped, but this alternate read path bypasses it.

**Reproduced through the mounted application:** a parent at daycare A received daycare B's synthetic alert title in /api/notifications, while /api/communication/alerts correctly excluded it.

Evidence: [notification queries](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/notifications/notifications.service.js:33>).

### V02 — High: A normal child-profile save invalidates the parent's session

The legacy JWT state includes users.updated_at. The wizard sends parent_name during its first save, and the backend updates users.updated_at even when the name is unchanged. The next wizard request then fails authentication. Marking the profile complete likewise changes the revision immediately before refreshUser.

**Reproduced through the mounted application:** first child-profile PUT returned 200; the following care-information PUT using the same session returned 401. This is a regression introduced by binding session revocation to a general profile-edit timestamp.

Evidence: [session fingerprint](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/auth/legacy-security.js:19>), [parent-name update](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/children/children.parent.service.js:308>), [wizard first save](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/auth/ChildProfileWizardScreen.tsx:1627>).

### V03 — High: Missing daycare ownership still allows shared reads and edits

Product listing explicitly includes daycare_id IS NULL. Product updates reject a different daycare only when the existing row has a non-null daycare_id. Similar fallback conditions remain for events and orders, and parent-child routes accept linked children with missing ownership. NULL ownership is unresolved ownership, not permission for all daycares.

**Reproduced through the mounted application:** a synthetic product created by daycare B's administrator with NULL ownership appeared in daycare A's catalog, and daycare A could edit it.

Evidence: [product listing](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/store/store.service.js:39>), [product mutation guard](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/store/store.service.js:89>), [order listing](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/store/store.service.js:278>), [parent-child fallback](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/children/children.parent.service.js:56>).

### V04 — High: Meal-plan endpoint bypasses role audiences

Unlike listAnnouncements, listMealPlans does not enforce parent-versus-staff audience restrictions in its parent/caregiver branches. A meal plan with no target group is returned regardless of whether its audience is caregivers or staff. The audience='all' shortcut can also override group filtering.

**Reproduced through the mounted application:** a parent received a caregiver-only meal plan through /api/communication/announcements/meal-plan; the regular announcement endpoint correctly hid it.

Evidence: [meal-plan audience conditions](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/communication/communication.service.js:159>).

### V05 — High: Child editing still chooses the first child and does not load saved safety records

The child profile's edit action passes no child ID. The wizard chooses children[0]. It loads child summaries and groups, but not the full child's existing care instructions and emergency contacts; those fields start empty and later invoke replacement endpoints. Repairing the transaction does not fix that frontend contract.

The current session regression can stop the wizard before its replacement calls. Both defects need fixing together so resolving V02 does not expose the existing loss-of-data path. There is also no screen calling setSelectedChild to switch daily views.

Evidence: [edit navigation](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/profile/ChildProfileScreen.tsx:140>), [wizard loading and target](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/auth/ChildProfileWizardScreen.tsx:1565>), [replacement calls](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/auth/ChildProfileWizardScreen.tsx:1731>), [child selection](</C:/Users/Mistire/Desktop/final year project/frontend/src/context/ChildContext.tsx:46>).

### V06 — High: Real chat still has hardcoded recipient paths

Staff contacts now drive the inbox when available, but an empty or failed contacts request recreates sample users 22 and 23. More importantly, normal Home and Child Profile message buttons pass only threadId, so CaregiverChat still defaults to those IDs even when contacts work. This can fail or target the wrong staff member within the same daycare; cross-daycare recipients are now rejected by the backend.

Evidence: [chat defaults](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/messages/CaregiverChatScreen.tsx:31>), [Home message action](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/home/HomeScreen.tsx:145>), [sample inbox fallback](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/messages/MessagesScreen.tsx:111>).

### V07 — High: Platform-owner access exceeds the agreed management-only boundary

Portal snapshot routes explicitly allow super_admin. The service treats a super_admin with no selected daycare as an unfiltered operational snapshot and returns private child, guardian, report and health data across daycares. That contradicts the approved management-and-aggregates-only owner role. Its message query is separately restricted to messages involving the current actor.

This finding is a route/service trace, not an owner-account login against the configured database.

Evidence: [allowed portal roles](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/portal/portal.routes.js:13>), [unfiltered owner snapshot](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/portal/portal.service.js:88>).

### V08 — High: Original Phase 4 onboarding and shared login remain unfinished

The main app still posts email/password only and stores ankelba_auth_token. The portal independently reads ankelba_portal_token. There are no frontend daycare-code/MFA/activation screens wired to the new contracts. Daycare registration still collects an administrator password immediately; approval changes status instead of inviting the nominated administrator. The success action still opens /super-admin. Global email uniqueness is deliberately retained, so repeated email addresses across independent daycare accounts are not enabled.

Evidence: [main login](</C:/Users/Mistire/Desktop/final year project/frontend/src/context/AuthContext.tsx:110>), [portal token store](</C:/Users/Mistire/Desktop/final year project/frontend/src/portal/api.ts:8>), [legacy daycare registration](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/saas/saas.service.js:27>), [success navigation](</C:/Users/Mistire/Desktop/final year project/frontend/src/portal/LandingPage.web.tsx:315>), [email uniqueness boundary](</C:/Users/Mistire/Desktop/final year project/backend/src/db/migrations/014_tenant_account_foundation.js:4>).

### V09 — High: Backend daily-work repairs do not complete the caregiver UI

The staff navigation still exposes only Front-desk workspace. Staff snapshots return empty reports and health arrays and select children through desk duties rather than providing the planned ordinary assigned-classroom work. Report creation APIs exist, but the intended caregiver reporting and health-entry journey is incomplete. Attendance and report routes also lack the reviewed correction workflows from the plan.

Evidence: [staff navigation](</C:/Users/Mistire/Desktop/final year project/frontend/src/portal/Portal.web.tsx:161>), [staff snapshot](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/portal/portal.service.js:115>), [report routes](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/reports/reports.routes.js:14>), [attendance routes](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/attendance/attendance.routes.js:14>).

### V10 — Medium: Parent report navigation and today's status still use incorrect data

Child Profile opens report 1, and Home falls back to report 1. Home takes the most recent attendance/report across all dates without establishing that it belongs to today. Backend metric improvements do not fix these screens.

Evidence: [fixed child report](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/profile/ChildProfileScreen.tsx:113>), [Home loading](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/home/HomeScreen.tsx:80>), [Home report fallback](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/home/HomeScreen.tsx:138>).

### V11 — Medium: Guardian, notification and storefront completion is still pending

Add Guardian writes only to DesignContext and navigates with guardianId; GuardianDetails expects a guardian object. PickupVerification resolves sample guardians. The notifications screen remains static navigation rather than a persistent notification/acknowledgement workflow. Store rendering still expects stock_quantity while the API returns stock_qty and defaults missing stock to 10. Cancellation still changes order_status without restoring reserved stock or enforcing state transitions.

Evidence: [guardian draft save](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/profile/AddGuardianScreen.tsx:18>), [guardian detail contract](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/profile/GuardianDetailsScreen.tsx:20>), [sample pickup data](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/profile/PickupVerificationScreen.tsx:18>), [notification screen](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/profile/AccountScreens.tsx:146>), [stock default](</C:/Users/Mistire/Desktop/final year project/frontend/src/screens/store/DaycareStoreScreen.tsx:160>), [order status mutation](</C:/Users/Mistire/Desktop/final year project/backend/src/modules/store/store.service.js:287>).

## Verification results

| Check run on 18 October | Result |
| --- | --- |
| Frontend TypeScript, no emit | Passed |
| Frontend boundary and utility tests | 18 passed |
| Backend Phase 1–6 test files | Runner reports 74 passed, 2 failed out of 76 entries; one actual assertion and its enclosing parent test failed |
| Existing authentication/security/foundation tests | Runner reports 113 passed, 2 failed out of 115 entries; one actual assertion and its enclosing parent test failed |
| Additional real HTTP reproductions in an owned temporary database | Confirmed V01, V02, V03 and V04; scoped endpoint controls behaved as described |
| Reproduction cleanup | Owned temporary-database registry ended at zero |

The phase metrics failure is a test fixture issue: the test inserts an event at Date.now() minus 30 minutes and expects it to count today. The run occurred shortly after midnight in Addis Ababa, so that event belonged to the preceding day. The SQL correctly excludes the preceding date; the test needs deterministic same-day and boundary fixtures. Evidence: [fixture/assertion](</C:/Users/Mistire/Desktop/final year project/backend/scripts/phase5-reports-health-metrics.test.cjs:316>).

The older authentication test expects a hand-signed legacy JWT without the new audience/state binding to authenticate. Phase 1 deliberately rejects that token. Update the test to obtain a current session via login and separately require old-token rejection; do not weaken the security fix. Evidence: [outdated expectation](</C:/Users/Mistire/Desktop/final year project/backend/scripts/daycare-auth-app.test.cjs:300>).

No browser end-to-end journey was run. Service tests for Phases 2–6 do not by themselves prove frontend behavior or every alternate HTTP read path.

## Configured database and rollout observations

Read-only metadata inspection found migrations through 017 already applied, authentication preview still disabled, and zero PostgreSQL RLS policies. The current database's audience constraints already include the newer values. I did not apply migrations or alter that configuration during this verification.

Migration 005 was edited in place to introduce audience values. Fresh-database tests pick up that edit, but older installations that already recorded 005 will not receive it through a normal migration run. A forward upgrade migration is still needed for reproducible rollout, even though this particular configured database already has those constraints.

## Recommended next work

1. Close V01, V03 and V04, and enforce the owner management-only boundary in V07.
2. Fix the session/profile conflict and complete the correct-child safety-preserving editor together.
3. Remove all live sample-recipient/report fallbacks and finish the active-child selector.
4. Complete the original onboarding/login phase, then caregiver daily-work and remaining parent/store journeys.
5. Repair the two test expectations and add real registration-to-pickup browser coverage before marking the phases complete.

