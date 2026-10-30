# Result Publication Workflow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add controlled result review, lock, schedule, publish, notification, and candidate pending-result visibility.

**Architecture:** Extend `Result` publication state in place, keeping grading readiness in `workflow_status`. Route all publication actions through `apps.grading.services` so auto, manual, bulk, and scheduled publication share validation, audit, and notification behavior.

**Tech Stack:** Django, DRF, pytest, React, Vitest, existing `useAsyncList`/`apiRequest` frontend patterns.

---

## Chunk 1: Backend Publication Workflow

### Task 1: Extend Result Model

**Files:**
- Modify: `backend/apps/grading/models.py`
- Create: `backend/apps/grading/migrations/0003_result_publication_workflow.py`
- Test: `backend/tests/grading/test_services.py`

- [ ] Add `reviewing`, `locked`, and `scheduled` to `Result.PublishState`.
- [ ] Add nullable fields `locked_at`, `locked_by`, `scheduled_publish_at`, and `publication_note`.
- [ ] Add a migration.
- [ ] Update tests that currently expect finalized unpublished results to be `draft`; finalized unpublished results should be `reviewing`.

### Task 2: Centralize Publication Services

**Files:**
- Modify: `backend/apps/grading/services.py`
- Test: `backend/tests/grading/test_services.py`

- [ ] Add helpers: `ensure_result_can_publish`, `lock_result`, `unlock_result`, `schedule_result_publication`, `publish_results_for_exam`, `run_scheduled_publications`.
- [ ] Make `publish_result` idempotent.
- [ ] Create candidate notification exactly once when a result first becomes published.
- [ ] Keep existing auto-publish behavior for `show_results_immediately`.
- [ ] Add tests for lock, schedule, idempotent publish, bulk publish, scheduled publish, and notification behavior.

### Task 3: Admin API

**Files:**
- Modify: `backend/apps/grading/api/serializers.py`
- Modify: `backend/apps/grading/api/views.py`
- Test: `backend/tests/grading/test_result_api.py`

- [ ] Expose new publication fields in `ResultSerializer`.
- [ ] Add action serializers for scheduling and exam bulk publish.
- [ ] Add `lock`, `unlock`, `schedule_publication`, `publish_exam`, and `run_scheduled_publications` actions.
- [ ] Extend summary with publication-state counts.
- [ ] Add API tests for the new endpoints and summary counts.

### Task 4: Candidate Pending Result API

**Files:**
- Modify: `backend/apps/exam_delivery/api/serializers.py`
- Modify: `backend/apps/exam_delivery/api/views.py`
- Test: `backend/tests/exam_delivery/test_candidate_dashboard_api.py`

- [ ] Add `CandidatePendingResultSerializer`.
- [ ] Add `pending_result_count` and `pending_results` to dashboard stats/overview.
- [ ] Ensure pending result payload does not expose score, percentage, pass/fail, or answer data.
- [ ] Add tests for pending submitted results and published-only results.

## Chunk 2: Frontend Publication UX

### Task 5: Admin Results UI

**Files:**
- Modify: `src/app/pages/ResultsReports.tsx`
- Test: `src/app/pages/ResultsReports.test.tsx`

- [ ] Extend `ResultRecord` with new fields.
- [ ] Add publication-state filter/status display.
- [ ] Add row actions for lock, unlock, schedule, publish.
- [ ] Add exam-level bulk publish action when an exam filter is selected.
- [ ] Refresh list and summary after mutations.
- [ ] Add focused UI tests for new action visibility and mutation calls.

### Task 6: Candidate Dashboard and Results UX

**Files:**
- Modify: `src/app/pages/CandidateDashboard.tsx`
- Modify: `src/app/pages/CandidateResults.tsx`
- Test: `src/app/pages/ResultDetail.test.tsx`
- Test: `src/app/pages/StudentNotifications.test.tsx` if notification action URL rendering needs coverage

- [ ] Extend dashboard types with `pending_result_count` and `pending_results`.
- [ ] Show pending result count and a compact pending list.
- [ ] Update Results empty state to mention pending unpublished results when present.
- [ ] Keep result detail route restricted to published data.
- [ ] Add frontend tests for pending dashboard/result empty states.

## Chunk 3: Verification

### Task 7: Run Targeted Tests

**Files:**
- No code changes.

- [ ] Run `cd backend && pytest tests/grading/test_services.py tests/grading/test_result_api.py tests/grading/test_candidate_results_api.py tests/exam_delivery/test_candidate_dashboard_api.py -q`.
- [ ] Run `npm test -- ResultsReports.test.tsx ResultDetail.test.tsx`.
- [ ] Run `npm run build`.
- [ ] Fix any failures in the touched areas.

