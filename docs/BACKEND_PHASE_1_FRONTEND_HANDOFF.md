# Backend Phase 1 — frontend integration

Implemented 18 October 2026. Frontend files were not changed.

## Session stability

Migration `018_profile_security_revisions.js` is applied to the local database.
Legacy login sessions now survive ordinary name/profile-completion/daycare-settings edits.
Changes to email, password, role, daycare assignment or account status revoke the account's sessions.
Daycare status changes revoke that daycare's sessions, including suspension followed by reactivation.
Existing timestamp fingerprints are preserved during upgrade. Rollback intentionally invalidates sessions.
The newer authentication mode remains disabled; this does not enable the authentication cutover.

## Atomic profile endpoint

Parent authentication required. Use the ID of the selected child.

1. `GET /api/parent/children/:id/care-profile`
2. Hydrate the form from `child`, including `care_instructions` and `emergency_contacts`.
3. Submit `PATCH /api/parent/children/:id/care-profile` using the returned `version`.

Both responses have `{ child, parent, version }`. `parent` contains `id`, `name`, and `profile_complete`.
Child fields include identity, enrollment status, classroom/caregiver IDs, relationship, pickup authorization,
care instruction records and emergency contact records. The opaque version is scoped to that parent's view.

Example PATCH (replace the version with the value from GET):

```json
{
  "version": "<64-character version from GET>",
  "profile": { "full_name": "Child name", "relationship": "Mother" },
  "parent_name": "Parent name",
  "care_instructions": [
    { "category": "allergy", "instruction_text": "Existing confirmed allergy information" }
  ],
  "emergency_contacts": [
    { "name": "Emergency contact", "relationship": "Aunt", "phone": "0900000000" }
  ],
  "complete_profile": true
}
```

- Omitted sections/fields stay unchanged. Do not send empty arrays as loading placeholders.
- Supplied arrays replace the whole section. `[]` explicitly clears it; `null` is rejected.
- Strip record IDs when submitting array entries; send only the fields above.
- Canonical care categories: `allergy`, `dietary`, `medical_note`, `general`.
  Existing aliases `diet`, `medication`, `note`, `routine` are accepted and normalized.
- Editable child fields: `full_name`, `dob` (valid nonfuture YYYY-MM-DD), `gender` (male/female/other),
  `photo_url` (HTTPS URL or null to clear), `relationship`.
- Classroom, caregiver, enrollment and pickup authorization are not parent-editable. Unknown fields are rejected.
- Limits: 100 care instructions, 5 contacts; contact name/relationship/phone are required.
- `complete_profile: true` requires child name, date of birth and at least one emergency contact.
  False does not undo completion. Completion retains the existing account-level meaning.
- On success replace the form's version with the returned version.
- `409`: newer data exists. Reload and let the parent review it; never silently retry an old replacement.
- `422`: invalid input or incomplete completion request. No partial changes are committed.
- `403`: account/daycare/guardian ownership is not permitted. `401`: invalid or revoked session.
- Identity, parent name, care, contacts, completion and the audit entry commit together or roll back together.
  Audit metadata records section names, not sensitive care text.

Existing `/profile`, `/care`, `/emergency-contacts` and `/profile-complete` routes remain compatible.
Legacy parent section saves now recheck ownership with transaction locks, but do not provide the new
version-conflict contract. Migrate the wizard to the atomic endpoint to gain whole-form rollback protection.

## Validation and limits

New tests cover upgrade/rollback, session fingerprint stability and revocation, omitted/empty sections,
validation, ownership, rollback after writes, simultaneous saves and actual HTTP login/save/me flow.
Existing child-safety and legacy authentication suites also pass.

This completes the first backend implementation package, not the entire SaaS roadmap. A browser journey
is still the frontend integration responsibility. Concurrency guarantees cover this endpoint and the
legacy parent writes that share its locks; a later integrity pass must bring all administrator care/contact
writes under the same locking/version convention. Tenant cleanup/RLS, invitations and authentication
cutover remain subsequent work.
