# Exam Lifecycle And Runtime Governance Design

Date: 2026-03-25

## Goal

Redesign the exam lifecycle so the platform behaves consistently across:

- `draft`
- `scheduled`
- `open`
- `paused`
- `closed`
- `results` as a derived state

The redesign must:

- make monitoring and system alerts active only while an exam is actually running
- freeze active sessions when an exam is paused
- auto-submit active sessions when an exam is closed
- keep results hidden until admins explicitly publish them after grading, discipline, and certificate processing
- reduce background runtime load by shutting down non-essential hot paths outside the `open` phase

The user additionally requires:

- `Paused` means active sessions are frozen in time and cannot answer further
- `Closed` means active sessions are auto-submitted with the work completed so far
- `Results` is not a stored exam status; it is derived from `Closed + published results`
- schedule transitions should be automatic by default, but admins must still be able to intervene
- when resuming from `Paused`, admins may grant extra bonus time to all frozen sessions

## Current Context

The repository already has the primitives for exam delivery, monitoring, grading, discipline, and result publishing:

- `apps.exam_authoring` stores `Exam`, status, schedule window, and assignments
- `apps.exam_delivery` stores `ExamSession`, answers, autosave, and submission
- `apps.proctoring` stores heartbeat, monitoring, proctor events, evidence, and live-view control
- `apps.grading` stores computed results and publish state
- `apps.discipline` adjusts final scores and certificates after disciplinary review

The current logic is fragmented:

- candidate delivery logic mostly checks `Exam.status` and schedule window ad hoc
- session interaction logic checks `session.status` but not always the effective exam phase
- dashboard and monitoring surfaces include historical or inactive exams too broadly
- proctoring runtime continues to look structurally independent from exam lifecycle
- result publication can be reasoned about separately from exam closure

This creates both product inconsistencies and wasted runtime work.

## Product Decision

### Chosen Approach

Introduce a single backend lifecycle policy layer that determines the effective phase of each exam and gates all exam-runtime actions through that policy.

That means:

- `Exam.status` remains the durable admin-controlled status field
- `results` becomes a derived phase, not a persisted status
- all hot-path services ask the lifecycle policy what is allowed right now
- monitoring, alerts, heartbeats, live view, autosave, and interactive answer changes only run while the effective phase is `open`

### Why This Approach

This is the smallest change that fixes the root cause.

It avoids:

- spreading new `if exam.status == ...` branches across many modules
- adding a new persisted `results` enum that duplicates publish state
- keeping background monitoring alive for paused or closed exams

It also reduces load because only truly live exams retain hot runtime behavior.

### Rejected Alternatives

#### Patch every broken endpoint independently

Rejected because it would keep lifecycle rules duplicated across delivery, proctoring, dashboard, and frontend code.

#### Add `results` to the stored `Exam.status` enum

Rejected because results visibility is already a derived publishing concern, not an exam delivery phase.

#### Build a much larger `ExamRun` or multi-sitting model first

Rejected because that would be a broader product refactor than required for the current system behavior.

## Scope

This design covers:

- effective exam lifecycle resolution
- session freeze and resume behavior
- auto-submit on close
- monitoring and alert gating
- dashboard and candidate surfaces
- automatic schedule sync
- load reduction tied to inactive exam phases

This design does not cover:

- multi-run exam orchestration
- appeals workflow
- offline exam clients
- long-running video recording
- notification campaigns beyond status side effects already in place

## Success Criteria

The redesign is successful when:

- only `open` exams appear in live monitoring and system alert surfaces
- candidates cannot start or resume sessions before opening, during pause, or after closure
- paused sessions preserve remaining time and reject all answer mutations
- closed exams auto-submit all in-progress sessions
- published results only become candidate-visible after the exam is closed and results are published
- candidate-facing availability labels come from backend lifecycle semantics rather than loose frontend time heuristics
- paused and closed exams stop driving heartbeat, live-view, and other hot runtime paths

## Lifecycle Model

### Durable Statuses

Stored in `Exam.status`:

- `draft`
- `scheduled`
- `open`
- `paused`
- `closed`
- `archived`

### Derived Runtime Phase

Computed at runtime:

- `draft`
- `scheduled`
- `open`
- `paused`
- `closed`
- `results`

`results` is derived only when:

- exam durable status is `closed`
- and result visibility conditions are met through published result state

## Phase Semantics

### Draft

- used only for authoring and setup
- assignments, questions, and settings may be edited
- no candidate delivery
- no monitoring
- no system alerts

### Scheduled

- exam is prepared but not yet running
- candidates may see metadata and schedule
- no session start
- no autosave, heartbeat, proctoring, or live monitoring
- may auto-transition to `open` at `schedule_window.opens_at`
- admin may manually open or close earlier

### Open

- the only phase that supports active exam delivery
- candidates may start or resume sessions
- answers may be changed
- autosave is allowed
- heartbeats and proctoring runtime are allowed
- live monitoring and system alerts are allowed
- may auto-transition to `closed` at `schedule_window.closes_at`

### Paused

- all in-progress sessions are frozen
- session timers stop
- candidates cannot answer, autosave, submit manually, or send monitoring runtime updates
- live monitoring stops behaving as an active feed
- system alerts stop accepting new live events for the exam
- admin may reopen to `open` and optionally apply bonus time to all frozen sessions

### Closed

- no new starts or resumes
- all in-progress sessions are auto-submitted with current work
- hot monitoring runtime is turned off
- grading, discipline, and certificate workflows continue as back-office processes

### Results

- not stored on `Exam.status`
- only a derived presentation state
- candidates can view results only after the exam is closed and relevant results are published

## Lifecycle Rules By Operation

### Start Or Resume Session

- allowed only when effective phase is `open`
- `scheduled` returns “not open yet”
- `paused` returns “temporarily paused”
- `closed` and `results` return “exam has ended”

### Save Answer

- allowed only when exam phase is `open` and session is still interactive
- blocked during `paused`
- blocked after `closed`

### Autosave

- allowed only when exam phase is `open`
- blocked during `paused`
- blocked after `closed`
- should not create runtime work while the exam is inactive

### Manual Submit

- allowed only while exam phase is `open`
- blocked during `paused`
- not needed after `closed` because the close transition auto-submits

### Heartbeat And Presence

- allowed only while exam phase is `open`
- disabled for `scheduled`, `paused`, `closed`, and `results`

### Proctor Event And Evidence

- live proctoring event recording is active only while exam phase is `open`
- paused or closed exams do not emit new live alerts
- historical alerts remain accessible through audit, violation history, and discipline views

### Live View Tokens

- candidate publish tokens and admin view tokens may only be issued while exam phase is `open`
- paused or closed exams cannot occupy live-view slots

### Monitoring Snapshot

- active monitoring snapshots are meaningful only for `open` exams
- paused and closed exams should show a non-live status experience rather than a runtime feed

## Pause And Resume Model

### Required Session State

Add the following fields to `ExamSession`:

- `paused_at`
- `remaining_seconds_at_pause`

These fields allow pause and resume to be correct, auditable, and cheap to reason about.

### Open To Paused

For each `in_progress` session:

1. compute `remaining_seconds_at_pause = max(0, expires_at - now)`
2. set `paused_at = now`
3. keep the session row as the active attempt

The session is not “submitted” or “expired”. It is suspended by policy.

### Paused To Open

For each frozen session:

1. read `remaining_seconds_at_pause`
2. compute `expires_at = now + remaining_seconds_at_pause + bonus_minutes`
3. clear `paused_at`
4. clear `remaining_seconds_at_pause`

This preserves fairness and lets the admin compensate for downtime.

## Close And Auto-Submit Model

### Open Or Paused To Closed

When an exam is closed:

1. prevent any new starts or resumes immediately
2. gather all sessions still effectively active
3. auto-submit them with their current answers
4. release live-view runtime state
5. stop exam monitoring runtime for that exam

The submission should use a non-manual source, preferably a dedicated forced-close source if introduced. If a new source is not added in V1, the existing timeout-style source may be reused temporarily.

## Automatic Versus Manual Transitioning

### Automatic By Default

Lifecycle sync should automatically:

- open exams when `schedule_window.opens_at` is reached
- close exams when `schedule_window.closes_at` is reached

### Manual Override

Admins may still:

- open earlier
- pause manually
- resume manually
- close manually
- add bonus time when resuming

### Implementation Direction

Use a scheduled sync entry point such as:

- a management command
- or Celery beat task

Example responsibility:

- `sync_exam_lifecycle`

This is preferable to coupling schedule correctness to random user requests.

## Runtime Load Reduction

### Open Exams Only

The following hot paths should run only for `open` exams:

- candidate heartbeat
- runtime Redis presence updates
- monitoring websocket delta broadcasts
- proctor event creation for live monitoring
- live webcam token issuance
- dashboard live alert aggregation

### Paused Or Closed Exams

Paused and closed exams should no longer generate:

- active monitoring runtime
- hot presence updates
- live-view slot usage
- alert fan-out for real-time surfaces

Historical records remain queryable from slower admin workflows.

## Backend Architecture Changes

### New Lifecycle Policy Module

Add a new module such as:

- `backend/apps/exam_authoring/lifecycle.py`

Recommended functions:

- `resolve_exam_phase(exam, now=None)`
- `assert_exam_phase_allows_start(exam, now=None)`
- `assert_session_allows_interaction(session, now=None)`
- `exam_supports_proctoring_runtime(exam, now=None)`
- `exam_supports_live_monitoring(exam, now=None)`
- `exam_is_results_visible(exam)`

This module becomes the single source of truth for delivery and monitoring gating.

### New Transition Service

Add a service such as:

- `transition_exam_status(exam, next_status, actor, bonus_minutes=0, request=None)`

Valid transitions in V1:

- `draft -> scheduled`
- `draft -> open`
- `scheduled -> open`
- `scheduled -> closed`
- `open -> paused`
- `open -> closed`
- `paused -> open`
- `paused -> closed`

Responsibilities:

- validate transitions
- freeze sessions
- resume frozen sessions
- auto-submit on close
- clean up monitoring runtime state
- record audit events

## Required Backend Touch Points

### `apps.exam_delivery`

Update:

- `_assert_candidate_can_start()`
- `_assert_session_is_active()`
- `submit_session()`

Changes:

- gate all interactive delivery via lifecycle policy
- reject save and submit when exam is paused or closed
- preserve forced-close submission path for transition service

### `apps.proctoring`

Update:

- `record_heartbeat()`
- `record_proctor_event()`
- `issue_candidate_publish_token()`
- `issue_admin_view_token()`
- `build_exam_monitoring_snapshot()`
- monitoring hub queryset defaults

Changes:

- allow runtime operations only when exam phase is `open`
- default live monitoring to open exams only
- keep historical violation access in slower administrative views

### `apps.platform_core`

Update:

- `DashboardOverviewView`

Changes:

- `active_exams` should mean truly active delivery exams, not a mix of scheduled and paused records
- system alerts should only aggregate warning and critical alerts from `open` exams

### `apps.grading`

Update:

- result publication flow

Changes:

- result visibility should not be treated as available before exam closure
- `show_results_immediately` should not bypass the requirement that the exam must be closed before results become candidate-visible

### `apps.exam_delivery` Candidate APIs

Update:

- my-dashboard overview
- my-exams list
- session payload serializer

Changes:

- expose backend-computed lifecycle phase to frontend
- let frontend render availability from canonical server state instead of ad hoc time heuristics

## Frontend Changes

### Candidate Experience

Update:

- `src/app/pages/TakeExam.tsx`
- `src/app/pages/candidateExamShared.ts`
- `src/app/pages/CandidateDashboard.tsx`
- `src/app/pages/MyExams.tsx`

Changes:

- show paused-screen UX when exam is paused
- stop autosave, heartbeat, violation reporting, and manual submit while paused
- resume countdown after backend reopens the exam
- display availability buckets using backend lifecycle phase:
  - upcoming
  - open
  - paused
  - closed
  - results visible

### Admin Monitoring

Update:

- `src/app/pages/ExamMonitoringHub.tsx`
- `src/app/pages/LiveMonitoring.tsx`

Changes:

- default monitoring hub to open exams only
- remove the product impression that monitoring is always live
- when paused or closed, show exam status and administrative controls rather than a live runtime feed
- allow resume with bonus minutes

## Data Flow After Redesign

### Scheduled To Open

1. lifecycle sync sees `opens_at <= now`
2. exam transitions to `open`
3. candidate can start or resume
4. monitoring runtime becomes available

### Open To Paused

1. admin pauses exam
2. transition service freezes all active sessions
3. candidate clients stop interactive behavior
4. monitoring surfaces stop treating the exam as live

### Paused To Open

1. admin resumes exam with optional bonus minutes
2. transition service recomputes `expires_at` for frozen sessions
3. candidate clients can continue
4. monitoring runtime resumes

### Open Or Paused To Closed

1. lifecycle sync or admin closes exam
2. transition service auto-submits all active sessions
3. runtime monitoring for the exam is shut down
4. grading and discipline proceed
5. published results later expose the derived `results` phase

## Testing Strategy

### Backend

Add tests for:

- scheduled exam cannot start
- open exam can start and save answers
- paused exam rejects save, autosave, heartbeat, live tokens, and proctor events
- paused exam resumes with preserved remaining time plus bonus minutes
- closed exam auto-submits all in-progress sessions
- dashboard alerts exclude paused and closed exams
- monitoring hub defaults to open exams only
- result visibility requires exam closure plus publish state

### Frontend

Add tests for:

- candidate paused-screen behavior
- candidate availability labels by lifecycle phase
- monitoring hub default filter and copy for open-only live exams
- live monitoring action flow for pause, resume with bonus, and close

### Regression

Verify:

- discipline and certificates still recompute after forced-close submissions
- published results still update correctly after disciplinary penalties
- historical violation and discipline pages still expose past cases for closed exams

## Rollout Plan

Recommended order:

1. add lifecycle policy module
2. add `ExamSession` pause fields
3. add transition service and auto-sync command
4. gate exam delivery services through lifecycle policy
5. gate proctoring and monitoring through lifecycle policy
6. update dashboard and candidate APIs to expose canonical phase
7. update frontend candidate and monitoring pages
8. add lifecycle regression tests

This order fixes correctness first, then removes wasted runtime behavior, then aligns the UI.

## Risks And Controls

### Risk: inconsistent session state during manual transitions

Control:

- centralize transition logic in one service
- prohibit direct status mutations in random views

### Risk: candidates continue using stale frontend state during pause

Control:

- backend remains authoritative and rejects interaction during pause
- frontend adds clear paused-screen UX but does not act as sole enforcement

### Risk: forced-close submissions bypass downstream grading or discipline hooks

Control:

- reuse submission pipeline instead of inventing a separate grading path
- add regression tests around grading, discipline, and certificate recomputation

### Risk: results leak before closure

Control:

- tie candidate-visible result surfaces to lifecycle policy, not only `publish_state`

## Open Decisions Closed By User

The following decisions are fixed by user input:

- pause freezes active sessions and prevents further answers
- close auto-submits active sessions with completed work
- results is a derived state from `closed + published results`
- auto schedule transitions are the default
- admins may still intervene manually
- resume from pause may grant bonus time to all frozen sessions
