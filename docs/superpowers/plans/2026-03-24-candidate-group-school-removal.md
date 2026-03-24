# Candidate Group School Removal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `school` from `CandidateGroup` across backend and frontend so school remains a per-student property only.

**Architecture:** Delete the `CandidateGroup.school` model field and all serializer/query/UI consumers, then keep school assignment only in candidate profile flows. Membership import will resolve school strictly from each CSV row and stop inheriting it from the group. Exam assignment group payloads will be simplified to group-only metadata.

**Tech Stack:** Django, Django REST Framework, React, TypeScript, Vitest

---

## File Structure

- Modify: `backend/apps/institutions/models.py`
- Create: `backend/apps/institutions/migrations/0002_remove_candidategroup_school.py`
- Modify: `backend/apps/institutions/api/serializers.py`
- Modify: `backend/apps/institutions/api/views.py`
- Modify: `backend/apps/institutions/services.py`
- Modify: `backend/apps/exam_authoring/api/serializers.py`
- Modify: `backend/apps/exam_authoring/api/views.py`
- Modify: `backend/apps/exam_authoring/services.py`
- Modify: `backend/apps/platform_core/demo_seed.py`
- Modify: `backend/tests/institutions/test_api.py`
- Modify: `backend/tests/institutions/test_group_import_api.py`
- Modify: `backend/tests/institutions/test_models.py`
- Modify: `backend/tests/grading/test_services.py`
- Modify: `backend/tests/grading/test_result_api.py`
- Modify: `backend/tests/grading/test_models.py`
- Modify: `backend/tests/grading/test_candidate_results_api.py`
- Modify: `backend/tests/grading/test_api.py`
- Modify: `backend/tests/proctoring/utils.py`
- Modify: `src/app/pages/GroupManagement.tsx`
- Modify: `src/app/pages/ExamAssignment.tsx`
- Modify: `src/app/i18n/legacyUiFallback.ts`
- Add if needed: `src/app/pages/GroupManagement.test.tsx`

## Chunk 1: Backend Domain And API

### Task 1: Remove `school` from `CandidateGroup`

**Files:**
- Modify: `backend/apps/institutions/models.py`
- Create: `backend/apps/institutions/migrations/0002_remove_candidategroup_school.py`
- Modify: `backend/tests/institutions/test_models.py`

- [ ] Step 1: Update the model to delete the `school` foreign key from `CandidateGroup`.
- [ ] Step 2: Create a migration that removes the `school` field from `institutions_candidategroup`.
- [ ] Step 3: Update model tests so groups are created without requiring a school.
- [ ] Step 4: Run `python manage.py test backend.tests.institutions.test_models -v 2`.

### Task 2: Simplify group serializers, queries, and import fallback

**Files:**
- Modify: `backend/apps/institutions/api/serializers.py`
- Modify: `backend/apps/institutions/api/views.py`
- Modify: `backend/apps/institutions/services.py`
- Modify: `backend/tests/institutions/test_api.py`
- Modify: `backend/tests/institutions/test_group_import_api.py`

- [ ] Step 1: Remove `school_id` and `school_name` from `CandidateGroupSerializer`.
- [ ] Step 2: Remove school-based search/filter logic from `CandidateGroupViewSet`.
- [ ] Step 3: Change `_resolve_school()` in group import so it resolves only explicit `school_code`, otherwise returns the existing profile school for existing users and `None` for new users.
- [ ] Step 4: Update API tests so group create/update payloads omit `school_id`.
- [ ] Step 5: Add import coverage for blank `school_code` not inheriting a group school and explicit `school_code` still updating profile school.
- [ ] Step 6: Run `python manage.py test backend.tests.institutions.test_api backend.tests.institutions.test_group_import_api -v 2`.

## Chunk 2: Exam And Seed Consumers

### Task 3: Remove group school from exam assignment payloads

**Files:**
- Modify: `backend/apps/exam_authoring/api/serializers.py`
- Modify: `backend/apps/exam_authoring/api/views.py`
- Modify: `backend/apps/exam_authoring/services.py`

- [ ] Step 1: Remove `group__school` prefetch/select usage from exam authoring querysets and summaries.
- [ ] Step 2: Remove the `school` object from `ExamGroupAssignmentSerializer` and the response payload built by `group_assignments`.
- [ ] Step 3: Run focused exam authoring tests or targeted API checks if available.

### Task 4: Update demo seed and backend tests that still create groups with schools

**Files:**
- Modify: `backend/apps/platform_core/demo_seed.py`
- Modify: `backend/tests/grading/test_services.py`
- Modify: `backend/tests/grading/test_result_api.py`
- Modify: `backend/tests/grading/test_models.py`
- Modify: `backend/tests/grading/test_candidate_results_api.py`
- Modify: `backend/tests/grading/test_api.py`
- Modify: `backend/tests/proctoring/utils.py`

- [ ] Step 1: Remove `school=` from demo group creation.
- [ ] Step 2: Update backend tests and fixtures that still pass `school=` into `CandidateGroup.objects.create(...)`.
- [ ] Step 3: Run the affected backend test files.

## Chunk 3: Frontend Group And Assignment UI

### Task 5: Remove school from group management UI

**Files:**
- Modify: `src/app/pages/GroupManagement.tsx`
- Modify: `src/app/i18n/legacyUiFallback.ts`
- Add or Modify: `src/app/pages/GroupManagement.test.tsx`

- [ ] Step 1: Remove `SchoolOption`, `schoolFilter`, `schoolsList`, and school-related request/query fields from the page.
- [ ] Step 2: Update group form state and save payloads to only include `name`, `description`, and `is_active`.
- [ ] Step 3: Remove school filter/select, school badge, and copy mentioning assigned schools.
- [ ] Step 4: Update any UI fallback translations that referenced school-based group management copy.
- [ ] Step 5: Add or update a frontend test to ensure the page renders without school controls.
- [ ] Step 6: Run `npm.cmd test -- src/app/pages/GroupManagement.test.tsx` if the test exists.

### Task 6: Remove school from exam assignment group picker

**Files:**
- Modify: `src/app/pages/ExamAssignment.tsx`

- [ ] Step 1: Remove the `school` field from `GroupAssignmentRecord`.
- [ ] Step 2: Remove school name rendering from the group list item subtitle.
- [ ] Step 3: Run any focused frontend test covering exam assignment if available.

## Final Verification

- [ ] Run `python manage.py test backend.tests.institutions.test_models backend.tests.institutions.test_api backend.tests.institutions.test_group_import_api backend.tests.grading.test_services backend.tests.grading.test_result_api backend.tests.grading.test_models backend.tests.grading.test_candidate_results_api backend.tests.grading.test_api backend.tests.proctoring.utils -v 2`
- [ ] Run `npm.cmd test -- src/app/pages/GroupManagement.test.tsx src/app/pages/ResultsReports.test.tsx`
- [ ] Run `npm.cmd run build`
