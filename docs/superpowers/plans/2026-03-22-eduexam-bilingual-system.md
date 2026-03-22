# EduExam Bilingual System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full Vietnamese/English support across frontend UI, backend API messages, and forgot/reset-password email flow, with Vietnamese as the default language and locale stored locally per device.

**Architecture:** Frontend uses `react-i18next` with namespace-based resources and a shared language switcher. Backend uses Django i18n with `LocaleMiddleware`, translation catalogs, and password reset endpoints/templates that honor `Accept-Language`.

**Tech Stack:** Vite, React, TypeScript, Vitest, Django, DRF, Django i18n/gettext, Django auth tokens/email templates.

---

## Chunk 1: Frontend Locale Foundation

### Task 1: Add frontend i18n dependencies and bootstrap

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/app/i18n/index.ts`
- Create: `src/app/i18n/resources/vi/common.ts`
- Create: `src/app/i18n/resources/en/common.ts`
- Create: `src/app/i18n/resources/vi/auth.ts`
- Create: `src/app/i18n/resources/en/auth.ts`
- Create: `src/app/i18n/resources/vi/navigation.ts`
- Create: `src/app/i18n/resources/en/navigation.ts`
- Create: `src/app/i18n/resources/vi/profile.ts`
- Create: `src/app/i18n/resources/en/profile.ts`
- Modify: `src/main.tsx`

- [ ] Add `i18next`, `react-i18next`, and `i18next-browser-languagedetector`.
- [ ] Create i18n bootstrap with default locale `vi`, fallback locale `vi`, and namespace registration.
- [ ] Make bootstrap initialize before React render in `src/main.tsx`.
- [ ] Keep resource structure namespace-based so later domains can extend without central bloat.
- [ ] Run frontend type/build verification for bootstrap wiring.

### Task 2: Add locale storage helpers and header propagation

**Files:**
- Modify: `src/app/lib/storage.ts`
- Modify: `src/app/lib/http.ts`
- Test: `src/test/setup.ts`
- Create: `src/app/lib/http.test.ts` if needed

- [ ] Add helpers to read/write the selected locale from local storage.
- [ ] Update `apiRequest` and refresh-token requests to always send `Accept-Language`.
- [ ] Ensure locale header works for authenticated and unauthenticated requests.
- [ ] Add or update tests to verify the header is attached correctly.

### Task 3: Add shared language switcher UI

**Files:**
- Create: `src/app/components/LanguageSwitcher.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/pages/Login.tsx`
- Modify: `src/app/pages/ForgotPassword.tsx`
- Modify: `src/app/components/layouts/AdminLayout.tsx`
- Modify: `src/app/components/layouts/CandidateLayout.tsx`

- [ ] Build a reusable `LanguageSwitcher` component backed by `react-i18next`.
- [ ] Place the switcher on login, forgot-password, admin header, and candidate header.
- [ ] Translate the shared auth and navigation text those surfaces own.
- [ ] Preserve existing auth/logout/navigation behavior while replacing hardcoded text.

## Chunk 2: Backend Locale Plumbing

### Task 4: Enable Django locale support

**Files:**
- Modify: `backend/config/settings/base.py`
- Create: `backend/locale/vi/LC_MESSAGES/django.po`
- Create: `backend/locale/en/LC_MESSAGES/django.po`
- Modify: `backend/.env.example`
- Modify: `README.md`

- [ ] Switch default backend language to `vi`.
- [ ] Add `LANGUAGES`, `LOCALE_PATHS`, and `LocaleMiddleware`.
- [ ] Document locale behavior and any new env vars needed for email reset URLs.
- [ ] Seed translation catalogs with the first batch of system messages.

### Task 5: Translate backend auth and common validation messages

**Files:**
- Modify: `backend/apps/identity/api/serializers.py`
- Modify: `backend/apps/identity/api/views.py`
- Modify: `backend/apps/exam_delivery/services.py`
- Modify: `backend/apps/grading/services.py`
- Modify: `backend/apps/exam_authoring/api/serializers.py`
- Modify: `backend/apps/question_bank/api/serializers.py`
- Modify: `backend/apps/proctoring/api/serializers.py`
- Modify: `backend/apps/proctoring/services.py`
- Modify: `backend/apps/platform_core/api/views.py`
- Modify: `backend/apps/institutions/api/views.py` if self-action or import messages need translation

- [ ] Convert hardcoded system messages to `gettext`/`gettext_lazy`.
- [ ] Preserve payload shapes and field keys.
- [ ] Prioritize auth, self-lock guards, exam delivery, grading, authoring, question bank, and proctoring messages.
- [ ] Add/refresh translation entries for both `vi` and `en`.

## Chunk 3: Forgot/Reset Password End-to-End

### Task 6: Add backend reset-password endpoints and email sending

**Files:**
- Modify: `backend/apps/identity/api/urls.py`
- Modify: `backend/apps/identity/api/views.py`
- Modify: `backend/apps/identity/api/serializers.py`
- Create: `backend/apps/identity/services.py` if reset logic needs separation
- Create: `backend/apps/identity/templates/emails/password_reset_subject.vi.txt`
- Create: `backend/apps/identity/templates/emails/password_reset_subject.en.txt`
- Create: `backend/apps/identity/templates/emails/password_reset_body.vi.txt`
- Create: `backend/apps/identity/templates/emails/password_reset_body.en.txt`
- Modify: `backend/config/settings/base.py`
- Test: `backend/tests/identity/`

- [ ] Add a secure forgot-password flow using Django token primitives.
- [ ] Keep forgot-password response generic regardless of whether the email exists.
- [ ] Add reset-password endpoint that validates uid/token and updates password.
- [ ] Add email sender configuration and bilingual email templates.
- [ ] Add backend tests for `vi` and `en` forgot/reset-password flows.

### Task 7: Add frontend reset-password page and auth translations

**Files:**
- Modify: `src/app/routes.ts`
- Create: `src/app/pages/ResetPassword.tsx`
- Modify: `src/app/pages/ForgotPassword.tsx`
- Modify: `src/app/pages/Login.tsx`
- Modify: `src/app/auth/AuthContext.tsx`
- Modify: `src/app/components/auth/ProtectedRoute.tsx` if route guards need copy changes
- Add resources under `src/app/i18n/resources/vi/auth.ts`
- Add resources under `src/app/i18n/resources/en/auth.ts`
- Test: `src/app/routes.test.tsx`

- [ ] Add frontend reset-password route and page.
- [ ] Translate login, forgot-password, reset-password, auth toasts, and session-ended copy.
- [ ] Keep existing default candidate/admin routing behavior intact.
- [ ] Extend route tests for the new reset-password route if needed.

## Chunk 4: Shared UI and High-Traffic Pages

### Task 8: Translate layouts, shared UI, and notifications/toasts

**Files:**
- Modify: `src/app/components/layouts/AdminLayout.tsx`
- Modify: `src/app/components/layouts/CandidateLayout.tsx`
- Modify: `src/app/components/RouteContentLoader.tsx`
- Modify: `src/app/components/StatusBadge.tsx`
- Modify: `src/app/lib/notify.ts`
- Modify: `src/app/lib/notifications.ts`
- Add resource files for `common`, `navigation`, `notifications`, `candidate`, `profile`

- [ ] Translate top-level navigation, headers, search placeholders, profile dropdown, and shared loading/empty-state copy.
- [ ] Keep labels consistent between nav items and page headings.
- [ ] Translate notification-related frontend success/info/error messages owned by the UI.

### Task 9: Translate priority pages with the most visible system copy

**Files:**
- Modify: `src/app/pages/Dashboard.tsx`
- Modify: `src/app/pages/CandidateDashboard.tsx`
- Modify: `src/app/pages/NotificationCenter.tsx`
- Modify: `src/app/pages/AuditCenter.tsx`
- Modify: `src/app/pages/Profile.tsx`
- Modify: `src/app/pages/UserManagement.tsx`
- Modify: `src/app/pages/GroupManagement.tsx`
- Modify: `src/app/pages/ExamManagement.tsx`
- Modify: `src/app/pages/ManualGrading.tsx`
- Modify: `src/app/pages/ExamDetail.tsx`
- Modify: `src/app/pages/CandidateResults.tsx`
- Modify: `src/app/pages/CandidateMaterials.tsx`

- [ ] Replace hardcoded page-owned strings with translation keys.
- [ ] Leave user-authored business data untouched.
- [ ] Focus on the highest-traffic or most visible pages first, following the shared translation structure created earlier.

## Chunk 5: Verification and Developer Workflow

### Task 10: Verify frontend, backend, and translation behavior

**Files:**
- Test: `src/app/routes.test.tsx`
- Test: any new frontend i18n or HTTP tests
- Test: `backend/tests/identity/`
- Test: focused backend suites impacted by translated messages
- Modify: `README.md` if reset-password or locale setup changes local workflow

- [ ] Run frontend tests covering routing and i18n header behavior.
- [ ] Run frontend build to catch resource/bootstrap issues.
- [ ] Run backend identity tests for forgot/reset-password and locale behavior.
- [ ] Run focused backend tests for affected services with translated messages.
- [ ] Update README only if new setup steps are required.
