# Student Read-Only Profile And Hidden Email Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent candidate/student accounts from editing imported registration details and hide internal email values from the student-facing UI.

**Architecture:** Keep the current auth model unchanged, including internal placeholder emails for imported students, but treat those emails as backend-only for candidate/student self-service. Enforce read-only behavior at the `/api/v1/profile/` boundary and align the student shell/profile UI to remove editable fields and email display.

**Tech Stack:** Django REST Framework, React, react-router, react-i18next, Vitest, pytest

---

## Chunk 1: Backend Self-Service Guard

### Task 1: Lock profile updates for candidate/student self-service

**Files:**
- Modify: `backend/apps/identity/utils.py`
- Modify: `backend/apps/identity/api/views.py`
- Modify: `backend/apps/identity/api/serializers.py`
- Test: `backend/tests/identity/test_profile_api.py`

- [ ] Add a shared helper that detects self-service student/candidate accounts without staff roles.
- [ ] Make `ProfileView.update()` return a translated error for locked self-service profiles.
- [ ] Make `ProfileSerializer` return `email=""` for the current student/candidate self-profile response.
- [ ] Add pytest coverage for blocked updates and hidden email in the self-profile payload.

## Chunk 2: Student UI Read-Only Profile

### Task 2: Remove editable personal fields and hide email in candidate-facing UI

**Files:**
- Modify: `src/app/pages/StudentProfile.tsx`
- Modify: `src/app/components/layouts/CandidateLayout.tsx`
- Modify: `src/app/i18n/resources/en/profile.ts`
- Modify: `src/app/i18n/resources/vi/profile.ts`
- Test: `src/app/pages/StudentProfile.test.tsx`
- Test: `src/app/pages/StudentShell.test.tsx`

- [ ] Remove the profile edit mutation and save button from the student profile page.
- [ ] Render imported account details as read-only fields/cards only.
- [ ] Remove all student-facing email text from the student profile page and candidate shell header/footer blocks.
- [ ] Keep password change and local system settings active.
- [ ] Update tests to verify the student UI no longer shows email or profile edit actions.

## Chunk 3: Verification

### Task 3: Run targeted backend and frontend verification

**Files:**
- Test: `backend/tests/identity/test_profile_api.py`
- Test: `src/app/pages/StudentProfile.test.tsx`
- Test: `src/app/pages/StudentShell.test.tsx`

- [ ] Run `.\.venv\Scripts\python.exe -m pytest tests/identity/test_profile_api.py` inside `backend`.
- [ ] Run `npm.cmd test -- src/app/pages/StudentProfile.test.tsx src/app/pages/StudentShell.test.tsx`.
- [ ] Run `npm.cmd run build`.
