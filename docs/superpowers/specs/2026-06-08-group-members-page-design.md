# Group Members Page Design

## Context

The current `/groups` page shows candidate groups as cards and opens member management inside a large dialog. The "Current Members" panel is too constrained for long member lists, and it cannot show the full candidate roster columns requested by administrators.

The approved direction is to keep `/groups` as the group overview and create a dedicated members page for each group.

## Goals

- Add a dedicated admin route for a group's members: `/groups/:id/members`.
- Replace the cramped current-members dialog experience with a full-width roster table.
- Show the roster columns requested by the admin:
  - `STT`
  - `Ho ten`
  - `Ngay sinh`
  - `Truong`
  - `Xa/Phuong`
  - `Mon thi quoc gia`
  - `Khoi thi`
  - `SBD`
  - `Email lien lac`
  - `SDT lien lac`
  - `Tai khoan`
  - `Mat khau`
- Store and return an admin-visible password value for new candidate accounts created or imported after this change.
- Keep legacy accounts simple: if no stored visible password exists, render the password cell empty or as a neutral missing value. The user plans to delete old accounts and recreate/import them.

## Non-Goals

- Do not recover existing passwords from Django hashes. That is impossible by design.
- Do not redesign the whole user management module.
- Do not add parent/self-service privacy constraints for this page. The admin user has operational control over candidate accounts.
- Do not add export in this iteration unless it is already trivial from existing import/table utilities.

## Data Model

Extend the candidate profile data currently stored on `identity.Profile`.

Existing profile fields used:

- `date_of_birth`
- `student_class`
- `school`
- `phone_number`
- `cccd`

New profile fields:

- `ward`: free-text `CharField`, blank allowed.
- `national_exam_subject`: free-text `CharField`, blank allowed.
- `exam_block`: free-text `CharField`, blank allowed. This maps to the requested `Khoi thi`.
- `candidate_number`: free-text `CharField`, blank allowed. This maps to `SBD`.
- `visible_password`: free-text `CharField`, blank allowed. This stores the admin-visible password value for newly created/imported/reset candidate accounts.

The user account's `username` is the roster `Tai khoan`. The profile `visible_password` is the roster `Mat khau`.

`Email lien lac` maps to `User.email` for this iteration. If a candidate account is created without a real email, the existing fallback email such as `{username}@student.local` may appear until a contact email is provided.

## Backend API

### Membership List

Update `GET /api/v1/groups/{id}/memberships/` so each membership includes the detailed roster fields:

- membership id, user id, membership active state, created timestamp
- `full_name`
- `date_of_birth`
- `school`
- `ward`
- `national_exam_subject`
- `exam_block`
- `candidate_number`
- `email`
- `phone_number`
- `username`
- `visible_password`

The queryset should use `select_related("user", "user__profile", "user__profile__school")` to avoid per-row profile/school queries.

The endpoint should support at least:

- pagination using the existing DRF pagination
- search by name, email, username, phone, candidate number, school name
- stable ordering by candidate number if present, then full name/email

The detailed serializer, including `visible_password`, should only be used by authenticated admin users who already pass the existing group permission checks. Candidate-facing APIs must not include `visible_password`.

### Create and Update Candidate Accounts

When creating candidate accounts through group member flows:

- If the admin provides a password, set the Django password and save the same value to `profile.visible_password`.
- If no password is provided for an import row, keep the current username-derived fallback pattern and save that generated value to `profile.visible_password`.

When updating/resetting a candidate password through admin flows:

- If a new password is provided, call `set_password(new_password)` and update `profile.visible_password = new_password`.
- If no password is provided, do not change either the Django password hash or `visible_password`.

### Import

Update group membership import to accept the roster columns and common normalized alternatives:

- `full_name`
- `date_of_birth`
- `school_code` or `school`
- `ward`
- `national_exam_subject`
- `exam_block` or `student_class`
- `candidate_number` or `sbd`
- `email`
- `phone_number`
- `username`
- `password`

For school assignment, `school_code` is the canonical import field because the current system stores `School` records by code. A plain `school` column may be accepted only as a best-effort lookup by existing school name; it should not create new schools inside the membership import.

The import should continue to create/update candidate users and assign them to the group.

## Frontend

### `/groups`

Keep the current group card layout. Change the member action from an add-members dialog entry point into a navigation action:

- Button label: `Thanh vien`
- Icon: users/user-list icon from `lucide-react`
- Route: `/groups/:id/members`

The page can still keep a lightweight create/edit group dialog.

### `/groups/:id/members`

Create a new admin page, `GroupMembersPage`.

Top area:

- Back link to `/groups`
- Page title with group name
- Member count
- Search input
- Import CSV controls
- Add candidate button

Main table:

- Use a wide table with horizontal overflow for desktop.
- Use vertical pagination rather than trying to fit all rows in one dialog.
- Keep dense but readable row height for operational scanning.
- Columns:
  - `STT`
  - `Ho ten`
  - `Ngay sinh`
  - `Truong`
  - `Xa/Phuong`
  - `Mon thi quoc gia`
  - `Khoi thi`
  - `SBD`
  - `Email lien lac`
  - `SDT lien lac`
  - `Tai khoan`
  - `Mat khau`
  - actions

Actions per row:

- edit candidate
- remove from group
- delete account, if the existing permission pattern allows it from this flow

Dialogs:

- Reuse the existing candidate create/edit behavior from `GroupManagement`, but expand the form with the new fields.
- Password field remains editable by admin. On save, if it has a value, it updates both login password and visible password.

## Error Handling

- If the group does not exist, show a normal admin empty/error state and provide a back link to `/groups`.
- If the membership list request fails, show the API error and keep the table area stable.
- If an import row fails validation, keep the current import summary pattern and list row errors.
- If an old account has no `visible_password`, show an empty value or `-`, not a fake password.

## Testing

Backend tests:

- Membership serializer returns the new roster fields.
- Group memberships endpoint includes profile/school fields.
- Creating/importing a candidate stores `visible_password`.
- Updating a candidate password updates `visible_password`.
- Existing accounts without `visible_password` are allowed and serialize with an empty password.

Frontend tests:

- Route matching includes `/groups/:id/members`.
- `/groups` renders a members navigation action.
- `GroupMembersPage` requests `/api/v1/groups/{id}/memberships/`.
- The roster table renders `Tai khoan` and `Mat khau` columns.
- Missing `visible_password` renders a neutral empty value.

## Deployment Notes

This change requires a Django migration for the new profile fields. Production deploy should use the existing `deploy/update.sh` flow so migrations run before restarted containers serve the new frontend.
