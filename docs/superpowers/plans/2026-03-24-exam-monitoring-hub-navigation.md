# Exam Monitoring Hub Navigation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated multi-exam monitoring hub under the Exam Management sidebar group, while keeping per-exam monitoring drill-down intact.

**Architecture:** Extend the proctoring API with a paginated exam-level monitoring summary endpoint, add a new admin route and hub page for aggregated monitoring, and refactor the admin sidebar into grouped navigation with exam submenus. Keep per-exam monitoring in `ExamDetail` unchanged except for link wiring.

**Tech Stack:** Django REST Framework, React, React Router, Vitest, pytest

---

## Chunk 1: Backend Monitoring Hub API

### Task 1: Add the monitoring hub response contract

**Files:**
- Modify: `backend/apps/proctoring/api/serializers.py`

- [ ] Add serializer classes for exam monitoring hub summary rows.
- [ ] Keep fields limited to data the frontend hub actually renders.

### Task 2: Build the monitoring hub queryset and endpoint

**Files:**
- Modify: `backend/apps/proctoring/api/views.py`
- Modify: `backend/apps/proctoring/api/urls.py`

- [ ] Add a paginated admin endpoint at `/api/v1/proctoring/exams/monitoring/`.
- [ ] Filter to `enable_proctoring=True`.
- [ ] Support `search`, `subject`, `status`, and `severity` query params.
- [ ] Annotate exam-level counts for sessions and alerts.

### Task 3: Verify backend behavior with tests

**Files:**
- Modify: `backend/tests/proctoring/test_admin_api.py`

- [ ] Add tests for list success and filtering behavior.
- [ ] Run targeted pytest for proctoring admin API.

## Chunk 2: Frontend Route and Hub Page

### Task 4: Register the new admin route

**Files:**
- Modify: `src/app/routes.ts`
- Modify: `src/app/routes.test.tsx`

- [ ] Add `/exams/monitoring`.
- [ ] Keep legacy per-exam monitor redirect behavior.
- [ ] Verify the route is registered in tests.

### Task 5: Implement the monitoring hub page

**Files:**
- Create: `src/app/pages/ExamMonitoringHub.tsx`
- Create: `src/app/pages/ExamMonitoringHub.test.tsx`

- [ ] Build the hub page with summary cards, filters, polling, and actions.
- [ ] Use the new backend endpoint plus existing subjects endpoint.
- [ ] Link row actions to `/exams/:id?tab=monitoring` and `/exams/:id`.

## Chunk 3: Sidebar Navigation and Cleanup

### Task 6: Convert Exam Management into a grouped sidebar section

**Files:**
- Modify: `src/app/components/layouts/AdminLayout.tsx`
- Modify: `src/app/i18n/resources/vi/navigation.ts`
- Modify: `src/app/i18n/resources/en/navigation.ts`

- [ ] Replace top-level Live Monitoring with an Exam Management group.
- [ ] Add submenu items for exam list and monitoring hub.
- [ ] Preserve active state for per-exam routes.

### Task 7: Remove unused temporary artifact

**Files:**
- Delete: `.tmp/updated-ui-20260322`

- [ ] Remove the unused temporary directory from the workspace.

## Chunk 4: Final Verification

### Task 8: Run focused frontend and backend verification

**Files:**
- Test: `backend/tests/proctoring/test_admin_api.py`
- Test: `src/app/routes.test.tsx`
- Test: `src/app/pages/ExamMonitoringHub.test.tsx`
- Test: `src/app/pages/ExamDetail.test.tsx`

- [ ] Run backend pytest for proctoring admin API.
- [ ] Run frontend vitest for route, hub page, and exam detail coverage.
- [ ] Review `git diff` for only intended changes.
