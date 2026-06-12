# School Auto Resolution Import Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let CSV imports resolve schools by code or normalized name, automatically creating missing schools when a name is provided.

**Architecture:** Add one shared resolver in `apps.institutions.services` and call it from the user, exam-student, and group-membership import paths. The resolver keeps existing code-only behavior, normalizes equivalent Vietnamese school names for matching, and generates unique school codes for new schools.

**Tech Stack:** Django, Django REST Framework, pytest, Vitest/TypeScript template tests.

---

## Chunk 1: Shared Resolver and Backend Imports

### Task 1: Add backend regression tests

**Files:**
- Modify: `backend/tests/exam_authoring/test_student_import_api.py`
- Modify: `backend/tests/institutions/test_group_import_api.py`
- Modify: `backend/tests/identity/test_user_management_api.py`

- [ ] **Step 1: Add tests for exam import school auto-create and normalized reuse**

Add tests that import rows with `school` names and verify:
- a missing school is created and assigned;
- `TH Nguyen Tri Phuong`-style input reuses an existing `Tieu hoc Nguyen Tri Phuong`-style school;
- repeated equivalent names in one upload create only one school.

- [ ] **Step 2: Add tests for group membership import**

Add a test that imports a group member with a new `school` name and verifies the created profile points at the new `School`.

- [ ] **Step 3: Add tests for user import**

Add a test that imports a user with `school` and verifies the profile school is auto-created or reused.

- [ ] **Step 4: Run targeted backend tests and confirm failures**

Run:
`cd backend; pytest tests/exam_authoring/test_student_import_api.py tests/institutions/test_group_import_api.py tests/identity/test_user_management_api.py -q`

Expected: new tests fail before implementation.

### Task 2: Implement shared school resolver

**Files:**
- Modify: `backend/apps/institutions/services.py`
- Modify: `backend/apps/exam_authoring/services.py`
- Modify: `backend/apps/identity/services.py`

- [ ] **Step 1: Add helper functions in `institutions.services`**

Add helpers to:
- clean display names;
- strip Vietnamese accents;
- canonicalize common primary-school prefixes;
- generate unique uppercase school codes;
- resolve or create school from `school_code`, `school`, or `school_name`.

- [ ] **Step 2: Update group membership import**

Replace the local unknown-name error path with the shared resolver, keeping row-level errors when only an unknown code is provided.

- [ ] **Step 3: Update exam student import**

Replace `_resolve_school_by_code` with the shared resolver and pass both code and optional name columns.

- [ ] **Step 4: Update user import**

Replace inline `School.objects.filter(code__iexact=...)` logic with the shared resolver and pass name columns.

- [ ] **Step 5: Run targeted backend tests**

Run:
`cd backend; pytest tests/exam_authoring/test_student_import_api.py tests/institutions/test_group_import_api.py tests/identity/test_user_management_api.py -q`

Expected: all targeted backend tests pass.

## Chunk 2: Import Templates and Final Verification

### Task 3: Update CSV templates

**Files:**
- Modify: `src/app/lib/importTemplates.ts`
- Test: `src/app/components/imports/ImportTemplateActions.test.tsx`

- [ ] **Step 1: Update sample headers and notes**

Add `school` to relevant CSV templates and update notes to say `school_code` may use an existing code while `school` may create or reuse by normalized name.

- [ ] **Step 2: Run frontend template tests**

Run:
`npm test -- ImportTemplateActions`

Expected: tests pass.

### Task 4: Full verification, commit, deploy

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused backend test suite**

Run:
`cd backend; pytest tests/exam_authoring/test_student_import_api.py tests/institutions/test_group_import_api.py tests/identity/test_user_management_api.py -q`

Expected: all pass.

- [ ] **Step 2: Run focused frontend test**

Run:
`npm test -- ImportTemplateActions`

Expected: pass.

- [ ] **Step 3: Review git diff**

Run:
`git diff -- backend/apps/institutions/services.py backend/apps/exam_authoring/services.py backend/apps/identity/services.py backend/tests/exam_authoring/test_student_import_api.py backend/tests/institutions/test_group_import_api.py backend/tests/identity/test_user_management_api.py src/app/lib/importTemplates.ts`

Expected: only school import behavior and templates changed.

- [ ] **Step 4: Commit implementation**

Commit backend, frontend template, and plan changes with:
`git commit -m "feat: auto resolve schools during imports"`

- [ ] **Step 5: Deploy to VPS**

Run the existing VPS update path, equivalent to:
`ssh <vps> 'cd <repo-path> && bash deploy/update.sh'`

Expected: script completes migrations, restarts services, reloads Caddy, and production probes pass.
