# Scalable Proctoring With Webcam Live And 15-Day Snapshot Retention Design

Date: 2026-03-23

## Goal

Redesign proctoring so the platform can support roughly 10,000 concurrent candidates with near real-time webcam monitoring, no video recording, violation-triggered webcam and screen snapshots, and automatic evidence deletion after 15 days.

## Current Context

- The current exam runtime already has working proctoring primitives:
  - candidate capability registration
  - candidate heartbeats
  - candidate proctor events
  - candidate evidence upload
  - admin monitoring snapshot view
  - admin monitoring websocket updates
- The current candidate exam page posts:
  - autosave every 30 seconds
  - heartbeat every 20 seconds
  - warning events on visibility changes
- The current backend persists:
  - `SessionHeartbeat`
  - `ProctorEvent`
  - `ProctorEvidence`
  - `ViolationCase`
  - `ViolationReview`
- The current admin monitoring page is not a media console.
  - it shows candidate progress, connection state, and alert cards
  - it does not show live webcam streams
- The current stack already includes:
  - Django REST
  - Channels + Redis
  - Celery + Redis
  - pluggable file storage with local filesystem or S3-compatible storage
- The user has explicitly chosen:
  - target around 10,000 concurrent candidates
  - all candidates are proctored
  - webcam must be viewable near real-time
  - video must not be recorded
  - screen does not need live streaming
  - when a violation happens, capture one webcam image and one screen image
  - evidence is retained for 15 days and then deleted automatically

## Product Decision

### Chosen Approach

Use a split architecture:

- `Django` remains the exam-control and evidence-control plane
- a dedicated self-hosted `WebRTC SFU` cluster becomes the webcam media plane
- no webcam or screen video is stored
- only violation snapshots are stored

This means the current app keeps responsibility for:

- exam session state
- proctoring rule evaluation
- alerting
- evidence metadata
- retention policy
- admin dashboard state

The media stack keeps responsibility for:

- candidate webcam publishing
- live subscription by proctors
- stream fan-out
- short-lived media access tokens

### Rejected Alternatives

#### Keep live webcam inside Django or Django Channels

Rejected because it makes the application tier carry media-plane bandwidth and fan-out, which is not a credible design for 10,000 concurrent proctored candidates.

#### Record all webcam or screen video and review later

Rejected because the user explicitly does not need stored video, and recording would dominate storage cost and complicate retention.

#### Stream both webcam and screen for every candidate

Rejected because the user only needs webcam live. Streaming screen for everyone would significantly increase bandwidth and client-side overhead with little added value for the chosen moderation workflow.

## Scope

This design covers:

- scalable webcam live proctoring
- violation-triggered evidence snapshots
- 15-day evidence retention and deletion
- candidate-side browser capture constraints
- admin-side monitoring flow changes
- production deployment boundaries for the media and control planes

This design does not cover:

- AI face analysis or behavior scoring
- long-term archival policies
- recording, replay, or downloadable video assets
- bulk import/export redesign
- practice-mode changes
- public cloud managed media services as the primary deployment target

## Architecture Overview

### Control Plane

The Django application remains the system of record for:

- `ExamSession`
- `SessionHeartbeat`
- `ProctorEvent`
- `ProctorEvidence`
- `ViolationCase`
- `ViolationReview`

New control-plane responsibilities should include:

- issuing short-lived media credentials for the webcam stream
- tracking media publish status for each exam session
- deciding when evidence capture is required
- storing evidence metadata including retention deadline
- scheduling deletion of expired evidence

### Media Plane

A self-hosted SFU should carry candidate webcam streams.

Requirements:

- candidates publish webcam only
- admins subscribe only on demand
- no media recording at the SFU layer
- stream access must be scoped to an exam session and role

Operational assumption:

- the system does not attempt to render 10,000 webcam tiles to proctors at once
- proctors see all candidates through state, alerts, and ranking data
- live webcam subscriptions are opened only for flagged or selected candidates

This assumption is required for cost and bandwidth discipline.

### Browser Constraint That Drives The Design

Screen snapshots on violation cannot be captured reliably unless the browser has already been granted screen-capture access earlier in the session.

Therefore, for proctored exams that require screen evidence:

- the candidate client must request screen-share permission during exam startup
- the screen stream is kept locally for snapshot extraction only
- the screen stream is not uploaded live

If the candidate revokes screen sharing:

- the client must emit a critical proctoring event
- subsequent screen snapshots may be unavailable until permission is restored

## Candidate Runtime Design

### Startup Flow

When a proctored live exam starts:

1. candidate opens the real exam runner
2. the client requests webcam permission
3. the client requests screen-share permission
4. the client registers capability with Django
5. the client requests a short-lived media publish token from Django
6. the client publishes webcam to the SFU
7. the client begins heartbeat and violation detection

If webcam permission is denied:

- the exam should not enter proctored mode
- the UI should block start with a clear message

If screen-share permission is denied:

- the UI should block start if screen evidence is mandatory for that exam policy
- otherwise the session can continue only if product policy explicitly allows degraded monitoring

Recommended V1 policy:

- treat screen-share denial as blocking for proctored exams that require screen evidence

### Ongoing Runtime Behavior

The candidate client continues to:

- autosave exam answers using the current exam APIs
- send heartbeats at a tuned interval
- emit rule-based events for visibility changes, fullscreen exit, connectivity instability, and capture failures

The candidate client additionally:

- maintains a live webcam publish connection to the SFU
- keeps a local screen capture stream for snapshot extraction only
- captures violation snapshots without uploading video

## Violation Evidence Design

### Trigger Conditions

V1 should capture evidence on at least:

- fullscreen exit
- tab switch or hidden document
- screen-share ended unexpectedly
- explicit manual alert from the client

Each qualifying violation should produce:

- one webcam snapshot from the current webcam track
- one screen snapshot from the current screen-share track, if available

### Evidence Storage Model

`ProctorEvidence` should be extended so retention can be enforced explicitly.

Recommended additional fields:

- `expires_at`
- `deleted_at` or an equivalent tombstone
- storage metadata needed for safe deletion and audit

Evidence types remain:

- `webcam_snapshot`
- `screen_capture`

No new stored type for video should be introduced in this package.

### Retention Policy

Retention rule:

- snapshot evidence lives for 15 days from capture
- expired evidence is deleted from object storage
- the database record is either soft-deleted or retained as metadata-only, depending on operational preference

Recommended V1 behavior:

- remove the file object
- retain minimal metadata and timestamps for auditability
- mark the record as deleted

This keeps the moderation trail without retaining the sensitive media longer than required.

## Admin Monitoring Design

### Monitoring Dashboard Model

The current monitoring page should remain the primary operational console for:

- exam-wide counts
- candidate progress
- connection status
- recent alerts
- violation cases

It should be upgraded to support:

- live webcam open for a selected candidate
- candidate prioritization based on recent critical or warning events
- indication of whether webcam live is currently available
- indication of whether screen evidence is available

### Live Viewing Policy

Admins should not auto-subscribe to all candidate streams.

Instead:

- the dashboard shows a ranked list of candidates
- admins open live webcam only for the candidates they choose
- flagged candidates should be easier to open quickly

This keeps the UI useful while preventing a monitoring workstation from becoming the actual scale bottleneck.

### Evidence Review

Violation cases should surface:

- linked warning or critical events
- linked webcam snapshots
- linked screen snapshots
- timestamps
- review decision history

This preserves the current case-review model and deepens it with better evidence.

## API Boundary Design

### Existing Endpoints To Keep

Keep and reuse:

- candidate capability registration
- candidate heartbeat endpoint
- candidate event endpoint
- candidate evidence upload endpoint
- admin monitoring snapshot endpoint
- violation case list and resolve endpoints

### New Endpoints Recommended

Add control-plane endpoints for media session management:

- `POST /api/v1/proctoring/sessions/{session_id}/media/publish-token/`
  - returns short-lived credentials or parameters for candidate webcam publish
- `POST /api/v1/proctoring/sessions/{session_id}/media/view-token/`
  - admin-only
  - returns short-lived credentials for viewing a selected candidate webcam
- `POST /api/v1/proctoring/sessions/{session_id}/media/status/`
  - candidate reports webcam publish health and screen-capture availability

These endpoints must remain lightweight and must not proxy media bytes through Django.

### Event And Evidence Coupling

For violation-triggered captures:

1. candidate emits violation event
2. backend creates or links a `ViolationCase`
3. candidate uploads webcam snapshot
4. candidate uploads screen snapshot when available
5. uploaded evidence links back to the triggering event and case

This preserves causal traceability.

## Deployment Strategy

### Public Topology

Production should still expose one public origin for the application experience:

- `https://exam.example.com/` for frontend
- `https://exam.example.com/api/...` for Django API
- `https://exam.example.com/ws/...` for app websockets

The media plane can sit behind the same domain via routing such as:

- `https://exam.example.com/media-signal/...`
- `wss://exam.example.com/media/...`

or behind a tightly controlled sibling origin if the chosen SFU requires it.

The key rule is:

- the browser-facing exam app remains operationally same-origin by default
- media routing may be specialized behind the ingress layer without pushing media through Django

### Internal Services

Recommended production units:

- frontend static delivery
- Django API service
- ASGI websocket service for app events
- Redis
- PostgreSQL
- Celery worker and beat
- S3-compatible object storage
- SFU nodes for webcam media

The SFU layer should scale horizontally independent of Django workers.

## Data Lifecycle And Background Jobs

Celery should handle:

- periodic deletion of expired evidence files
- cleanup retries on transient storage failures
- optional backfill of evidence records missing retention metadata

Deletion safety requirements:

- delete file from storage first
- then mark database record as deleted
- log failures with enough metadata for retry

If storage deletion fails:

- keep the record in a retryable state
- do not silently drop the database reference

## Performance And Load Strategy

### Candidate Control-Traffic Budget

Django should continue handling:

- heartbeats
- alerts
- snapshot uploads
- exam answer autosave

This is acceptable at 10,000 concurrent candidates only if:

- heartbeat intervals are conservative
- snapshot uploads are rare and event-driven
- media traffic is kept off the app tier

### Admin Viewing Budget

Operational policy should assume:

- many candidates are connected
- comparatively few live webcam streams are being watched simultaneously

The system should be designed around selective observation, not wall-of-video monitoring.

### Storage Budget

Because video is not recorded:

- storage growth is driven by violation frequency, not session duration
- object storage remains economically feasible
- the 15-day TTL prevents evidence accumulation

## Rollout Strategy

### Phase 1

- extend the proctoring control plane for media status and retention metadata
- add evidence expiration support
- add background deletion job

### Phase 2

- add candidate webcam publish flow
- add local screen stream handling for violation snapshots
- keep the current monitoring page functional during rollout

### Phase 3

- add admin selected-candidate webcam viewing
- add live availability indicators and better prioritization in monitoring

### Phase 4

- perform load validation on the control plane and selected-stream monitoring workflow
- tune heartbeat, alert, and evidence-upload behavior

## Testing Strategy

### Backend Tests

Add coverage for:

- media token issuance permission checks
- event-to-case linking
- evidence retention metadata defaults
- deletion task behavior
- deletion retry behavior
- candidate isolation on media status APIs
- admin-only access to view-token APIs

### Frontend Tests

Add coverage for:

- permission gating before entering a proctored exam
- blocking behavior on denied webcam or screen-share
- violation-triggered snapshot upload flow
- degraded-state UI when webcam or screen capture fails
- admin monitoring live-view controls

### Verification Beyond Unit Tests

Required verification for this package:

- browser smoke test for candidate startup with webcam and screen permissions
- browser smoke test for fullscreen-exit violation and snapshot upload
- browser smoke test for admin opening a selected candidate webcam
- load-test plan for Django control endpoints independent of media bitrate tests

## Risks And Controls

### Risk: Browser screen capture is unreliable without prior permission

Control:

- request screen sharing up front
- treat loss of screen stream as a critical event
- surface a clear operator-facing signal when screen evidence is unavailable

### Risk: Admin expectations drift toward viewing everyone live at once

Control:

- design the dashboard around triage, ranking, and selective live viewing
- document operational limits explicitly

### Risk: Evidence deletion leaves orphaned files or orphaned records

Control:

- make deletion idempotent
- use Celery retries
- keep deletion status in the database

### Risk: Media-plane outages spill into exam-control failures

Control:

- isolate media token issuance from core exam state
- degrade monitoring separately from autosave and submission
- keep the real exam session system independent of SFU internals

## Success Criteria

This package is successful when:

- 10,000 concurrent candidates can use proctored exams without routing webcam traffic through Django
- webcam is viewable near real-time for selected candidates
- no webcam or screen video is stored
- violation-triggered webcam and screen snapshots are captured and linked to cases
- evidence is automatically deleted after 15 days
- the current case-review and monitoring flow gains evidence depth without losing operational stability
