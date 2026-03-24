# Candidate Group School Removal Design

## Summary

`CandidateGroup` is currently modeled as optionally belonging to a `School`. That conflicts with the intended domain: a candidate group is a reusable assignment bucket that may include students from many schools, provinces, or competition cohorts. `School` belongs to each candidate profile, not to the group container itself.

This change removes `school` from the `CandidateGroup` model, API payloads, and frontend management flows. Group membership imports will continue to support per-row `school_code`, but missing `school_code` will no longer inherit from the group.

## Goals

- Remove `school` from the `CandidateGroup` concept across backend and frontend.
- Keep `School` as a property of the student/candidate profile only.
- Preserve group assignment behavior for exams.
- Preserve CSV membership import with per-row `school_code`.

## Non-Goals

- Redesign student profile school handling.
- Change direct student import to exams beyond keeping existing per-row `school_code` behavior.
- Translate or rename existing demo group content beyond what is required to remove school coupling.

## Current Root Cause

- `backend/apps/institutions/models.py` defines `CandidateGroup.school`.
- `backend/apps/institutions/api/serializers.py` exposes `school_id` and `school_name`.
- `backend/apps/institutions/api/views.py` filters and searches groups by school.
- `backend/apps/institutions/services.py` uses `group.school` as the fallback school during membership import.
- `src/app/pages/GroupManagement.tsx` lets admins filter, edit, and display group school values.
- `backend/apps/exam_authoring/api/views.py` and `src/app/pages/ExamAssignment.tsx` surface group school in the exam assignment picker.

## Chosen Approach

Remove `CandidateGroup.school` entirely from the model and all API/UI consumers.

### Backend

- Remove the `school` field from `CandidateGroup`.
- Add a migration that drops `CandidateGroup.school`.
- Remove `school_id` and `school_name` from the candidate group serializer.
- Remove query filtering, searching, and `select_related("school")` that depend on the deleted field.
- Update membership import so `school_code` resolves only from the CSV row. If omitted, the import keeps the existing profile school for existing users and leaves school empty for newly created users.
- Remove group school payloads from exam assignment APIs and summaries.
- Update demo seed so group creation no longer passes `school=...`.

### Frontend

- Remove school filter, school field, school badge, and school copy from `GroupManagement`.
- Update request payloads so create/update group calls only send `name`, `description`, and `is_active`.
- Remove school display from the exam group assignment picker.

## Data Handling

- Existing `CandidateGroup.school_id` values are discarded by the migration because they no longer represent valid business meaning.
- `Profile.school` remains untouched.
- Membership import remains the supported way to attach or update school information for each candidate.

## Error Handling

- Group creation and update continue to validate required `name`.
- Membership import still rejects unknown `school_code`.
- Missing `school_code` no longer causes inferred school assignment from the group.

## Testing

- Backend API test: creating a group succeeds without `school_id`.
- Backend import test: importing with blank `school_code` does not inherit a school from the group.
- Backend import test: importing with explicit `school_code` still updates profile school correctly.
- Frontend test: group management renders and saves without school controls.
- Frontend or API-backed test: exam assignment group list no longer depends on a `school` object.
