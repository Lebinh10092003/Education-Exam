# Candidate Area Zip Alignment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the student-facing area to align with the zip-provided UI while preserving current working candidate routes and using existing backend APIs wherever possible.

**Architecture:** Implement the candidate redesign in compatibility-first layers. Start with routing and shell updates, then rebuild data-backed pages around existing candidate APIs, then add the lightweight pages that depend on auth state or controlled fallback states. Keep `TakeExam` intact as the live exam-taking route and avoid backend scope unless a blocking gap appears.

**Tech Stack:** React, TypeScript, React Router, Vitest, Testing Library, Vite, existing `apiRequest` and `useAsyncList` hooks

---

## File Map

- Modify: `src/app/routes.ts`
- Modify: `src/app/routes.test.tsx`
- Modify: `src/app/components/layouts/CandidateLayout.tsx`
- Modify: `src/app/pages/CandidateDashboard.tsx`
- Modify: `src/app/pages/PracticeExam.tsx`
- Modify: `src/app/pages/CandidateResults.tsx`
- Modify: `src/app/pages/CandidateMaterials.tsx`
- Create: `src/app/pages/MyExams.tsx`
- Create: `src/app/pages/ExamInstructions.tsx`
- Create: `src/app/pages/StudentNotifications.tsx`
- Create: `src/app/pages/StudentProfile.tsx`
- Create: `src/app/pages/StudentHelp.tsx`
- Create: `src/app/pages/candidateExamShared.ts`
- Create: `src/app/pages/MyExams.test.tsx`
- Create: `src/app/pages/StudentShell.test.tsx`
- Modify: `docs/superpowers/plans/2026-03-23-candidate-area-zip-alignment.md`

## Chunk 1: Candidate Routes And Shell

### Task 1: Add failing route and shell tests

**Files:**
- Modify: `src/app/routes.test.tsx`
- Create: `src/app/pages/StudentShell.test.tsx`

- [ ] **Step 1: Extend route tests for new candidate routes**

```tsx
expect(matchRoutes(routeConfig, "/candidate/exams")).toBeTruthy();
expect(matchRoutes(routeConfig, "/candidate/exams/42/instructions")).toBeTruthy();
expect(matchRoutes(routeConfig, "/candidate/notifications")).toBeTruthy();
expect(matchRoutes(routeConfig, "/candidate/profile")).toBeTruthy();
expect(matchRoutes(routeConfig, "/candidate/help")).toBeTruthy();
```

- [ ] **Step 2: Add a candidate shell render test for the new navigation model**

```tsx
expect(await screen.findByText("My Exams")).toBeInTheDocument();
expect(screen.getByText("Notifications")).toBeInTheDocument();
expect(screen.getByText("Help")).toBeInTheDocument();
```

- [ ] **Step 3: Run the route and shell tests to verify failure**

Run: `npm.cmd test -- src/app/routes.test.tsx src/app/pages/StudentShell.test.tsx`
Expected: FAIL because the new routes and shell links do not exist yet.

### Task 2: Implement candidate route registration and shell alignment

**Files:**
- Modify: `src/app/routes.ts`
- Modify: `src/app/components/layouts/CandidateLayout.tsx`

- [ ] **Step 1: Register lazy routes for the new candidate pages**

```ts
const MyExamsRoute = lazyRoute(() => import("./pages/MyExams"), "MyExams");
const ExamInstructionsRoute = lazyRoute(() => import("./pages/ExamInstructions"), "ExamInstructions");
```

- [ ] **Step 2: Add the new candidate child routes while keeping old routes intact**

```ts
{ path: "exams", Component: MyExamsRoute },
{ path: "exams/:id/instructions", Component: ExamInstructionsRoute },
{ path: "notifications", Component: StudentNotificationsRoute },
{ path: "profile", Component: StudentProfileRoute },
{ path: "help", Component: StudentHelpRoute },
```

- [ ] **Step 3: Rebuild `CandidateLayout` around the zip-aligned navigation**

```tsx
const navItems = [
  { path: "/candidate", label: "Dashboard", ... },
  { path: "/candidate/exams", label: "My Exams", ... },
  ...
];
```

- [ ] **Step 4: Keep the special-case exam-taking bypass for `/candidate/exam/:id`**

```tsx
if (location.pathname.startsWith("/candidate/exam/")) { ... }
```

- [ ] **Step 5: Wire logout and real profile data into the new shell**

```tsx
const { logout, profile } = useAuth();
```

- [ ] **Step 6: Re-run the route and shell tests**

Run: `npm.cmd test -- src/app/routes.test.tsx src/app/pages/StudentShell.test.tsx`
Expected: PASS

## Chunk 2: Dashboard, My Exams, And Instructions

### Task 3: Add failing test coverage for the new exam list flow

**Files:**
- Create: `src/app/pages/MyExams.test.tsx`

- [ ] **Step 1: Add a failing test for rendering `/api/v1/my-exams/` results in the new `MyExams` page**

```tsx
expect(await screen.findByText("Mathematics Final Exam")).toBeInTheDocument();
expect(screen.getByRole("link", { name: /view details/i })).toHaveAttribute("href", "/candidate/exams/1/instructions");
```

- [ ] **Step 2: Add a failing test for the instructions page fallback logic**

```tsx
expect(await screen.findByText(/Start Exam/i)).toBeInTheDocument();
```

- [ ] **Step 3: Run the new exam-list test file to verify failure**

Run: `npm.cmd test -- src/app/pages/MyExams.test.tsx`
Expected: FAIL because the pages do not exist yet.

### Task 4: Implement shared candidate exam shape helpers

**Files:**
- Create: `src/app/pages/candidateExamShared.ts`

- [ ] **Step 1: Add a shared `CandidateAssignedExam` type for dashboard, exam list, and instructions**

```ts
export interface CandidateAssignedExam { ... }
```

- [ ] **Step 2: Add shared formatting helpers for schedule and attempt state**

```ts
export const formatExamSchedule = (...) => ...
export const getExamAvailabilityState = (...) => ...
```

- [ ] **Step 3: Keep helpers small and focused so pages do not duplicate exam CTA logic**

```ts
export const canLaunchExam = (...) => ...
```

### Task 5: Rebuild dashboard and add the new exam list pages

**Files:**
- Modify: `src/app/pages/CandidateDashboard.tsx`
- Create: `src/app/pages/MyExams.tsx`
- Create: `src/app/pages/ExamInstructions.tsx`

- [ ] **Step 1: Rebuild `CandidateDashboard` with the zip layout using `/api/v1/my-dashboard/overview/`**

```tsx
const dashboard = useAsyncList(() => apiRequest(..."/api/v1/my-dashboard/overview/"), []);
```

- [ ] **Step 2: Add CTA links from dashboard into `/candidate/exams`, `/candidate/results`, `/candidate/materials`, and `/candidate/practice`**

```tsx
<Link to="/candidate/exams">...</Link>
```

- [ ] **Step 3: Create `MyExams.tsx` using `/api/v1/my-exams/` with zip-aligned filtering and cards/table**

```tsx
const examsList = useAsyncList(() => apiRequest(..."/api/v1/my-exams/"), []);
```

- [ ] **Step 4: Route available exams to `/candidate/exams/:id/instructions` and keep resume/start behavior consistent**

```tsx
<Link to={`/candidate/exams/${exam.id}/instructions`} state={{ exam }}>...</Link>
```

- [ ] **Step 5: Create `ExamInstructions.tsx` with route-state-first and fetch-list fallback loading**

```tsx
const locationExam = location.state?.exam;
```

- [ ] **Step 6: Keep the final CTA in instructions pointing to `/candidate/exam/:id`**

```tsx
<Link to={`/candidate/exam/${exam.id}`}>Start Exam</Link>
```

- [ ] **Step 7: Re-run the exam-list and instruction tests**

Run: `npm.cmd test -- src/app/pages/MyExams.test.tsx`
Expected: PASS

## Chunk 3: Results, Materials, And Practice Alignment

### Task 6: Restyle the existing data-backed candidate pages

**Files:**
- Modify: `src/app/pages/CandidateResults.tsx`
- Modify: `src/app/pages/CandidateMaterials.tsx`
- Modify: `src/app/pages/PracticeExam.tsx`

- [ ] **Step 1: Update `CandidateResults` to align with the zip hierarchy while preserving `/api/v1/my-results/`**

```tsx
title="My Results"
```

- [ ] **Step 2: Keep charts and list data fully real, but make row actions compatible with either sheet detail or route detail**

```tsx
<Button size="sm" variant="outline">View</Button>
```

- [ ] **Step 3: Update `CandidateMaterials` to match the zip's grid/list resource library pattern using `/api/v1/my-materials/`**

```tsx
<Tabs defaultValue="grid">...</Tabs>
```

- [ ] **Step 4: Reframe `PracticeExam` as a candidate practice hub without inventing a fake backend-only domain**

```tsx
description="Practice and assigned exam preparation..."
```

- [ ] **Step 5: Keep current real exam-launching behavior where the backend already supports it**

```tsx
<Link to={`/candidate/exam/${exam.id}`}>...</Link>
```

- [ ] **Step 6: Run the existing candidate route tests plus build to catch regressions**

Run: `npm.cmd test -- src/app/routes.test.tsx`
Expected: PASS

## Chunk 4: Notifications, Profile, Help, And Verification

### Task 7: Create lightweight pages for the remaining candidate area

**Files:**
- Create: `src/app/pages/StudentNotifications.tsx`
- Create: `src/app/pages/StudentProfile.tsx`
- Create: `src/app/pages/StudentHelp.tsx`

- [ ] **Step 1: Create `StudentNotifications.tsx` with API-first but safe empty-state behavior**

```tsx
export function StudentNotifications() { ... }
```

- [ ] **Step 2: Create `StudentProfile.tsx` using auth/profile data already available in the frontend**

```tsx
const { profile } = useAuth();
```

- [ ] **Step 3: Create `StudentHelp.tsx` as a static candidate support page**

```tsx
export function StudentHelp() { ... }
```

- [ ] **Step 4: Make the pages visually consistent with the zip candidate area**

```tsx
<Card>...</Card>
```

### Task 8: Run focused verification and inspect final file set

**Files:**
- No new files

- [ ] **Step 1: Run route and candidate shell tests**

Run: `npm.cmd test -- src/app/routes.test.tsx src/app/pages/StudentShell.test.tsx src/app/pages/MyExams.test.tsx`
Expected: PASS

- [ ] **Step 2: Run any candidate page tests added during implementation**

Run: `npm.cmd test -- src/app/pages/*.test.tsx src/app/lib/questionImportValidation.test.ts`
Expected: PASS for the files touched or relevant to this work

- [ ] **Step 3: Run the frontend build**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 4: Inspect the final file set**

Run: `git status --short`
Expected: intended candidate-area files plus any pre-existing unrelated user changes
