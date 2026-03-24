# Dark Mode Harmony Refresh Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dark mode easier on the eyes and visually coherent across the candidate and admin experiences without rewriting every page in one pass.

**Architecture:** Refresh the dark palette tokens in `src/styles/theme.css`, then align the highest-impact shared layouts/components with semantic dark surfaces. Keep a compatibility layer for legacy light utility classes, but tune it to the new palette so page-level hard-coded classes render more harmoniously while gradual cleanup continues.

**Tech Stack:** React, Vite, Tailwind v4 theme tokens, shared layout/components, Vitest

---

## Chunk 1: Global Dark Palette

### Task 1: Rebuild dark palette tokens and compatibility colors

**Files:**
- Modify: `src/styles/theme.css`

- [ ] **Step 1: Define the new dark palette**
- [ ] **Step 2: Update core dark tokens for background, card, popover, accent, border, input, sidebar**
- [ ] **Step 3: Tune compatibility-layer legacy surface/text/status colors to the same palette**
- [ ] **Step 4: Add missing dark mappings for common hard-coded slate/gray utility combinations used across the app**
- [ ] **Step 5: Visually preserve brand blue and system status colors with lower glare**

## Chunk 2: Shared Shell and Components

### Task 2: Align shared layouts with the new dark hierarchy

**Files:**
- Modify: `src/app/components/layouts/AdminLayout.tsx`
- Modify: `src/app/components/layouts/CandidateLayout.tsx`
- Modify: `src/app/components/PageHeader.tsx`
- Modify: `src/app/components/RouteContentLoader.tsx`
- Modify: `src/app/components/StatCard.tsx`

- [ ] **Step 1: Replace harsh light-only classes with semantic or explicit dark-safe surfaces**
- [ ] **Step 2: Differentiate page background, shell background, nav hover, active nav, and topbar surfaces**
- [ ] **Step 3: Normalize text hierarchy and muted text colors**
- [ ] **Step 4: Soften borders and active badges in dark mode**

## Chunk 3: Page-Level Hotspots

### Task 3: Spot-fix the most visible pages still using bright cards or harsh borders

**Files:**
- Modify: `src/app/pages/CandidateDashboard.tsx`
- Modify: `src/app/pages/CandidateMaterials.tsx`
- Modify: `src/app/pages/PracticeExam.tsx`
- Modify: `src/app/pages/TakeExam.tsx`
- Modify: `src/app/pages/ExamInstructions.tsx`
- Modify: `src/app/pages/ExamManagement.tsx`
- Modify: `src/app/pages/QuestionBank.tsx`
- Modify: `src/app/pages/ManualGrading.tsx`
- Modify: `src/app/pages/ExamMonitoringHub.tsx`

- [ ] **Step 1: Remove the brightest light-only wrappers and surfaces visible in dark mode**
- [ ] **Step 2: Make cards, tables, empty states, and preview panels share the same dark hierarchy**
- [ ] **Step 3: Ensure alerts and status blocks use toned-down dark variants**

## Chunk 4: Verification

### Task 4: Validate the sweep

**Files:**
- Test: `src/app/pages/StudentShell.test.tsx`
- Test: `src/app/pages/CandidateMaterials.test.tsx`
- Test: `src/app/pages/MyExams.test.tsx`
- Test: `src/app/pages/TakeExam.test.tsx`

- [ ] **Step 1: Run targeted candidate/admin shell and page tests**
- [ ] **Step 2: Run full production build**
- [ ] **Step 3: Review remaining grep hotspots for future cleanup**
