# Exam Monitoring Tabbed Management Design

Date: 2026-03-23

## Goal

Redesign exam monitoring so that proctoring lives inside exam management as a focused tab in exam detail, with structured sub-tabs, practical filters, pagination, search, Excel export, and no route-level 404 failures when opening violation details.

## Current Context

- The admin area currently has a dedicated monitoring route:
  - `/exams/:id/monitor`
- The main exam detail route is:
  - `/exams/:id`
- The current monitoring page already supports:
  - realtime snapshot polling and websocket refresh
  - live webcam viewing for selected candidates
  - violation case display and resolution
  - live alerts and candidate status cards/tables
- The current page structure is overloaded:
  - `Live Alerts` is rendered as a long vertical list without pagination
  - `Candidate Status` is mixed into the same screen with no true searching or filtering workflow
  - `Violation Cases` is visually available but not structurally separated from live activity
- The user reports a real browser failure:
  - opening violation detail can trigger React Router's default unexpected application error screen with `404 Not Found`
- The user explicitly chose:
  - monitoring should become a tab inside exam management
  - the tab should appear only for exams with `enable_proctoring = true`
  - monitoring should be split into separate tabs such as `Live Alerts` and `Candidate Status`
  - the UX must support pagination, filtering, searching, and export
  - violation export must be Excel, not CSV
  - live activity and violation history must be separated:
    - `Live Alerts` should focus on live/open items
    - `Violation History` should show the complete case history

## Product Decision

### Chosen Approach

Move monitoring into `Exam Detail` as a conditional `Monitoring` tab and treat monitoring as a workspace with internal sub-tabs instead of a standalone full-page route.

This means:

- `/exams/:id` remains the primary management route for a single exam
- monitoring is represented by query state, not a separate route tree
- violation detail is rendered in-page via a detail panel, not via navigation to a new route
- live activity and historical review are split into separate sub-tabs
- heavier datasets use pagination and filtering appropriate to their source

### Rejected Alternatives

#### Keep `/exams/:id/monitor` and only clean up the UI

Rejected because it does not satisfy the requirement that monitoring become part of exam management, and it preserves the brittle route boundary that is already producing 404-style UX failures.

#### Build multiple nested monitoring routes under exam detail

Rejected for this phase because the user's problem is primarily information architecture, not missing route depth. Query-driven tab state is sufficient and more robust for refresh, deep linking, and support workflows.

#### Leave live alerts and violation history in one combined list

Rejected because the user explicitly wants a cleaner distinction between real-time supervision and historical review. The existing mixed list makes prioritization and investigation harder as data grows.

## Scope

This design covers:

- moving monitoring into exam detail as a conditional tab
- restructuring monitoring into sub-tabs
- query-driven deep linking for monitoring state
- search, filters, and pagination for monitoring datasets
- Excel export of filtered violation history by exam
- elimination of route-level violation-detail navigation that can fail with 404

This design does not cover:

- candidate-facing exam runner changes
- proctoring media architecture changes
- rule changes for creating violations
- long-term analytics dashboards
- bulk import/export redesign outside monitoring

## Architecture Overview

The monitoring redesign should treat exam detail as the parent management surface and monitoring as a child workspace.

Top-level structure:

- `Exam Detail`
  - `Details`
  - `Assignments`
  - `Questions`
  - `Rules`
  - `Monitoring` only when proctoring is enabled

Monitoring workspace sub-tabs:

- `Overview`
- `Live Alerts`
- `Candidate Status`
- `Violation History`

State should be carried in query params so the URL remains refresh-safe and shareable:

- `tab=monitoring`
- `monitorTab=overview|live-alerts|candidate-status|violation-history`
- `case=<id>` for selected violation detail
- optional filter and search params for `Violation History`

This approach keeps one stable page route while still allowing deep linking into a specific monitoring view.

## Route And State Design

### Primary Route

Keep the canonical exam detail route:

- `/exams/:id`

Monitoring should no longer require a dedicated route like:

- `/exams/:id/monitor`

All monitoring deep links should resolve through `/exams/:id` with query params.

Example deep links:

- `/exams/12?tab=monitoring`
- `/exams/12?tab=monitoring&monitorTab=live-alerts`
- `/exams/12?tab=monitoring&monitorTab=violation-history&status=open&severity=critical`
- `/exams/12?tab=monitoring&monitorTab=violation-history&case=44`

### Why Query State Is Required

Benefits:

- avoids route mismatches for detail panes
- allows refresh without React Router falling into a missing child route
- keeps support and operations links simple
- lets the app restore the same sub-view after a reload

### 404 Handling Requirement

Violation detail must not navigate to a distinct route.

Instead:

- selecting a live alert or case sets the `case` query param
- the monitoring workspace opens the corresponding detail panel in-place
- if the case does not exist, does not belong to the exam, or is filtered out, the UI must show a soft empty state
- the app must never escalate this condition into a route-level 404 screen

## Monitoring Tab Visibility

The `Monitoring` tab should render only when `exam.enable_proctoring` is true.

If proctoring is disabled:

- do not show the tab
- do not render monitoring controls or internal monitoring sub-tabs
- existing links from exam lists should not offer `Monitor` actions for non-proctored exams

This keeps the exam detail UI aligned with the product rule chosen by the user.

## Monitoring Workspace Design

### Shared Header

The monitoring workspace should keep a compact shared header containing:

- exam name and subject context inherited from exam detail
- websocket connection status
- exam status badge
- actions:
  - `Pause Exam`
  - `Resume Exam`
  - `End Exam`

This header should appear once for the monitoring workspace, not be repeated inside each sub-tab.

### Overview

The `Overview` sub-tab is a supervisor dashboard, not a raw data table.

It should contain:

- KPI cards:
  - total candidates
  - in progress
  - completed
  - average progress
- selected webcam panel
- selected violation detail panel
- a short summary block for current live risk:
  - number of open alerts
  - number of open cases
  - number of offline or unstable candidates

It should not contain:

- a long alert feed
- the full candidate table
- the full violation history list

### Live Alerts

The `Live Alerts` sub-tab is for active supervision only.

It should show only live/open alert items from the snapshot stream. In practice this means the tab is backed by the monitoring snapshot and filtered to current alert records, not the full history view.

Required controls:

- search by candidate name or email
- filter by severity
- filter by event type
- pagination

Each row/card should show:

- candidate
- severity
- short message
- occurred time
- session id if available
- `View Violation` action when a linked case exists

Selecting `View Violation` should open the shared detail panel and synchronize `case=<id>` in the URL.

### Candidate Status

The `Candidate Status` sub-tab is the operational roster of exam participants.

Required controls:

- search by candidate name or email
- filter by session status:
  - `not_started`
  - `in_progress`
  - `submitted`
- filter by connection status:
  - `stable`
  - `unstable`
  - `offline`
- filter by webcam publish status:
  - `publishing`
  - `failed`
  - `stopped`
  - `unavailable`
- pagination

Each row should show:

- candidate identity
- status badge
- progress
- elapsed time
- last activity
- connection state
- webcam state
- screen evidence readiness
- actions:
  - `Open Webcam`
  - `View Violation` when the candidate has a latest linked case

The default sort should keep the highest operational priority first:

- in-progress before submitted and not-started
- unstable/offline before stable within the same exam-status group

### Violation History

The `Violation History` sub-tab is the historical review surface for the whole exam.

It should use the dedicated cases API, not the snapshot alert array.

Required controls:

- search
- status filter
- severity filter
- backend pagination
- export button for the current filtered result set

Each row/card should show:

- case id
- candidate
- severity
- status
- title
- summary
- event count
- evidence count
- resolved timestamp
- actions:
  - `View Details`
  - `Resolve`
  - `Dismiss`

`View Details` must open the in-page shared detail panel and set `case=<id>`.

## Violation Detail Panel

The violation detail panel is the authoritative inspection surface for one case.

It should be reusable from:

- `Overview`
- `Live Alerts`
- `Candidate Status`
- `Violation History`

Required content:

- case title
- candidate name and email
- severity badge
- status badge
- summary
- event count
- evidence count
- resolved timestamp
- resolution notes
- evidence previews:
  - webcam snapshot
  - screen capture
- actions for open cases:
  - `Resolve`
  - `Dismiss`

Behavior rules:

- if evidence is expired, render a clear expired placeholder
- if no evidence exists, render a no-evidence empty state
- if `case` query param points to an unavailable case, show a soft message rather than an app-level error

## Data Source Design

### Snapshot-Backed Views

The following sub-tabs should be driven from the realtime monitoring snapshot:

- `Overview`
- `Live Alerts`
- `Candidate Status`

These views may use client-side search/filter/pagination because the snapshot is already scoped to one exam and designed for live operational monitoring.

### Cases API-Backed View

`Violation History` should continue to use `/api/v1/proctoring/cases/` with backend filtering and pagination.

Supported query params should include:

- `exam`
- `status`
- `severity`
- `search`
- `page`
- `page_size`

This keeps the historical view scalable and avoids loading the complete case history into the snapshot payload.

## Export Design

### Output Format

Violation history export must be Excel:

- `.xlsx`

### Scope

The export must be scoped to the current exam and respect the active history filters.

Supported export filters should match `Violation History`:

- `exam`
- `status`
- `severity`
- `search`

### Recommended Endpoint

Add a backend endpoint such as:

- `GET /api/v1/proctoring/cases/export/`

Expected behavior:

- requires `proctoring.view`
- requires `exam`
- returns an Excel file built from the filtered queryset

### Export Columns

Recommended V1 columns:

- case id
- exam name
- subject
- candidate full name
- candidate email
- session id
- severity
- status
- title
- summary
- event count
- evidence count
- resolved at
- resolution notes

### Export Non-Goals

Do not embed image binaries into Excel in V1.

Reason:

- file size becomes unpredictable
- evidence may have already expired
- operationally, metadata export is the higher-value requirement

If evidence URLs are still available, V1 may include file URL columns, but the export should remain usable without them.

## Backend Design

### Existing Monitoring Snapshot Endpoint

Keep:

- `GET /api/v1/proctoring/exams/:id/monitoring/`

This remains the realtime data source for the live workspace.

### Existing Cases Endpoint

Keep:

- `GET /api/v1/proctoring/cases/`
- `POST /api/v1/proctoring/cases/:id/resolve/`

Extend only where needed for better filtering or export support.

### New Export Endpoint

Add:

- `GET /api/v1/proctoring/cases/export/`

Implementation recommendation:

- add a dedicated export view in `backend/apps/proctoring/api/views.py`
- keep queryset building shared with `ViolationCaseViewSet` to avoid duplicated filtering logic
- move shared filtering into a helper if needed
- place workbook creation in a focused helper module such as `backend/apps/proctoring/exporters.py`

### Backend Libraries

Use a lightweight Excel writer appropriate for Django server-side generation. The implementation should prefer a direct writer such as `openpyxl` over custom XML generation.

## Frontend Design

### Exam Detail Integration

`ExamDetail` becomes the host page for monitoring.

Responsibilities:

- determine whether `Monitoring` tab is visible
- persist selected tab and monitoring sub-tab in query params
- render the monitoring workspace inside the page

### Monitoring Component Refactor

The current `LiveMonitoring` page should be refactored into an embeddable monitoring workspace rather than a standalone route page.

Recommended component split:

- `LiveMonitoring.tsx`
  - container/workspace orchestrator
- `liveMonitoringShared.ts`
  - filter helpers, pagination helpers, formatting helpers
- `liveMonitoringExport.ts`
  - client-side download helper for the Excel endpoint

The objective is to keep the current working websocket and media logic, but split presentation concerns from orchestration.

### Links And Navigation

Places that currently link to `/exams/:id/monitor` should instead link to:

- `/exams/:id?tab=monitoring`

Potential sources:

- exam management list
- exam detail quick actions
- dashboard shortcuts

This preserves a single stable navigation model for monitoring.

## Error Handling

### Route-Level Errors

The monitoring redesign must remove route-level transitions for case detail so that violation inspection cannot trigger the React Router default application error screen.

### Data Errors

If monitoring data fails to load:

- keep the user inside exam detail
- show an inline error banner in the monitoring workspace
- do not replace the full app shell with a router error boundary screen

### Invalid Selected Case

If the selected `case` query param is invalid:

- clear the selected-case panel or show a non-blocking empty state
- keep the current tab and filters intact

### Export Errors

If Excel export fails:

- keep filters unchanged
- show a toast or inline error message
- do not trigger a broken file download

## Testing Strategy

### Frontend Tests

Add or update tests for:

- `ExamDetail` rendering `Monitoring` only when `enable_proctoring` is true
- monitoring tab deep links via query params
- `Live Alerts` search and pagination
- `Candidate Status` filters and pagination
- `Violation History` filter-driven loading
- selecting a violation case without route navigation
- invalid `case` query param producing a soft empty state instead of router failure
- export button triggering the Excel endpoint for the current filter set

### Backend Tests

Add or update tests for:

- case list filters by exam, status, severity, and search
- Excel export response headers and workbook payload
- export respecting active filters
- permission checks on export

### Browser Smoke Tests

Required smoke path:

1. open a proctored exam detail page
2. switch to `Monitoring`
3. open `Live Alerts`
4. open `Candidate Status`
5. open webcam for a candidate
6. open `Violation History`
7. filter by open cases
8. open violation detail
9. refresh the page
10. confirm the page restores without any router 404 screen

## Rollout Strategy

### Phase 1

- integrate monitoring into exam detail
- migrate all monitor links to query-based exam detail links

### Phase 2

- split live alerts, candidate status, and violation history into sub-tabs
- add filters and pagination

### Phase 3

- add Excel export for violation history
- finalize tests and refresh-safe deep-link behavior

The legacy `/exams/:id/monitor` route should be removed only after all links have been migrated.

## Risks And Controls

### Risk: `LiveMonitoring.tsx` becomes too large while gaining tabs and filters

Control:

- separate helpers and export logic into focused modules
- keep websocket/media orchestration isolated from presentation code

### Risk: Snapshot-based client filtering becomes heavy for very large exams

Control:

- use client-side filtering only for live scoped datasets
- keep historical review on the paginated backend cases endpoint

### Risk: Deep links become inconsistent between route state and query state

Control:

- centralize query-param reading and writing in the exam detail monitoring host
- never mix in separate monitoring routes for detail views

### Risk: Export implementation grows beyond the user need

Control:

- keep V1 export metadata-only
- do not embed evidence binaries in Excel

## Success Criteria

This redesign is successful when:

- proctored exams show a `Monitoring` tab inside exam detail
- non-proctored exams do not show monitoring
- `Live Alerts`, `Candidate Status`, and `Violation History` are distinct operational views
- each monitoring dataset has practical search, filters, and pagination
- violation detail opens in-place without route-level 404 failures
- admins can export filtered exam violations to Excel
