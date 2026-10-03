# Ankelba delivery plan

Updated: 3 October 2026. This is the active execution checklist. Existing proposal, SRS, API documentation and `feature_design_plan_v2` remain source material; unfinished items below are not claims of implemented features.

## Confirmed direction

- Parent app: keep the approved supplied-design treatment, logo, Quicksand type, warm cream, navy actions, pastel cards and concise copy.
- Admin: a detailed responsive **web portal**, visually related to the parent app, with desktop navigation and information density suited to administration.
- Front desk: **assigned caregivers/daycare staff**, not pickup guardians, sign in with their own staff credentials. The user confirmed this distinction on 3 October 2026.
- Admin assigns today's attendance/pickup duty. Assigned staff use a restricted web workspace for attendance, adult guardian verification and child checkout. A staff assignment does not grant full administration privileges.
- Parents/guardians see linked-child information and present their identity at pickup. Pickup authorization, biometric enrollment, today's successful identity verification and completed checkout are separate facts.
- Finish remaining parent-page review first, then add smooth restrained motion and a connected pickup status display. Record the complete admin implementation scope now so it is carried into the next delivery phase.

## What the project already says

| Source | Existing requirement | Newly clarified detail |
| --- | --- | --- |
| SRS §2.5 | Responsive web application | Admin and front desk are specifically web workspaces |
| Feature design plan §1, §2.2 | Admin, caregiver and parent portals; credential login and role redirect | Staff login opens the duty workspace when assigned |
| SRS §2.4, FR-ATT-01–07 | Authorized staff record attendance; parents view history | Date/shift-specific front-desk assignment |
| SRS FR-BIO-01–10, UI-05 | Adult verification, selected child/guardian, controlled manual fallback | Duty scope and explicit verify/checkout capability at the desk |
| SRS FR-CH-05 / TBD-06 | Caregiver/group responsibility; exact model unresolved | Keep teaching assignment separate from temporary front-desk duty |
| Feature design plan §3 | Admin dashboard, users, children, attendance, reports, communication, events, biometric, store, audit | Same brand system as the approved app, expanded for desktop |

The current backend restricts ordinary caregiver attendance to their assigned child. There is no inspected date/shift duty model. The generic attendance write route also needs a review of the verification-before-checkout requirement; a frontend disabled button alone cannot enforce this rule.

## Delivery order and checkpoints

### 0. Requirements and traceability

- [x] Read SRS, proposal, feature design plan, backend architecture, API docs and actual relevant route/service code.
- [x] Confirm staff versus guardian terminology with the user.
- [x] Record web-admin design and front-desk workflow in this plan and a dated SRS addendum.
- [x] Updated this checklist after the parent review/motion pass; incomplete admin/integration/device checks remain explicitly open.

### 1. Finish parent-page review

- [x] Reports: date filters, distinct historical timelines, absent state, correct check-in/out display.
- [x] Child identity: consistent photo, age and birth date across current preview screens.
- [x] Calendar: month/date filters, holiday-specific content, correct daycare office message destination, session-local reminders.
- [x] Chat/AI: fixed toolbar/back control, local message preview labels, actual AI endpoint path.
- [x] Messages: search both messages and announcements, useful no-results state.
- [x] Guardians/account: contact validation, missing-record states, draft labels; parents cannot grant pickup permission.
- [x] Store/cart: quantity clamping and out-of-stock controls.
- [x] Finish browser review of store, cart, checkout, orders, notifications and security/account layouts.
- [x] Complete narrow-phone review and connected pickup status layout.
- [x] Save review findings and screenshots in `frontend/design/PAGE_REVIEW.md` and `tmp/page-review/`.
- [x] Run focused logic tests and TypeScript; report remaining integration gaps without claiming production completion.

### 2. Motion after the remaining page review

- [x] Inspect supplied `frontend/animations/Baby & Mom Love.lottie` and `Learning.lottie` for suitability and asset dependencies.
- [x] Apply subtle page entrance and button feedback consistently; avoid layout shifts and delaying actions.
- [x] Add a small nurturing illustration animation in an appropriate welcome/help context while retaining the approved reference artwork.
- [x] Connect pickup steps with a line: Guardian authorized → Identity verified → Checked out.
- [x] Completed, current, waiting and unavailable states must have text/icon differences, not color alone. Enrollment never counts as today's verification.
- [x] Animate only transitions in displayed state; never simulate verification, payment, attendance or checkout success.
- [x] Honor reduced-motion preferences, stop animations offscreen, clean up listeners, keep static fallbacks and avoid distracting indefinite decoration.
- [x] Validate web and Android bundles, small-phone layout and ordinary motion in the browser.
- [ ] Verify OS/browser reduced-motion switching and motion on a physical Android device (implementation/code-reviewed; not device-tested).

### 3. Admin and staff web interface

Build this as a separately routed, full-width web experience. Reuse brand tokens/assets, not the parent's 480px shell. Establish route/deep-link strategy before implementing the portal. A local visual preview must remain clearly separate from authenticated operational screens.

| Area / proposed route | Required content and interactions | Acceptance |
| --- | --- | --- |
| Login `/login` | Credentials, invalid/inactive/session-expired states; server-resolved role routing | Admin → admin dashboard; staff → caregiver/duty workspace; parent → parent experience; direct URLs guarded |
| Dashboard `/admin/dashboard` | Enrolled/present/absent/collected counts, missing reports by group, pending orders, recent activity, concise quick actions | Counts reflect selected day/server data; empty/loading/error states |
| Front-desk assignments `/admin/front-desk` | Date, shift start/end, staff, child/group/center scope, attendance and pickup capabilities, assignment status; edit/revoke | Own credentials, explicit scope, expired/revoked duty loses write access immediately |
| Desk `/staff/front-desk` | Current duty banner, child search/group filters, attendance totals, present/absent/pending/collected list, selected-child panel | Only permitted records/actions; clear not-assigned and ended-shift states |
| Users `/admin/users` | Search/filter/pagination; create/edit/activate/deactivate; role display | No shared credentials; server permission checks; account changes audited |
| Children `/admin/children` | Search/group/status; create/profile, emergency contacts, care instructions, guardian links, caregiver/group assignment | Correct child visible on every action; parent link/pickup approval admin-controlled |
| Groups `/admin/groups` | Group records and staff/child assignment | Teaching responsibility stays separate from desk assignment |
| Attendance `/admin/attendance` | Day grid, histories/date range, check-in/absence, pickup entry; supported correction workflow with reason | No duplicate/conflicting event; corrections retain audit trail |
| Pickup `/staff/pickup/:childId` | Child + authorized adult, enrollment indicator, identity check, controlled fallback, final review, checkout receipt | Verification for this child/adult/visit before checkout; fresh authorization checked server-side |
| Biometrics `/admin/biometric` | Authorized-adult lookup, enrollment, device state, reference status, verification history | No child biometrics; no raw biometric payloads in UI/logs; explicit enrollment permission |
| Daily reports `/admin/reports/daily` | Group/date/caregiver filters, completion monitor, report details | Correct dates/children; controlled correction permissions |
| Health/incidents `/admin/reports/health` | Factual notes, type/date/child filters, detail, parent notification state | Restricted access; no diagnosis/treatment claims |
| Communication `/admin/communication` | Messages, announcements, alerts, audience selection, search/history | Actual recipients/audience clear; API state accurately shown |
| Events `/admin/events` | Calendar/list, create/edit/cancel, type/date/time/audience | Holiday/closure behavior and timezone correct |
| Store `/admin/store` | Products, categories, price/availability, stock; orders with item details | Stock validation on server; child pickup and store collection distinct |
| Payments/order detail | Separate operational and payment states, pay-at-daycare recording, verified gateway status | Browser redirect never sufficient proof of payment; no fake checkout URLs |
| Audit `/admin/audit` | Actor/action/record/time/result, filters/pagination; duty and pickup events | Staff sees only permitted operational history; admin audit protected |
| Account/session | Own profile, logout, recovery/change password | No seeded preview identity after live authentication; server session handled consistently |

Caregiver workspace retains assigned-child reporting, attendance as permitted, health/incident entry, messages and announcements. Desk duty adds temporary operational permissions; it does not silently replace or broaden the regular caregiver role.

#### Web design contract

- Use supplied Ankelba logo; locally bundled Quicksand; cream `#FFFBED`, navy `#061224`, shared semantic pastels, rounded cards and restrained background glows.
- Desktop: approximately 240px sidebar, page header with selected date/search/account, readable content width and 12-column layout. Tablet: collapsible navigation; mobile: stacked cards and horizontally scrollable tables where needed.
- Consistent spacing scale (4/8/12/16/24/32), 24px primary card corners, compact but readable table rows, clear active navigation and keyboard focus.
- Detailed data belongs in filters, tables, tabs and side panels. Keep introductions/help concise; place explanations next to relevant fields.
- One clear primary action per workflow step. Clearly distinguish submit, draft, approved, pending, failed and completed states.
- Every data screen needs loading, empty, error/retry, permission-denied and stale/conflicting-data handling. Pagination, search and selected-date/filter state must work.
- Confirmation for consequential record changes; prevent duplicate submission; preserve entered form values after recoverable errors.

### 4. API contracts, duty authorization and pickup integration

- [ ] Create a route/payload/response/permission matrix from actual source. Resolve disagreements with API docs before binding screens.
- [ ] Add a separate duty-assignment model: staff ID, local service date, start/end timestamps, scope, allowed actions, assigned-by, status/revocation and audit timestamps. Proposed endpoint names require contract design.
- [ ] Reuse authentication and centralized authorization; check active account + role + assignment scope/time on every protected read/write. Do not grant all caregivers center-wide data by removing existing checks.
- [ ] Use daycare timezone (Africa/Addis_Ababa), server timestamps, explicit shift boundaries and revocation. Record the actual staff actor on attendance and verification.
- [ ] Attendance transitions: no record → check-in or absence; checked-in → verified checkout. Define late-arrival correction and same-day re-entry explicitly with an audit trail; reject repeated checkout and conflicting concurrent events.
- [ ] Verify adult is currently approved for selected child. Capture successful biometric/manual verification event for that visit; failed/unavailable verification cannot release the child.
- [ ] Manual fallback: authorized staff, clear reason and evidence/check performed, any configured supervisor approval; audit result. Provider/device choice remains a dependency.
- [ ] Checkout atomically consumes a valid, unexpired, unused verification for the same child/adult/visit, records attendance and actor, and updates parent history. Re-check current duty and guardian authorization. Prevent replay/double-click/concurrent release.
- [ ] Parent pickup view reads authorized server status; show last updated time and error/offline state. Do not animate guessed completion.
- [ ] Guardian parent-read/request workflow: current guardian routes are admin-only; introduce properly scoped contracts before replacing local drafts.
- [ ] Auth: normalize `/auth/me` `{ user }`, profile/linked children and actual cookie/token behavior. Align recovery with existing reset-token APIs; OTP endpoint currently absent.
- [ ] Messages/announcements/notifications: actual recipient and child scope; notification endpoint currently returns counts, not a feed.
- [ ] Reports/attendance/health: connect real histories; add dedicated parent attendance and health/incident views, including empty and restricted states.
- [ ] Store/orders/payments: server stock and totals, idempotent order creation, real gateway integration if selected; separate not-paid/paid/refunded from ready/collected/cancelled.
- [ ] AI: authenticated `/ai/guide`, authorized minimal child context, provider failures and informational boundaries. Provider implementation remains to be verified.
- [ ] Sync documentation and frontend types with verified contracts. No database mutation or production deployment as part of a visual review.

### 5. Acceptance and handoff

- [ ] Role tests: admin; assigned caregiver; unassigned/expired/revoked staff; parent; disabled account; stale session; direct route/API attempts.
- [ ] Duty tests: permitted date/time/scope, another child's record, shift change during pickup, revoked assignment during submission.
- [ ] Pickup tests: approved/unapproved adult, enrolled but unverified, successful/failed/unavailable biometric, permitted/denied fallback, expired/reused verification, duplicate and concurrent checkout.
- [ ] Attendance tests: check-in, absence, duplicate submissions, no-check-in checkout, post-checkout conflicts, timezone/day boundaries and audited corrections.
- [ ] Parent journeys: login/recovery, linked-child report/attendance/health, messaging, events, guardians, cart/orders, notification preferences, AI failure.
- [ ] Visual checks: parent 320/390px; admin 768/1024/1440px; keyboard/focus, readable contrast, font scaling and reduced motion.
- [ ] Build checks: TypeScript, focused tests, web and Android exports. Actual Android device and biometric hardware tests tracked separately from bundle success.
- [ ] Save screenshots and summarize verified behavior, remaining dependencies and next unfinished checklist items. Never equate mock UI, a passing bundle or documentation with an integrated feature.

## Current delivery status

Parent page review and shared motion are implemented; five focused regression checks and TypeScript pass. Production web and Android Hermes exports pass after the final animation-style correction. Browser validation includes 320px and 390px layouts; runtime logs are clean in the reviewed preview. Reduced-motion code uses the platform preference and live-change listener; changing the OS/browser preference and testing on a physical device remain unverified.

The supplied Lottie archives are preserved and structurally inspected (320×475, 5.03 seconds; 700×700, 7.37 seconds; no external image assets). This pass uses a small original vector animation and React Native Animated across platforms; it does not install the missing optional Lottie web player or replace approved onboarding artwork.

**Next delivery phase: Phase 3 web admin/staff interface, followed by Phase 4 API/duty/pickup integration.** Neither the full admin portal nor live duty assignment is implemented by the parent visual pass.

## Open implementation decisions

Biometric device/modality and supported web integration; fallback policy/supervisor requirements; verification expiry; shift overlap/overnight policy; attendance correction/re-entry rules; live payment gateway/merchant configuration; AI provider; session deployment/CORS settings; retention policy. These can be specified progressively while independent design and interface work continues.
