# Candidate Area Zip Alignment Design

Date: 2026-03-23

## Goal

Rebuild the student-facing area so it aligns with the UI and information architecture from `EduExam Online Examination Platform.zip`, while preserving the current working exam-taking flow and maximizing reuse of the existing backend APIs.

## Current Context

- The current candidate area already has working routes for:
  - `/candidate/dashboard`
  - `/candidate/practice`
  - `/candidate/results`
  - `/candidate/materials`
  - `/candidate/exam/:id`
- The current app already uses real backend APIs for candidate data:
  - `/api/v1/my-dashboard/overview/`
  - `/api/v1/my-exams/`
  - `/api/v1/my-results/`
  - `/api/v1/my-materials/`
  - `/api/v1/exams/:id/start-session/`
- The zip introduces a broader student area with:
  - updated `CandidateLayout`
  - `CandidateDashboard`
  - `MyExams`
  - `ExamInstructions`
  - `ResultDetail`
  - `StudentNotifications`
  - `StudentProfile`
  - `StudentHelp`
- Most zip screens use mock data and route assumptions that do not exactly match the current app.

## Product Decision

### Chosen Approach

Use a compatibility-first rebuild with API-first data binding.

This means:

- adopt the zip's candidate information architecture and visual direction
- keep existing working candidate routes usable
- add new candidate routes where the zip introduces meaningful new pages
- use real backend APIs wherever current endpoints already exist
- use controlled fallback or empty states only where backend support does not yet exist

### Rejected Alternatives

#### Zip 1:1 replacement

Rejected because it would replace working data-bound screens with mock-oriented implementations and create avoidable regressions.

#### Full frontend + backend expansion in one pass

Rejected because it broadens scope into a backend feature project rather than a candidate UI integration project, which raises risk and slows delivery.

## Scope

This design covers:

- replacing the candidate shell and navigation with the zip-aligned structure
- introducing new candidate routes and pages where needed
- mapping zip UI to existing APIs for dashboard, exam list, results, materials, and exam-taking
- keeping backwards compatibility for existing candidate links
- adding tests for route availability and candidate-shell behavior

This design does not cover:

- redesigning the live `TakeExam` experience from scratch
- adding large new backend domains solely for the candidate area
- implementing a full real-time notification backend if the current API surface is insufficient
- introducing a new state-management library
- changing admin-facing areas

## Architecture

### Compatibility-First Candidate Area

The student area should be rebuilt around the zip's structure, but without breaking the current production-minded flow.

Principles:

- preserve the existing route entry points that are already linked from the app
- introduce additional routes to support the richer zip experience
- keep `TakeExam` as the canonical live exam-taking screen
- avoid backend changes unless a page cannot be reasonably supported otherwise

### API-First Data Strategy

Page categories:

- pages with real data support now:
  - dashboard
  - my exams
  - results
  - materials
  - take exam
- pages with partial or no dedicated backend support now:
  - notifications
  - help
  - profile detail enhancements
  - result detail route beyond what the list already exposes
  - exam instructions detail data if not carried from upstream navigation

Rule:

- use existing API data first
- derive route detail data from already loaded parent data when practical
- use empty-state or minimal fallback only where the backend contract is genuinely absent

## Routing Design

### Existing Routes To Keep

Keep these routes functional:

- `/candidate`
- `/candidate/dashboard`
- `/candidate/practice`
- `/candidate/results`
- `/candidate/materials`
- `/candidate/exam/:id`

### New Routes To Add

Add these routes to match the zip's candidate experience:

- `/candidate/exams`
- `/candidate/exams/:id/instructions`
- `/candidate/notifications`
- `/candidate/profile`
- `/candidate/help`

Optional route aliases if useful during implementation:

- `/candidate/results/:id`

### Routing Intent

- `/candidate/exams` becomes the primary list view for assigned exams
- `/candidate/exams/:id/instructions` becomes the pre-exam context page
- `/candidate/exam/:id` remains the actual live test-taking route
- `/candidate/practice` remains available and is visually aligned with the candidate area

## Page Design

### CandidateLayout

Replace the current candidate shell with a zip-aligned navigation model.

Navigation should expose:

- Dashboard
- My Exams
- Practice
- Materials
- Results
- Notifications
- Profile
- Help

Requirements:

- active route highlighting
- compatibility with `/candidate` and `/candidate/dashboard`
- preserve the existing exam-taking layout bypass for `/candidate/exam/:id`
- keep logout integration wired to the real auth flow rather than the zip's static login link

### CandidateDashboard

Rebuild the dashboard with the zip's layout and hierarchy, but bind it to `/api/v1/my-dashboard/overview/`.

Use real data for:

- upcoming exams
- recent results
- recent materials
- high-level counts

The zip's practice suggestion card can be implemented as:

- a navigation module to `/candidate/practice`, and
- selected summary content derived from existing candidate datasets where practical

### MyExams

Create `MyExams` at `/candidate/exams`.

Data source:

- `/api/v1/my-exams/`

Responsibilities:

- search and filter assigned exams
- display status, schedule, duration, attempts, and proctoring state
- route to exam instructions or directly to take-exam where appropriate

This page becomes the candidate's main exam-management hub.

### ExamInstructions

Create a pre-exam instructions page at `/candidate/exams/:id/instructions`.

Data strategy:

1. prefer exam data passed through route state from dashboard or exam list
2. fallback to loading `/api/v1/my-exams/` and locating the exam by ID

This page should not start the exam session.

Responsibilities:

- summarize exam timing, duration, attempts, and subject
- show instructions and readiness messaging
- surface proctoring or timing warnings if applicable
- provide the final CTA into `/candidate/exam/:id`

### Practice

Keep `/candidate/practice`, but align it visually with the zip's student area.

Constraint:

- do not fabricate a large fake practice domain if current backend support is limited

Recommended implementation:

- keep current practice/exam list behavior where data is real
- restyle and reframe it as part of the candidate experience

### Results

Rebuild `/candidate/results` to match the zip's higher-fidelity analytics and table layout.

Data source:

- `/api/v1/my-results/`

Use real data for:

- trend chart
- subject performance chart
- stats summary
- result listing

Detailed result inspection can remain:

- sheet-based from the list, or
- later expanded to a dedicated route if the implementation benefits from it

### Materials

Rebuild `/candidate/materials` in the zip style while keeping its current real API source.

Data source:

- `/api/v1/my-materials/`

Requirements:

- subject and type filtering
- grid and list views
- open and download actions
- latest uploads sidebar or equivalent summary block

### StudentNotifications

Create `/candidate/notifications`.

Data strategy:

- if the current notifications API can already serve candidate notifications safely, use it
- otherwise implement the page with a real structure plus a clear empty state rather than large invented mock feeds

This page should be compatible with future realtime notification work but must not require it now.

### StudentProfile

Create `/candidate/profile`.

Data source:

- candidate identity data from the existing auth/profile flow

Requirements:

- display profile basics using real data
- expose school and contact details where available
- keep implementation lightweight and consistent with current auth context

### StudentHelp

Create `/candidate/help` as a static support and guidance page.

Content can include:

- exam readiness checklist
- browser/device guidance
- support contact instructions
- common troubleshooting notes

No backend dependency is required.

## Data Mapping

### Dashboard Mapping

Map:

- zip "Upcoming Exams" → `overview.upcoming_exams`
- zip "Recent Results" → `overview.recent_results`
- zip "Latest Materials" → `overview.recent_materials`
- zip stat cards → `overview.stats`

### My Exams Mapping

Map:

- zip exam cards and statuses → `/api/v1/my-exams/` records
- CTA rules:
  - active session → resume or continue flow
  - scheduled/eligible → instructions or start path
  - exhausted attempts → disabled state

### Result Mapping

Map:

- zip charts → transformations over `/api/v1/my-results/`
- zip result table → list records
- zip result detail → currently available result fields from the same payload

### Materials Mapping

Map:

- zip material cards/list rows → `/api/v1/my-materials/` records
- file type icons → derived from mime type

## Error Handling And Fallbacks

### Preferred Behavior

Use real API errors and render graceful inline states rather than hiding problems behind mock data.

### Fallback Rules

- no backend support: empty-state or limited static helper content
- partial backend support: use available fields and omit unsupported advanced metrics
- missing route state on detail pages: refetch from the nearest compatible existing endpoint

Avoid:

- large permanent mock datasets in production-facing pages
- fake counts that look like real student data

## Testing Strategy

### Frontend Tests

Add or update tests for:

- candidate route registration for new pages
- candidate navigation shell behavior
- compatibility of old candidate routes
- basic render of the new pages that use fallback or empty states

### Verification

Minimum verification for this work:

- targeted candidate route and layout tests
- any new page-level tests added for transformed data behavior
- frontend build

## Implementation Notes

- Preserve current backend-integrated candidate pages as reference while rebuilding them to the new design language.
- Prefer adapting existing working page files over replacing them wholesale with mock-oriented zip versions.
- Keep the `TakeExam` route stable and isolated from broader candidate-shell changes.
- Do not let the candidate-area redesign force backend scope unless a truly blocking API gap is discovered.
