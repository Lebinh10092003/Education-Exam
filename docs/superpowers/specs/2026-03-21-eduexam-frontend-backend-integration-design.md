# EduExam Frontend Backend Integration Design

**Date:** 2026-03-21

**Goal:** Replace the current mock-driven React/Vite frontend with a real Django-backed application while preserving the existing UI structure and wiring every meaningful screen to the backend that already exists.

## Context

The current frontend is a visual prototype:

- pages keep hardcoded arrays and fake counters inside component files
- login is a route link, not authentication
- there is no shared API client, token storage, refresh flow, or route protection
- candidate delivery, monitoring, results, and profile screens are not connected to backend state

The backend now exposes working APIs for:

- auth and profile
- users, roles, permissions
- schools, groups, memberships
- subjects
- question bank and imports
- exam authoring and assignment
- candidate exam delivery
- grading and results
- proctoring and live monitoring

The remaining frontend work is therefore an integration and stabilization project, not a greenfield UI build.

## Chosen Approach

Use a hybrid integration path:

1. Build a frontend foundation layer for auth, API transport, token refresh, route guards, and shared async state handling.
2. Connect all screens that can already be backed by existing Django endpoints.
3. Add only the minimum extra backend endpoints needed for screens that still have no meaningful source of truth, specifically dashboard aggregates, materials, and forgot-password initiation.

This approach avoids two bad outcomes:

- wiring isolated pages ad hoc with no shared auth or request conventions
- blocking all frontend progress on a full backend expansion before integration starts

## Architecture

### Frontend foundation

Add a small but explicit application layer in the React app:

- `src/app/lib/http.ts`: fetch wrapper, base URL, auth header injection, refresh retry, normalized error handling
- `src/app/lib/storage.ts`: token persistence helpers
- `src/app/lib/env.ts`: API and websocket base configuration
- `src/app/auth/*`: auth context or store, current-user bootstrap, login/logout, role helpers
- `src/app/hooks/*`: reusable async hooks for paginated lists, mutations, debounce, and websocket lifecycle
- route guards around admin and candidate sections

The app should not scatter raw `fetch` calls inside arbitrary components. Every page should go through the shared transport and auth flow.

### Page wiring strategy

Each page will move from local constants to one of these patterns:

- `list + filter + mutation` for admin CRUD pages
- `form wizard + draft mutation` for exam creation
- `session bootstrap + incremental save` for candidate exam delivery
- `snapshot + websocket updates` for live monitoring
- `summary + list views` for dashboard and results

The visible UI structure should remain close to the existing screens, but the data source changes from mock arrays to backend responses.

### Backend delta

The frontend can already consume most of the backend, but three areas need minimal additional backend support:

- `dashboard`: aggregate endpoint for counts, recent exams, and alert summaries
- `materials`: CRUD and upload endpoints
- `forgot password`: request endpoint to accept email and produce a no-op or future-ready workflow

These backend additions should be purpose-built for the current screens and not attempt a broader notification or asset platform redesign.

## Page-to-API Mapping

### Slice 1: Foundation

- `Login`
  - `POST /api/v1/auth/login/`
  - `POST /api/v1/auth/refresh/`
  - `GET /api/v1/profile/`
- `Profile menu / route protection`
  - `GET /api/v1/profile/`

### Slice 2: Admin modules

- `User Management`
  - `GET|POST /api/v1/users/`
  - `PATCH /api/v1/users/{id}/`
  - `POST /api/v1/users/{id}/lock/`
  - `POST /api/v1/users/{id}/unlock/`
  - `GET /api/v1/roles/`
  - `GET /api/v1/permissions/`
- `Group Management`
  - `GET|POST /api/v1/groups/`
  - `GET|POST /api/v1/groups/{id}/memberships/`
  - `GET /api/v1/schools/`
- `Subject Management`
  - `GET|POST /api/v1/subjects/`
  - `PATCH /api/v1/subjects/{id}/`
  - `DELETE /api/v1/subjects/{id}/`
- `Question Bank`
  - `GET|POST /api/v1/questions/`
  - `PATCH /api/v1/questions/{id}/`
  - `GET /api/v1/question-tags/`
  - `POST /api/v1/question-imports/`
- `Exam Management`
  - `GET /api/v1/exams/`
  - `POST /api/v1/exams/`
  - `PATCH /api/v1/exams/{id}/`
  - `POST /api/v1/exams/{id}/clone/`
- `Exam Creation Wizard`
  - `GET /api/v1/subjects/`
  - `GET /api/v1/questions/`
  - `GET /api/v1/groups/`
  - `POST /api/v1/exams/`
- `Exam Assignment`
  - `GET /api/v1/exams/{id}/group-assignments/`
  - `POST /api/v1/exams/{id}/group-assignments/`
- `Results & Reports`
  - `GET /api/v1/results/`
  - `GET /api/v1/results/summary/`
  - `POST /api/v1/results/{id}/publish/`
- `Live Monitoring`
  - `GET /api/v1/proctoring/exams/{id}/monitoring/`
  - `GET /api/v1/proctoring/cases/`
  - `POST /api/v1/proctoring/cases/{id}/resolve/`
  - `ws://.../ws/monitoring/exams/{id}/?token=...`

### Slice 3: Candidate modules

- `Practice Exam`
  - `GET /api/v1/my-exams/`
- `Take Exam`
  - `POST /api/v1/exams/{id}/start-session/`
  - `GET /api/v1/exam-sessions/{id}/`
  - `PUT /api/v1/exam-sessions/{session_id}/answers/{question_id}/`
  - `POST /api/v1/exam-sessions/{id}/autosave/`
  - `POST /api/v1/exam-sessions/{id}/submit/`
  - `POST /api/v1/proctoring/sessions/{id}/capability/`
  - `POST /api/v1/proctoring/sessions/{id}/heartbeats/`
  - `POST /api/v1/proctoring/sessions/{id}/events/`
  - `POST /api/v1/proctoring/sessions/{id}/evidence/`
- `Profile`
  - `GET /api/v1/profile/`
  - use minimal frontend-only editing until backend profile update exists, or add a dedicated update endpoint in the same effort

### Backend additions required for current menu completeness

- `Dashboard`
  - add `/api/v1/dashboard/summary/`
- `Materials Library`
  - add `/api/v1/materials/`
- `Forgot Password`
  - add `/api/v1/auth/forgot-password/`

## Data and State Conventions

- keep JWT access token in memory plus durable browser storage for reload survival
- refresh token flow should be centralized in the HTTP client
- bootstrap `profile` once after login or page reload
- redirect unauthorized users to `/login`
- role-aware navigation should be driven by backend profile roles, not hardcoded assumptions
- search and filters should round-trip through query params where backend already supports them
- mutation success should refresh only affected resources, not force full page reloads

## UI Behavior Changes

The following visible behaviors will change from static to real:

- login failure and permission denial messages
- tables reflecting backend pagination and filters
- dialogs that actually create or update records
- exam wizard producing a real exam instead of navigating back silently
- candidate answer selection persisting and reloading from session state
- live monitoring updating from polling snapshot plus websocket events

Where the current UI promises actions that do not yet have backend meaning, the UI should either:

- be backed by a real endpoint added in this effort, or
- be relabeled or hidden until it is real

The second option is acceptable only for clearly secondary actions such as placeholder export buttons.

## Error Handling

- show inline field errors for form validation responses
- show non-blocking toast errors for transient request failures
- automatically redirect to login on irrecoverable auth expiration
- keep partial page state visible while list reloads to avoid blank-page flicker
- preserve candidate exam state locally long enough to survive short network interruptions before autosave succeeds

## Testing Strategy

### Frontend

- unit tests for auth store, token refresh behavior, and request helpers
- component tests for login flow, guarded routes, and key forms
- integration tests for exam creation, candidate delivery, and live monitoring state updates

### Backend additions

- API tests for dashboard summary, materials CRUD/upload, and forgot-password initiation

### End-to-end smoke paths

- admin login -> create subject/question/exam -> assign group
- candidate login -> start exam -> answer -> autosave -> submit
- examiner/admin -> grade/publish result -> result visible in reports
- proctor/admin -> open monitoring screen -> receive websocket update

## Delivery Plan

Implementation should proceed in these slices:

1. `Foundation`
   - auth, token refresh, route guards, shared HTTP client, shared error handling
2. `Admin data screens`
   - users, groups, subjects, question bank, exams, assignment
3. `Candidate flow`
   - my exams, start/resume, take exam, submit, results-related screens
4. `Realtime and remaining screens`
   - live monitoring websocket, dashboard summary, materials, forgot-password

## Constraints

- preserve current visual layout and route structure unless a change is necessary to make the flow work
- do not introduce an oversized state library unless the existing scope truly requires it
- prefer small reusable hooks and focused service modules over a monolithic frontend architecture
- keep backend additions minimal and aligned with the current UI
- this workspace currently has no `.git`, so spec and implementation artifacts cannot be committed yet
