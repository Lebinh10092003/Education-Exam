# Frontend Permission Module Localization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize permission module labels and permission descriptions consistently across the frontend for both English and Vietnamese.

**Architecture:** Add a shared frontend utility that derives localized module labels and descriptions from permission `module` and `action`, with safe fallbacks for unknown modules or actions. Update permission-rendering UI to use that utility instead of raw backend descriptions, then lock behavior with focused tests.

**Tech Stack:** React, TypeScript, react-i18next locale input, Vitest

---

### Task 1: Shared Permission Localization Utility

**Files:**
- Create: `src/app/lib/permissionI18n.ts`
- Test: `src/app/lib/permissionI18n.test.ts`

- [ ] Add module label maps for `en` and `vi` covering seeded RBAC modules such as `audit`, `exam_periods`, `exam_rooms`, `exams`, `grading`, `groups`, `materials`, `notifications`, `permissions`, `proctoring`, `questions`, `results`, `roles`, `schools`, `subjects`, and `users`.
- [ ] Add helper functions for locale normalization, module humanization fallback, localized module labels, and localized descriptions for `view/manage`.
- [ ] Ensure unknown modules/actions fall back gracefully instead of exposing broken text.

### Task 2: Frontend Integration

**Files:**
- Modify: `src/app/pages/RolesPermissions.tsx`

- [ ] Use the current locale from `react-i18next`.
- [ ] Replace raw permission module headings and raw/fallback descriptions with shared localized values from `permissionI18n.ts`.
- [ ] Keep permission codes unchanged.

### Task 3: Verification

**Files:**
- Test: `src/app/lib/permissionI18n.test.ts`

- [ ] Run `npm.cmd test -- src/app/lib/permissionI18n.test.ts`
- [ ] Confirm EN and VI outputs for known modules plus fallback behavior for unknown modules/actions.
