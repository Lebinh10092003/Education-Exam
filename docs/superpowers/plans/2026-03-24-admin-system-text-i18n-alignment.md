# Admin System Text I18n Alignment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure admin system text renders consistently in English for `en` and Vietnamese for `vi` without translating seeded or user-authored business content.

**Architecture:** Keep business data untouched and fix the mixed-language issue at the frontend system-text layer. Expand the legacy DOM translation bridge coverage for hardcoded admin labels and dynamic phrases, then lock behavior with targeted tests for exact and computed strings.

**Tech Stack:** React, TypeScript, react-i18next, Vitest, Testing Library

---

## Chunk 1: Legacy Translation Coverage

### Task 1: Extend exact system-text mappings

**Files:**
- Modify: `src/app/i18n/legacyUiFallback.ts`
- Test: `src/app/i18n/legacyUiFallback.test.ts`

- [ ] Add missing exact label translations for affected admin pages such as user tables, group cards, exam management, monitoring hub, periods, rooms, grading, results, roles, notifications, and audit.
- [ ] Preserve reverse translation behavior for `en` by keeping Vietnamese-to-English restoration derived from the exact map.

### Task 2: Extend dynamic phrase handling

**Files:**
- Modify: `src/app/i18n/legacyUiFallback.ts`
- Test: `src/app/i18n/legacyUiFallback.test.ts`

- [ ] Add dynamic translations for phrases such as created dates, item counts, pagination labels, schedule summaries, capacity, linked usage, and selected-count messages.
- [ ] Make sure the reverse direction (`vi` back to `en`) also works for the same dynamic phrase families.

## Chunk 2: Regression Tests

### Task 3: Add translation unit coverage

**Files:**
- Modify: `src/app/i18n/legacyUiFallback.test.ts`

- [ ] Add assertions for newly covered exact phrases from the reported admin screens.
- [ ] Add assertions for newly covered dynamic phrases in both `vi` and `en`.

### Task 4: Add bridge-level smoke coverage

**Files:**
- Modify: `src/app/components/LegacyUiTranslationBridge.test.tsx`

- [ ] Render representative hardcoded admin text and verify it flips correctly when locale changes.
- [ ] Keep existing ignore-region behavior intact.

## Chunk 3: Verification

### Task 5: Run focused frontend tests

**Files:**
- Test: `src/app/i18n/legacyUiFallback.test.ts`
- Test: `src/app/components/LegacyUiTranslationBridge.test.tsx`

- [ ] Run `npm.cmd test -- src/app/i18n/legacyUiFallback.test.ts src/app/components/LegacyUiTranslationBridge.test.tsx`
- [ ] Confirm all targeted tests pass before closing the task.
