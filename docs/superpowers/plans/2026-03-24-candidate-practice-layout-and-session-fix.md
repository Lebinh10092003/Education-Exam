# Candidate Practice Layout And Session Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unnecessary practice configuration card shell and fix candidate-shell hook ordering so practice sessions open without crashing.

**Architecture:** Fix the hook-order issue at the shared candidate layout layer, then simplify the practice catalog container without changing backend behavior. Lock the flow with a route-level regression test that navigates from the practice catalog to a practice session.

**Tech Stack:** React, TypeScript, React Router, Vitest, Testing Library, Vite

---

## Chunk 1: Layout And Practice UI

### Task 1: Fix shared candidate layout hook ordering

**Files:**
- Modify: `src/app/components/layouts/CandidateLayout.tsx`

- [ ] Remove the post-branch `useMemo` usage from the candidate layout.
- [ ] Keep the early-return fullscreen/session behavior intact while preserving consistent hook order across renders.

### Task 2: Flatten the practice catalog configuration shell

**Files:**
- Modify: `src/app/pages/PracticeExam.tsx`
- Test: `src/app/pages/PracticeExam.test.tsx`

- [ ] Replace the unnecessary configuration `Card` wrapper with a plain section container.
- [ ] Keep the configuration controls and validation behavior unchanged.
- [ ] Run existing practice catalog tests to confirm no behavior regression.

## Chunk 2: Regression Coverage

### Task 3: Add a candidate-shell navigation regression test

**Files:**
- Modify: `src/app/routes.test.tsx`
- Test: `src/app/pages/PracticeSession.test.tsx`

- [ ] Add a test that renders the protected candidate shell on `/candidate/practice`.
- [ ] Navigate into `/candidate/practice/sessions/:id` within the same shell instance.
- [ ] Verify the session route renders instead of crashing with a hook-order error.

### Task 4: Verify the fix

**Files:**
- Modify as needed only if verification reveals failures.

- [ ] Run `npm.cmd test -- src/app/pages/PracticeExam.test.tsx src/app/pages/PracticeSession.test.tsx src/app/routes.test.tsx`
- [ ] Run `npm.cmd run build`
