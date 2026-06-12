# School Auto Resolution Import Design

## Goal

When admins import students or users, the system should attach each profile to the right school without requiring the admin to pre-create or know the school code. If a school name appears in an import and no matching school exists, the backend creates the school and assigns the profile to it.

## Scope

Apply one shared school resolver to all CSV imports that can set `Profile.school`:

- `POST /api/v1/users/import-csv/`
- `POST /api/v1/exams/{id}/student-import/`
- `POST /api/v1/groups/{id}/memberships/import/`

The resolver accepts `school_code`, `school`, and `school_name` columns. Existing files that only include `school_code` continue to work.

## Current State

School lookup is duplicated:

- User import resolves `school_code` inside `identity.services`.
- Exam student import resolves only `school_code` inside `exam_authoring.services`.
- Group membership import can read `school_code` and `school`, but unknown names currently fail.

This forces admins to know codes before import and makes equivalent names such as `Tiểu học Nguyễn Tri Phương`, `TH Nguyễn Tri Phương`, and `Tiểu học NGUYỄN TRI PHƯƠNG` behave differently.

## Proposed Behavior

Create shared helpers in `apps.institutions.services`:

- Normalize school names for matching.
- Resolve a school by code.
- Resolve a school by name.
- Create a school when a name is provided and no equivalent existing school is found.
- Generate a stable unique code for newly created schools.

Resolution order:

1. If `school_code` is present and matches an existing code, return that school.
2. If `school` or `school_name` is present, normalize the name and compare it against existing school names.
3. If an equivalent name exists, return that school.
4. If no equivalent name exists, create a new active `School` with the cleaned display name and generated code.
5. If only an unknown `school_code` is present and no name is provided, keep the current row-level error because the backend cannot infer the intended school name.
6. If no school fields are present, leave `Profile.school` unchanged for existing group members where current behavior does that, or `None` for new profiles.

## Name Normalization

The normalized comparison key should:

- Trim leading/trailing whitespace.
- Collapse repeated internal whitespace.
- Lowercase text.
- Remove Vietnamese accents.
- Normalize common school-level prefixes:
  - `Tiểu học`, `Trường tiểu học`, `TH` map to the same primary-school prefix.
  - Matching is prefix-aware so `TH Nguyễn Tri Phương` and `Tiểu học Nguyễn Tri Phương` compare equal.

The stored `School.name` keeps a readable cleaned display name from the import. The code does not need to title-case Vietnamese text automatically because title-casing can damage proper names.

## Code Generation

For a newly created school:

- Generate a base code from the normalized display name with `django.utils.text.slugify`.
- Uppercase it and replace separators with `-`.
- Use a fallback such as `SCHOOL` if the slug is empty.
- Ensure uniqueness by appending `-2`, `-3`, etc. when needed.

Examples:

- `Tiểu học Nguyễn Tri Phương` -> `TIEU-HOC-NGUYEN-TRI-PHUONG`
- Duplicate generated code -> `TIEU-HOC-NGUYEN-TRI-PHUONG-2`

## Integration Points

`identity.services.import_users_from_csv`:

- Read `school`, `school_name`, and `school_code`.
- Replace inline school-code lookup with the shared resolver.

`exam_authoring.services.import_students_to_exam`:

- Read optional `school` or `school_name` in addition to `school_code`.
- Replace `_resolve_school_by_code` with the shared resolver.

`institutions.services.import_memberships_to_group`:

- Keep support for `school_code` and `school`.
- Change unknown school-name behavior from row error to create-or-reuse.
- Reuse the same per-batch cache shape as the shared resolver.

`src/app/lib/importTemplates.ts`:

- Add `school` to student and group import templates.
- Mention that admins may use either an existing `school_code` or a school name; new names are created automatically.

## Error Handling

Row-level errors continue for invalid required fields, invalid dates, duplicate emails, unknown role slugs, and unknown code-only school references.

Creating a new school should happen inside the row transaction where possible so a failed row does not leave an unused school behind. Existing import summaries remain unchanged.

## Testing

Backend tests should cover:

- Exam student import creates a missing school from `school`.
- Exam student import reuses an existing school when names differ only by case, accents, whitespace, or `TH` vs `Tiểu học`.
- Group membership import creates or reuses a school by name.
- User CSV import creates or reuses a school by name.
- Unknown `school_code` without a school name still reports a row error.
- Repeated school names in one import batch reuse the same school and do not create duplicates.

Frontend/template tests should cover:

- Updated CSV templates include the `school` column where useful.
- Template notes describe automatic school creation.

## Deployment

After implementation and tests pass:

- Commit the code changes.
- Push or otherwise make the VPS repo able to pull the commit.
- Run `deploy/update.sh` on the VPS path so it pulls, rebuilds backend/frontend, runs migrations, restarts services, reloads Caddy, and runs the production probes already in the script.
