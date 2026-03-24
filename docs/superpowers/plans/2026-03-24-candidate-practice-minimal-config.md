# Candidate Practice Minimal Config Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove manual practice question and duration controls so candidates only choose a subject before starting a backend-generated random practice session.

**Architecture:** Simplify the practice page state and validation logic to match the backend contract. The UI becomes descriptive instead of configurable, and the create-session request shrinks to a subject-only payload.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Vite

---

## Chunk 1: Practice Page Simplification

### Task 1: Remove manual practice configuration controls

**Files:**
- Modify: `src/app/pages/PracticeExam.tsx`

- [ ] Remove duration and difficulty-count state from the page.
- [ ] Remove the related form controls and validation messages.
- [ ] Replace them with static copy that describes backend-generated random practice behavior.
- [ ] Send only `subject_id` when creating a practice session.

### Task 2: Update regression coverage

**Files:**
- Modify: `src/app/pages/PracticeExam.test.tsx`

- [ ] Remove interactions with deleted controls from the test.
- [ ] Assert that session creation only posts `subject_id`.

### Task 3: Verify the change

**Files:**
- Modify as needed only if verification reveals failures.

- [ ] Run `npm.cmd test -- src/app/pages/PracticeExam.test.tsx`
- [ ] Run `npm.cmd run build`
