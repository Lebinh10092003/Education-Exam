# Exam Student Direct Import Design

Date: 2026-03-21

## Goal

Add a direct CSV import flow that creates or updates `student` users and assigns them straight to a specific exam without routing through candidate groups. The same change also adds first-class `username` support so users can sign in with either `username` or `email`.

## Current Context

- The backend identity model uses `email` as the unique login field and does not currently store `username`.
- Student-specific fields such as `cccd`, `date_of_birth`, and `student_class` do not exist yet.
- Exam assignment already supports direct assignment by `user_id` through `ExamAssignment`.
- The exam assignment screen only handles group assignment today.
- The question bank already has a synchronous import pattern that can be reused for CSV processing and summary responses.

## Scope

This design covers:

- adding `username` to identity and supporting login by `username` or `email`
- extending student profile data for import matching and account generation
- adding a direct exam-scoped student CSV import endpoint
- extending the exam assignment UI to upload, validate, and show import results
- preserving the existing group-assignment flow

This design does not cover:

- asynchronous import jobs or batch history tables
- a generic user-management import pipeline
- importing through groups
- changing JWT token structure beyond optional `username` exposure

## Data Model Changes

### User

Add a new unique `username` field to `apps.identity.models.User`.

Requirements:

- unique across all users
- indexed
- populated for existing users during migration
- exposed through serializers where useful for admin and profile UIs

Migration strategy:

- backfill existing users with deterministic values derived from the local part of `email`
- if collisions occur, append numeric suffixes
- keep `email` unique and required for compatibility with the existing model and serializers

### Profile

Extend `apps.identity.models.Profile` with student-oriented fields:

- `cccd`: string, unique when present
- `date_of_birth`: date, nullable
- `student_class`: string, blank allowed

These fields are used by the import pipeline and future student administration views.

## Authentication Design

### Login Input

Keep the existing login endpoint at `POST /api/v1/auth/login/`.

Behavior:

- accept `identifier` plus `password` as the new canonical input
- also accept the existing `email` field as a backward-compatible alias
- resolve the account by:
  - `username__iexact=identifier`, or
  - `email__iexact=identifier`

### Compatibility

- the frontend auth flow remains token-based and does not change structurally
- the backend still returns access and refresh tokens in the current shape
- `/api/v1/profile/` may include `username` so the UI can display the generated credential if needed
- existing email-based sign-in continues to work unchanged

## Student Import Rules

### Input Format

Add a CSV-only import flow for now.

Required columns:

- `full_name`
- `date_of_birth`
- `student_class`
- `cccd`

Optional columns:

- `email`
- `phone_number`
- `school_code`

Date parsing rule:

- accept `DD/MM/YYYY`

### Generated Username

For each row, generate a username from:

- normalized Vietnamese full name without accents
- date of birth in `DDMMYYYY`
- class value

Example:

- `Lê Văn Bình`, `24/08/2003`, `12`
- becomes `le.van.binh.24082003.12`

Normalization rules:

- lowercase
- strip accents
- collapse whitespace
- use `.` as separator
- trim punctuation noise

If the generated username already exists for a different student:

- append `.1`, `.2`, and so on until unique

### Password Rule

For newly created users:

- password is initialized to the generated `username`

For matched existing users:

- preserve the current password

### Email Rule

The current user model still requires unique email.

Import behavior:

- if the CSV row provides an email, use it after uniqueness checks
- if the CSV row does not provide an email, synthesize one as `{username}@student.local`

If an email collides with another account that does not match the same `cccd`:

- mark that row as failed

### Student Matching Rule

Primary identity resolution is based on `cccd`.

Behavior:

- if a user with matching `profile.cccd` exists, treat the row as the same student
- update mutable fields when the CSV value differs:
  - `full_name`
  - `date_of_birth`
  - `student_class`
  - `phone_number`
  - `school`
  - `email`, when supplied and safe to update
- ensure the user has the `student` role
- assign the user to the exam if not already assigned

If no matching `cccd` exists:

- create a new user
- create or update the related profile
- assign the `student` role
- assign the user to the exam

If `username` or `email` collides with a different user and `cccd` does not match:

- fail that row
- do not merge users by guessed identity

## API Design

### Endpoint

Add a new exam action:

- `POST /api/v1/exams/{id}/student-import/`

Request type:

- `multipart/form-data`

Inputs:

- `file`: CSV upload

Permission:

- same exam-management permission used for exam assignment updates

### Response

Return a synchronous summary response with enough detail for the admin UI.

Proposed fields:

- `total_rows`
- `created_users`
- `updated_users`
- `assigned_users`
- `skipped_rows`
- `failed_rows`
- `errors`: list of row-level errors containing:
  - `row_number`
  - `identifier`
  - `message`

### Processing Behavior

- validate the file and required headers before row processing
- process rows transactionally per row, not as one global transaction
- allow partial success
- avoid duplicate `ExamAssignment` records
- reuse the existing direct `ExamAssignment.user` path instead of adding new tables

## Service Layer Design

Create a dedicated service in `apps.exam_authoring.services` or a focused import module under the same app.

Responsibilities:

- parse CSV rows
- normalize `cccd`, dates, class labels, and names
- generate usernames
- resolve school by `school_code`
- find or create users
- update profile data
- ensure `student` role membership
- create direct exam assignments
- build the import summary

The service should stay isolated from the view layer so it can be covered directly by tests.

## Frontend Design

Extend the existing exam assignment page in `src/app/pages/ExamAssignment.tsx`.

### Layout

Keep the current group-assignment area and add a second card for direct student import.

The new card includes:

- CSV file picker
- template preview/download actions using the existing `ImportTemplateActions` pattern
- short instructions for:
  - required CSV columns
  - username generation rule
  - default password rule
- import action button

### Results UX

After import:

- show a toast for high-level success or mixed-result status
- show an inline summary panel with:
  - created count
  - updated count
  - assigned count
  - failed count
- render row-level errors under the summary when present
- reload exam details so the total candidate count updates immediately

### Login UI

Update the login form text to indicate that either email or username is accepted.

Recommended UI changes:

- relabel the field from `Email Address` to `Email or Username`
- remove strict email-only expectations from placeholder and input handling

## Validation and Error Handling

Reject the entire request when:

- no file is provided
- the file is not CSV
- required headers are missing

Handle row-level failures without aborting the whole import for:

- missing `cccd`
- invalid date format
- unknown `school_code`
- conflicting email
- unexpected username collision after exhausting suffix attempts

For already assigned users:

- do not create duplicate assignment rows
- count them as skipped or assigned according to the summary semantics chosen in implementation

## Testing Strategy

### Backend Tests

Add API and service tests for:

- login with email still succeeds
- login with username succeeds
- student import creates a new user, profile, role, and exam assignment
- student import matches by `cccd`, updates changed fields, and assigns the existing user
- student import returns partial success when some rows fail
- duplicate assignment rows are not created
- synthesized email works when the CSV omits email
- conflicting email for a different `cccd` fails the row safely

### Frontend Verification

Verify:

- login works with username and email from the same form
- exam assignment screen uploads a CSV and renders the returned summary
- error rows appear in the UI without breaking the page

## Implementation Notes

- Prefer backward-compatible serializer changes so current frontend API calls keep working during rollout.
- Keep the import synchronous in this round to limit scope and reuse the current request-response UI model.
- Preserve the existing group assignment workflow unchanged.
- Keep the direct exam import scoped to `student` users only.
