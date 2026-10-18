# Repair progress — agreed SaaS sequence

The approved order is foundational repairs, onboarding, daycare prefixes and branding, full operational journey verification, then commercial and advanced features.

## First repair batch

- V01: Notification alerts reuse communication audience rules. Message/order badges require the caller's daycare. Health badges require matching child ownership and caregiver assignment.
- V03: Removed NULL ownership fallback from product, order, event, search and parent-child paths. Unowned products cannot be edited or purchased by tenant accounts. Historical ownership cleanup, database constraints and RLS remain separate unfinished work.
- V04: Meal plans reuse announcement audience authorization. Classroom filters only narrow results, and unrelated classroom requests return no data.
- V07: Mounted operational APIs reject platform-owner accounts, including legacy communication aliases. Portal service authorization independently rejects owners. SaaS governance routes remain available. This does not constitute a complete privileged-access audit.
- V06: Removed hardcoded message recipients and sample inbox fallback. Home/profile shortcuts open actual contacts. Missing recipient IDs prevent chat requests. Loading failures offer retry. Read acknowledgement is awaited.

## Verification

- Combined isolated backend suites (phases 2, 3, 4, 6): 44 reported entries passed, including enclosing suite entries.
- Added regressions for alternate notification/meal reads, unowned products, and actual HTTP owner denial with governance access preserved.
- Frontend TypeScript check passed; existing frontend boundary/utility suite: 18 passed.
- No browser journey verification yet. Frontend checks do not prove interactive chat behavior.
- Tests used generated temporary databases. No configured application database migration or data modification was performed.

## Remaining before step 1 can be marked complete

1. V02/V05: Separate security revisions from ordinary profile timestamps, then repair child selection, safety-data hydration and saving together. Preserve revocation after suspension/reactivation and password changes.
2. V10: Correct report navigation and today's-data handling.
3. Broaden regression coverage for health badges, unowned events/children and chat interaction.
4. Complete the remaining isolation/data-integrity work and end-to-end verification.

After foundational repairs: V08 onboarding/shared login and invitations; V09 caregiver workflows/corrections; V11 guardian, notification and inventory workflows. Daycare subdomains and branding follow reliable onboarding. Payment integrations and customer-owned domains remain deferred. The original verification report remains a historical record; this batch does not establish completion of Phases 1–6.
