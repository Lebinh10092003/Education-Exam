# Exam/Class Learning Access Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Exam.mode = exam | class`, scope learner-facing materials/practice by assigned subjects, and convert practice into backend-randomized temporary sessions with 15-day detail retention.

**Architecture:** Extend the existing exam domain instead of inventing a parallel classroom model. Real exams remain under `mode=exam`, while `mode=class` reuses assignment/import pipelines for learning access. Candidate-facing practice/material APIs consume a shared subject-access query, and practice detail storage is purged by scheduled retention while summaries remain available.

**Tech Stack:** Django, Django REST Framework, Celery beat/tasks, React, Vite, React Router, Testing Library, pytest

---

## Chunk 1: Backend Domain And Access

### Task 1: Add exam mode at the data model level

**Files:**
- Modify: `backend/apps/exam_authoring/models.py`
- Create: `backend/apps/exam_authoring/migrations/<timestamp>_add_exam_mode.py`
- Test: `backend/tests/exam_authoring/test_models.py`

- [ ] Add `Exam.Mode` choices with `exam` default and `class`
- [ ] Create a migration that backfills existing rows to `exam`
- [ ] Add a model test that confirms the default mode is `exam`

### Task 2: Expose exam mode through authoring APIs

**Files:**
- Modify: `backend/apps/exam_authoring/api/serializers.py`
- Modify: `backend/apps/exam_authoring/api/views.py`
- Test: `backend/tests/exam_authoring/test_api.py`

- [ ] Add `mode` to read/write serializers
- [ ] Add `mode` filtering support in exam list views if needed for admin UI
- [ ] Add API tests for creating and updating `class` records

### Task 3: Centralize assigned subject access resolution

**Files:**
- Modify: `backend/apps/exam_delivery/api/views.py`
- Modify: `backend/apps/materials/api/views.py`
- Modify: `backend/apps/practice/api/views.py`
- Modify: `backend/apps/practice/services.py`
- Test: `backend/tests/exam_delivery/test_candidate_dashboard_api.py`
- Test: `backend/tests/practice/test_api.py`
- Test: `backend/tests/materials/<new test file if needed>.py`

- [ ] Introduce a shared query/helper that returns subjects from assigned `exam` and `class` rows
- [ ] Restrict candidate exam list and dashboard upcoming exams to `mode=exam`
- [ ] Restrict candidate materials and practice catalog to accessible subjects only
- [ ] Add tests for union access across `exam` and `class`

## Chunk 2: Practice Session Behavior

### Task 4: Replace manual practice configuration with subject-only creation

**Files:**
- Modify: `backend/apps/practice/api/serializers.py`
- Modify: `backend/apps/practice/api/views.py`
- Modify: `backend/apps/practice/services.py`
- Test: `backend/tests/practice/test_services.py`
- Test: `backend/tests/practice/test_api.py`

- [ ] Change create payload from `{subject_id, duration_minutes, difficulty_counts}` to `{subject_id}`
- [ ] Make practice creation randomize up to 30 objective questions from the selected subject
- [ ] Derive duration from question count in the service layer
- [ ] Reuse an in-progress session for the same subject instead of creating duplicates
- [ ] Add tests for the 30-question cap and fallback-to-available behavior

### Task 5: Convert review into summary-first retention-aware output

**Files:**
- Modify: `backend/apps/practice/models.py`
- Create: `backend/apps/practice/migrations/<timestamp>_add_retention_fields.py`
- Modify: `backend/apps/practice/api/serializers.py`
- Modify: `backend/apps/practice/api/views.py`
- Test: `backend/tests/practice/test_api.py`

- [ ] Add retention fields to `PracticeSession`
- [ ] Populate `details_retention_until` on submit
- [ ] Make the review endpoint return summary even after details are purged
- [ ] Hide question-level review data from candidate-facing review responses
- [ ] Add tests for summary availability before and after purge

### Task 6: Add scheduled cleanup for expired practice details

**Files:**
- Create: `backend/apps/practice/retention.py`
- Create: `backend/apps/practice/tasks.py`
- Create: `backend/apps/practice/management/commands/cleanup_expired_practice_details.py`
- Modify: `backend/config/settings/base.py`
- Test: `backend/tests/practice/<new retention test file>.py`

- [ ] Implement detail purge that deletes questions and autosaves while preserving session summaries
- [ ] Wire a Celery task and beat schedule similar to proctoring retention
- [ ] Add a management command for manual cleanup
- [ ] Add retention tests around the 15-day cutoff

## Chunk 3: Admin Frontend

### Task 7: Surface exam/class mode in admin exam flows

**Files:**
- Modify: `src/app/pages/ExamManagement.tsx`
- Modify: `src/app/pages/ExamCreationWizard.tsx`
- Modify: `src/app/pages/ExamDetail.tsx`
- Modify: `src/app/pages/ExamAssignment.tsx`
- Modify: `src/app/i18n/legacyUiFallback.ts`
- Test: `src/app/pages/ExamManagement.test.tsx`
- Test: `src/app/pages/ExamCreationWizard.test.tsx`

- [ ] Add mode labels and controls where exams are listed/edited
- [ ] Adjust copy in assignment/import screens to work for both real exams and classes
- [ ] Ensure `class` is visually distinct from `exam`
- [ ] Add regression tests for rendering/storing mode

## Chunk 4: Candidate Frontend

### Task 8: Redesign practice landing page around accessible subjects

**Files:**
- Modify: `src/app/pages/PracticeExam.tsx`
- Modify: `src/app/pages/practiceShared.ts`
- Test: `src/app/pages/PracticeExam.test.tsx`

- [ ] Remove manual difficulty and duration inputs
- [ ] Render only accessible subject cards
- [ ] Show `Start Practice` vs `Resume` based on in-progress sessions
- [ ] Align page layout with the standard candidate shell
- [ ] Add tests for the new subject-card flow

### Task 9: Update practice session completion and history UI

**Files:**
- Modify: `src/app/pages/PracticeSession.tsx`
- Modify: `src/app/pages/PracticeReview.tsx`
- Test: `src/app/pages/PracticeSession.test.tsx`
- Test: `src/app/pages/PracticeReview.test.tsx`

- [ ] Keep the focused workspace for active sessions
- [ ] Change the completion route to a summary-first experience
- [ ] Show the completion notice and retention note when details are no longer available
- [ ] Add tests for summary rendering and no-detail states

### Task 10: Restrict candidate materials and dashboard summaries

**Files:**
- Modify: `src/app/pages/CandidateMaterials.tsx`
- Modify: `src/app/pages/CandidateDashboard.tsx`
- Test: `src/app/pages/CandidateMaterials.test.tsx`
- Test: `src/app/pages/CandidateDashboard.test.tsx`

- [ ] Ensure materials UI only renders accessible subjects returned by the API
- [ ] Update learner copy to cover both exam candidates and students
- [ ] Verify dashboard counts and recent materials reflect the restricted dataset

## Chunk 5: Verification

### Task 11: Run targeted backend verification

**Files:**
- Test only

- [ ] Run focused pytest suites for exam authoring, exam delivery, materials, and practice
- [ ] Run the new practice retention command test
- [ ] Apply migrations locally

### Task 12: Run targeted frontend verification

**Files:**
- Test only

- [ ] Run focused Vitest/RTL suites for practice, exam admin, materials, and dashboard pages
- [ ] Run `npm.cmd run build`
