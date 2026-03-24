# Remove ExamPeriod/ExamRoom And Align I18n Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `ExamPeriod` and `ExamRoom` from the product and codebase, keep online exam delivery driven only by `schedule_window`, and align remaining admin system text with the active EN/VI locale.

**Architecture:** Remove the backend schema and API surface for period/room instead of hiding them, then simplify exam authoring/detail flows to stop referencing deleted concepts. Finish by cleaning permission labels, navigation, demo data, and legacy UI fallback translations so the remaining exam/class flows render consistently in one language per locale.

**Tech Stack:** Django, Django REST Framework, React, TypeScript, Vite, Vitest, pytest

---

## Chunk 1: Backend Removal

### Task 1: Remove period/room schema and service wiring

**Files:**
- Modify: `backend/apps/exam_authoring/models.py`
- Modify: `backend/apps/exam_authoring/services.py`
- Modify: `backend/apps/exam_authoring/admin.py`
- Create: `backend/apps/exam_authoring/migrations/0004_remove_exam_period_room.py`
- Test: `backend/tests/exam_authoring/test_api.py`
- Test: `backend/tests/exam_authoring/test_services.py`

- [ ] Remove `ExamPeriod`, `ExamRoom`, and `Exam.period` / `Exam.room` from the model layer.
- [ ] Update create/revise/clone service paths so exams depend only on subject, schedule window, versioning, assignments, and class mode.
- [ ] Drop admin registrations and autocomplete references for deleted models/fields.
- [ ] Add a migration that removes the exam foreign keys and deletes the obsolete tables.
- [ ] Update backend tests that build or assert period/room state.

### Task 2: Remove period/room API and RBAC surface

**Files:**
- Modify: `backend/apps/exam_authoring/api/serializers.py`
- Modify: `backend/apps/exam_authoring/api/views.py`
- Modify: `backend/apps/exam_authoring/api/urls.py`
- Modify: `backend/apps/identity/bootstrap.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/identity/test_role_api.py`
- Test: `backend/tests/exam_authoring/test_period_room_api.py`

- [ ] Remove period/room serializers, summaries, viewsets, routes, and exam write/read fields.
- [ ] Remove `exam_periods.*` and `exam_rooms.*` permissions from RBAC seed data and test fixtures.
- [ ] Delete or rewrite tests dedicated to period/room endpoints and permission exposure.

### Task 3: Clean seed data and reset expectations

**Files:**
- Modify: `backend/apps/platform_core/demo_seed.py`
- Modify: `backend/tests/identity/test_reset_demo_data_command.py`

- [ ] Remove demo seed creation and usage of periods/rooms.
- [ ] Update reset-demo assertions to reflect the slimmer schema.

## Chunk 2: Frontend Removal

### Task 4: Remove pages, routes, and navigation

**Files:**
- Modify: `src/app/routes.ts`
- Modify: `src/app/routes.test.tsx`
- Modify: `src/app/components/layouts/AdminLayout.tsx`
- Delete: `src/app/pages/ExamPeriods.tsx`
- Delete: `src/app/pages/ExamRooms.tsx`

- [ ] Remove lazy routes and route entries for exam periods/rooms.
- [ ] Remove admin sidebar entries for exam periods/rooms.
- [ ] Delete the now-orphaned admin pages and route tests that depend on them.

### Task 5: Simplify exam create/detail flows

**Files:**
- Modify: `src/app/pages/ExamCreationWizard.tsx`
- Modify: `src/app/pages/ExamCreationWizard.test.tsx`
- Modify: `src/app/pages/ExamDetail.tsx`
- Modify: `src/app/pages/ExamDetail.test.tsx`
- Modify: `src/app/pages/ExamManagement.tsx`
- Modify: `src/app/pages/ExamAssignment.tsx`
- Modify: `src/app/pages/ManualGrading.tsx`
- Modify: `src/app/pages/ResultsReports.tsx`

- [ ] Remove period/room types, fetches, form fields, payload fields, and detail cards.
- [ ] Ensure exam/class flows still show scheduling through `schedule_window`.
- [ ] Update mocks and expectations in page tests.

### Task 6: Remove obsolete permission/module labels

**Files:**
- Modify: `src/app/lib/permissionI18n.ts`
- Modify: `src/app/lib/permissionI18n.test.ts`

- [ ] Remove `exam_periods` and `exam_rooms` module labels from frontend permission localization.
- [ ] Update permission localization tests accordingly.

## Chunk 3: I18n And Verification

### Task 7: Sweep remaining mixed-language admin strings

**Files:**
- Modify: `src/app/i18n/legacyUiFallback.ts`
- Modify: `src/app/i18n/legacyUiFallback.test.ts`
- Modify: `src/app/components/LegacyUiTranslationBridge.test.tsx`

- [ ] Remove obsolete period/room translations.
- [ ] Add or adjust fallback translations for remaining exam/class/monitoring strings exposed by the simplified flows.
- [ ] Keep dynamic date-token translation for mixed hard-coded strings that still rely on the legacy bridge.

### Task 8: Verify end-to-end

**Files:**
- Modify as needed based on failures only.

- [ ] Run targeted pytest for exam authoring, identity seed/reset, and any failures introduced by the schema removal.
- [ ] Run targeted Vitest for updated exam/permission/i18n tests.
- [ ] Run frontend build.
- [ ] Run Django migrations locally and note data-destructive impact in the final report.
