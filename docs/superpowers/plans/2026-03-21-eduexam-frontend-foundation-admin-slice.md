# EduExam Frontend Foundation And Admin Slice Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the mock-driven frontend into a real authenticated app for the foundation layer plus the first admin data screens: login, profile shell, users, groups, and subjects.

**Architecture:** Add a shared frontend integration layer for environment configuration, token storage, authenticated HTTP requests, refresh handling, and route guards. Then replace local mock arrays in the first admin screens with backend-backed queries and mutations while preserving the current UI structure as much as possible.

**Tech Stack:** React 18, React Router 7, Vite, TypeScript, Django REST API, JWT

---

## Chunk 1: Frontend Foundation

### Task 1: Add environment, storage, and HTTP client primitives

**Files:**
- Create: `src/app/lib/env.ts`
- Create: `src/app/lib/storage.ts`
- Create: `src/app/lib/http.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Add API environment helpers**
- [ ] **Step 2: Add token persistence helpers for access and refresh tokens**
- [ ] **Step 3: Add shared HTTP client with:**
  - base URL resolution
  - JSON request/response handling
  - bearer token injection
  - 401 refresh retry once
  - normalized API error objects
- [ ] **Step 4: Add Vite dev proxy for `/api` and `/ws` to `127.0.0.1:8000`**

### Task 2: Add auth store, provider, and route guards

**Files:**
- Create: `src/app/auth/AuthContext.tsx`
- Create: `src/app/auth/useAuth.ts`
- Create: `src/app/components/auth/ProtectedRoute.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/main.tsx`
- Modify: `src/app/routes.ts`
- Modify: `src/app/components/layouts/AdminLayout.tsx`
- Modify: `src/app/components/layouts/CandidateLayout.tsx`

- [ ] **Step 1: Create auth context state**
  - `tokens`
  - `profile`
  - `isBootstrapping`
  - `login`
  - `logout`
  - `refreshProfile`
- [ ] **Step 2: Bootstrap profile from stored tokens on load**
- [ ] **Step 3: Guard admin routes behind authentication**
- [ ] **Step 4: Guard candidate routes behind authentication**
- [ ] **Step 5: Replace hardcoded layout user identity with profile-backed values**

### Task 3: Make login real

**Files:**
- Modify: `src/app/pages/Login.tsx`

- [ ] **Step 1: Replace `Link`-based sign-in with controlled form state**
- [ ] **Step 2: Call `POST /api/v1/auth/login/` through auth context**
- [ ] **Step 3: On success, fetch profile and redirect based on role**
- [ ] **Step 4: Render inline or toast errors on failed login**

## Chunk 2: Shared Async Page Utilities

### Task 4: Add lightweight page hooks and helpers

**Files:**
- Create: `src/app/hooks/useDebouncedValue.ts`
- Create: `src/app/hooks/useAsyncList.ts`
- Create: `src/app/hooks/useMutationState.ts`

- [ ] **Step 1: Add debounce helper for search inputs**
- [ ] **Step 2: Add list loading helper with loading, error, reload**
- [ ] **Step 3: Add mutation helper with submitting and error state**

## Chunk 3: Users Screen

### Task 5: Wire User Management to backend

**Files:**
- Modify: `src/app/pages/UserManagement.tsx`

- [ ] **Step 1: Replace local `users` constant with backend data**
- [ ] **Step 2: Load roles for role filter and create form**
- [ ] **Step 3: Support search and role/status filters via query params**
- [ ] **Step 4: Implement create user mutation**
- [ ] **Step 5: Implement lock and unlock actions**
- [ ] **Step 6: Keep unsupported actions clearly inert or hidden**
  - CSV import
  - bulk delete
  - edit/delete if backend support is not yet being used in this slice

## Chunk 4: Groups Screen

### Task 6: Wire Group Management to backend

**Files:**
- Modify: `src/app/pages/GroupManagement.tsx`

- [ ] **Step 1: Replace local `groups` constant with `GET /api/v1/groups/`**
- [ ] **Step 2: Load schools for group creation**
- [ ] **Step 3: Implement create group mutation**
- [ ] **Step 4: Implement membership list loading for selected group**
- [ ] **Step 5: Implement add member mutation via `/memberships/`**
- [ ] **Step 6: Leave true delete/edit actions hidden or downgraded if not implemented in this slice**

## Chunk 5: Subjects Screen

### Task 7: Wire Subject Management to backend

**Files:**
- Modify: `src/app/pages/SubjectManagement.tsx`

- [ ] **Step 1: Replace local `subjects` constant with `GET /api/v1/subjects/`**
- [ ] **Step 2: Implement subject creation**
- [ ] **Step 3: Implement subject update for existing records**
- [ ] **Step 4: Implement subject delete**
- [ ] **Step 5: Keep counts and colors mapped to backend fields**

## Chunk 6: Verification And Docs

### Task 8: Verify the slice and update local run guidance if needed

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run frontend type/build verification**
  - `npm.cmd run build`
- [ ] **Step 2: Run backend API verification to ensure no contract regressions**
  - `backend\.venv\Scripts\python backend\manage.py check`
  - `backend\.venv\Scripts\python -m pytest backend/tests -q`
- [ ] **Step 3: Update README root if frontend now assumes proxied `/api`**
- [ ] **Step 4: Summarize remaining screens for the next slice**
