# EduExam Updated UI Merge and Domain Integration Design

**Date:** 2026-03-22

**Status:** Approved design baseline for implementation planning

## Context

Current project state:

- The repository already contains a working React/Vite frontend and Django backend.
- The frontend already has real auth/session handling through `AuthContext`, `ProtectedRoute`, `apiRequest`, and the recent SweetAlert2 notification wrapper.
- The backend already exposes real APIs for users, roles, permissions, groups, subjects, exams, exam assignment, candidate delivery, grading, results, proctoring, materials, and dashboard overview.
- The updated UI zip adds additional admin and candidate screens, but many of them are mock-only and some overlap with existing live workflows.

Product direction agreed in this design:

- Import the updated interface broadly, but do not regress current auth, session, self-lock, or live API behavior.
- Prefer merging overlapping features into existing workflows instead of creating duplicate screens and duplicate actions.
- Reuse existing backend APIs wherever possible.
- If a new screen represents a valid domain and no backend exists yet, add the corresponding backend in a focused way.

## Goals

- Merge the updated UI into the current app without replacing the existing protected routing and session behavior.
- Keep the existing admin and candidate flows working while expanding route coverage.
- Replace mock-only screens with live data wherever backend support already exists.
- Add focused backend support for missing but approved domains:
  - notifications inbox
  - audit activity center
  - exam periods
  - exam rooms
  - candidate-scoped dashboard, results, and materials views
  - group membership CSV import
- Remove redundant feature entry points so one business action has one primary flow.

## Non-Goals

- Replacing `ProtectedAdminLayout`, `ProtectedCandidateLayout`, `AuthContext`, or the current token refresh flow.
- Replacing the SweetAlert2 notification utility with a backend-driven notification UI.
- Keeping `ImportJobs` as a standalone admin screen.
- Copying the updated zip routing verbatim.
- Adding domains that are not justified by the approved screen set.
- Rewriting the frontend into a new state-management architecture.

## User-Approved Decisions

- Use the full updated UI as the target scope, not just auth/notification changes.
- Prioritize wiring screens into existing API and logic first.
- If a new screen has no backend but fits the product, create the backend and integrate it properly.
- If a new screen duplicates an existing workflow, merge the behavior into the existing workflow instead of keeping both.
- Do not keep `ImportJobs` as a separate screen.
- Candidate login landing must remain unchanged and continue to default to `/candidate/practice`.

## Core Design Principle

One business capability should have one primary workflow. Updated screens are treated as candidates for integration, not as authoritative replacements.

That means:

- preserve current logic when the repository version is already more correct than the zip
- reuse current API-backed pages where they already exist
- import visual structure and interaction ideas from the zip only when they strengthen the current flow
- reject duplicate entry points for the same action

## Routing and Shell Design

### Authentication and route protection

The current route protection stays in place:

- `PublicLoginPage`
- `ProtectedAdminLayout`
- `ProtectedCandidateLayout`
- `AuthContext`
- self-lock and inactive-account handling

The updated UI must be merged into these boundaries instead of bypassing them.

### Admin route structure

The admin route tree remains under `/` with `ProtectedAdminLayout`, and is expanded with:

- `/exams/:id`
- `/manual-grading`
- `/roles-permissions`
- `/notifications`
- `/audit`
- `/exam-periods`
- `/exam-rooms`

The following admin route is explicitly not kept:

- `/import-jobs`

### Candidate route structure

The candidate route tree remains under `/candidate` with `ProtectedCandidateLayout` and is expanded with:

- `/candidate`
- `/candidate/dashboard`
- `/candidate/results`
- `/candidate/materials`

The default post-login route does not change. Candidate users still land on `/candidate/practice`.

## Screen Merge Matrix

### Reuse existing domains with live APIs

- `ExamDetail`: use the existing exam domain and exam routes.
- `ManualGrading`: use `grading/tasks` and related grading actions.
- `ResultsReports`: keep the existing live results page and improve presentation where useful.
- `RolesPermissions`: use live `roles` and `permissions` APIs.
- `LiveMonitoring`: keep the existing proctoring and websocket-backed monitoring flow.

### Merge new UI into existing flows

- `ImportJobs`: removed.
- Candidate import into groups:
  - move import into `GroupManagement` > `Add Members`
  - do not keep a separate import center
  - backend will expose a group membership import action directly under the group workflow
- `CandidateResults`:
  - do not create a new results domain
  - create candidate-scoped results access over the current grading/results data
- `CandidateMaterials`:
  - do not create a new materials domain
  - create candidate-scoped materials access over the current materials data
- `CandidateDashboard`:
  - use one lightweight aggregate endpoint instead of embedding multiple unrelated data calls in the page

### Add missing but valid domains

- `NotificationCenter`: create a real notifications inbox domain
- `AuditCenter`: create audit event storage and listing
- `ExamPeriods`: add a scheduling support domain connected to exams
- `ExamRooms`: add a room/resource domain connected to exams

## Frontend Architecture

### Shared integration rules

The frontend continues to use the current infrastructure:

- `apiRequest` for all HTTP requests
- `useAsyncList` for loading and reload flows
- `useMutationState` for form and action submissions
- `notify.*` for destructive actions, errors, and success feedback

No new global state layer is introduced.

### Layout rules

- `AdminLayout` is expanded to include the approved screens in navigation.
- The existing responsive and active-path behavior in the current `AdminLayout` should be preserved over the simpler zip version.
- `CandidateLayout` becomes a real shared shell for candidate pages so header, logout behavior, and navigation are not duplicated across `CandidateDashboard`, `CandidateResults`, and `CandidateMaterials`.
- Candidate logout must continue to go through `useAuth().logout()` rather than mock `Link` navigation to `/login`.

### Component reuse

New screens should reuse existing components when possible:

- `PageHeader`
- `StatusBadge`
- `StatCard`
- `Card`
- `Dialog`
- `Sheet`
- `Tabs`
- current form controls under `src/app/components/ui`

The zip UI is a source of page composition, not a reason to fork the design system.

## Backend Architecture

### Existing apps that will be extended

#### `institutions`

Add group membership CSV import support under the existing group workflow.

Preferred API shape:

- `POST /api/v1/groups/{id}/memberships/import/`

This stays close to the existing `memberships` action and avoids inventing a separate import domain for users.

The implementation should reuse the current student import style already present in `exam_authoring`:

- CSV upload validation
- row-level partial success
- summary counts
- row error reporting
- create-or-update matching rules where appropriate

#### `exam_authoring`

Add support for:

- exam periods
- exam rooms
- linking exams to those records

These two features belong with authoring and scheduling rather than becoming separate top-level business domains.

#### `grading`

Continue to own:

- manual grading task queue
- grading actions
- result publication

If the manual grading page needs extra summary or filter support, extend this app instead of adding a parallel reporting flow.

#### `materials`

Add candidate-scoped listing support for the candidate materials screen.

#### `exam_delivery` or `platform_core`

Add one lightweight candidate dashboard overview endpoint that aggregates:

- assigned or upcoming exams
- recent published results
- recent materials or materials summary

The endpoint should stay thin and should not introduce a separate stored snapshot model unless needed later.

### New backend areas

#### `notifications`

Create a dedicated notifications app, consistent with the earlier backend design.

Responsibilities:

- store user-facing system notifications
- support list/filter/read-state behavior
- expose unread counts for topbar display
- support mark-read and mark-all-read actions

This domain is not a replacement for `notify.ts`. Backend notifications are durable inbox items. `notify.ts` remains the immediate frontend feedback mechanism.

#### `platform_core` audit support

Add audit event storage and helpers under `platform_core`, matching the earlier backend design direction.

Responsibilities:

- record important security and operational events
- expose list and detail APIs for `AuditCenter`
- support filtering by category, severity, user, and date range

Target actions to audit in this phase:

- login
- logout or session end where available
- lock and unlock user
- role and permission changes
- exam publication and assignment changes
- result publication
- manual grading actions
- proctoring violation review actions

#### Candidate-scoped APIs

Add focused read endpoints instead of overloading admin list views:

- `GET /api/v1/my-results/`
- `GET /api/v1/my-materials/`
- `GET /api/v1/my-dashboard/overview/`

This keeps candidate filtering explicit and avoids leaking admin query semantics into candidate pages.

## Detailed Capability Design

### Group member import

The import workflow lives inside `GroupManagement` in the `Add Members` dialog.

Expected behavior:

- admin uploads a CSV in the dialog
- backend validates headers and rows
- existing candidates can be matched and added
- new candidate or student users can be created when allowed by the import rules
- memberships are created only when missing
- the dialog shows a summary and row-level errors
- the group member list and group counts refresh in place

This design intentionally avoids redirecting users into a separate import-monitoring screen.

### Manual grading

The updated `ManualGrading` screen becomes the primary UI over `grading/tasks`.

Expected behavior:

- task list is loaded from the backend
- filters and search are backed by API query params
- opening a task shows the answer, rubric, current grade state, and feedback
- grading submits through the existing grade action
- successful grading reloads the queue and related summaries

### Roles and permissions

The updated `RolesPermissions` page must render real backend permission codes and role records.

Important constraint:

- do not ship the zip page with its mock permission catalog

The backend naming is already established, and the UI must reflect those actual codes and descriptions.

### Notifications

The topbar bell and the `NotificationCenter` page share one backend source.

Expected behavior:

- unread count in header
- paginated list with filters
- read and unread tabs or filters
- mark one or many as read
- optional delete or archive only if supported cleanly by the model

### Audit center

The `AuditCenter` page is a filtered log viewer over stored audit records.

Expected behavior:

- search by actor, target, or description
- filter by category and severity
- view detailed payload for an event
- optional export after list behavior is stable

This phase should prioritize accuracy and usefulness over pseudo-realtime visuals.

### Exam periods and rooms

These screens are not standalone decoration. They must connect back to exam scheduling.

Minimum integration:

- CRUD for periods
- CRUD for rooms
- ability for exam records to reference a period and a room
- surfaces in exam detail and exam creation or edit flows where appropriate

If they do not connect back to exams, they provide little operational value.

### Candidate pages

#### Candidate dashboard

Use the updated page structure, but drive it from a single aggregate endpoint and the current auth profile.

#### Candidate results

Use candidate-scoped result data only, likely restricted to published results unless business rules explicitly allow draft visibility.

#### Candidate materials

Use candidate-scoped materials access and reuse the current materials domain rather than duplicating storage rules.

## Error Handling

- Continue to centralize request failures in `apiRequest`.
- Page-level load failures use inline error states.
- High-signal action failures and confirmations use `notify`.
- Group import returns partial success with row errors instead of failing the whole batch for one bad row.
- Manual grading actions should be protected from accidental double-submit through frontend mutation state and backend-safe update flow.
- Notification and audit filters should not blank the whole page on transient errors.

## Testing Strategy

### Frontend

Add or update tests for:

- route guards after adding admin and candidate routes
- candidate shell behavior
- manual grading page with live API-backed interactions
- roles and permissions page with backend records
- notification center loading and read-state updates
- audit center list and filter behavior
- exam periods and exam rooms CRUD flows
- candidate dashboard, results, and materials screens
- group member import dialog workflow
- regression coverage for self-lock and session-expired handling

### Backend

Add or update tests for:

- group membership CSV import
- candidate-scoped result API
- candidate-scoped materials API
- candidate dashboard aggregate API
- notifications models, list actions, and unread counts
- audit event recording and audit list API
- exam periods and exam rooms CRUD APIs
- exam association to period and room
- updated schema coverage where new endpoints are introduced

## Rollout Strategy

Implementation should proceed in small slices, not as a single frontend rewrite.

Recommended order:

1. route and layout merge
2. `ExamDetail`, `ManualGrading`, and `RolesPermissions`
3. candidate dashboard, results, and materials
4. group membership import merge
5. exam periods and exam rooms
6. notifications and header unread state
7. audit center

Each slice should be verified before moving on to the next.

## Risks and Mitigations

### Risk: UI regression from copying zip files directly

Mitigation:

- preserve current protected routing and session logic
- merge page structure selectively instead of replacing app infrastructure

### Risk: duplicate workflows

Mitigation:

- remove `ImportJobs`
- place import inside `GroupManagement`
- keep one canonical flow per business action

### Risk: screens that look complete but are still mock-only

Mitigation:

- do not keep a screen unless it is connected to a live backend or has an approved backend implementation in the same implementation cycle

### Risk: candidate shell duplication

Mitigation:

- create one real `CandidateLayout` shell and route all candidate pages through it

## Outcome

This design treats the updated UI as an expansion of the current product, not as a replacement for the repository's working logic.

The result should be:

- broader route and screen coverage
- no duplicate business workflows
- preserved auth and self-lock behavior
- stronger integration between frontend screens and real backend data
- focused new backend domains only where they are justified by approved product needs
