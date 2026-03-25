# Single-VPS On-Demand Live Proctoring Design

Date: 2026-03-25

## Goal

Redesign exam delivery and proctoring so the current product can target roughly 1,000 or more concurrent candidates on a single VPS with:

- 4 vCPU
- 4 GB RAM
- 30 GB NVMe
- 500 Mbps shared network

while keeping webcam and screen capture available locally on the candidate machine, and only turning on live webcam publishing when an admin explicitly requests to view a candidate.

The user additionally requires:

- webcam live must not run by default
- candidate webcam and screen streams stay local unless live view is requested
- webcam and screen images are stored only when the candidate triggers an error or violation

## Current Context

- The candidate exam page currently starts proctoring eagerly and publishes webcam at exam start.
- The candidate runtime currently sends:
  - autosave every 30 seconds
  - heartbeat every 20 seconds
- The backend currently persists:
  - `SessionHeartbeat`
  - `AutosaveSnapshot`
  - `ProctorEvent`
  - `ProctorEvidence`
  - `ViolationCase`
  - `ViolationReview`
- The admin monitoring page currently polls and reloads snapshot data frequently.
- The stack already includes:
  - Django REST
  - Channels + Redis
  - Celery
  - PostgreSQL support
  - LiveKit support

The current hot paths are too write-heavy for the target on a single VPS because ordinary exam runtime creates frequent database writes even when nothing exceptional is happening.

## Product Decision

### Chosen Approach

Use a split runtime inside one VPS:

- Django + PostgreSQL remain the durable control plane
- Redis becomes the hot state plane
- LiveKit remains available but is idle by default
- candidate browser keeps webcam and screen streams local by default
- admin-triggered live view turns webcam publishing on only for the selected candidate
- evidence images are stored only on error or violation events

This is a local-by-default, publish-on-demand model.

### Why This Approach

This design removes the two biggest scalability problems in the current implementation:

1. normal exam activity should not continuously create database rows
2. normal candidates should not continuously publish live webcam media

That lets the VPS spend most of its resources on active exam delivery rather than idle monitoring traffic.

### Rejected Alternatives

#### Keep the current eager webcam publish model

Rejected because even if only a few admins are watching, every candidate would still maintain unnecessary media-plane activity.

#### Keep database-backed heartbeat and autosave snapshots as the runtime source of truth

Rejected because it burns I/O and CPU on low-value writes and makes the database the bottleneck far too early.

#### Remove webcam and screen permissions until an admin requests live view

Rejected because the browser must already have local capture permission if the system needs to capture evidence immediately when a violation happens.

## Scope

This design covers:

- single-VPS scaling strategy
- on-demand webcam live publishing
- local-only default webcam and screen capture
- Redis-backed hot state
- reduced database write pressure
- violation-only evidence storage
- monitoring UI changes
- hard operational limits suitable for the target VPS

This design does not cover:

- multi-node clustering
- AI proctoring
- stored video recording
- long-term archival
- mobile native clients

## Success Criteria

The design is successful when:

- the system can realistically target 1,000 to 1,200 concurrent candidates on one VPS under the specified constraints
- webcam live is only active for candidates explicitly selected by admins
- the system stores no routine webcam or screen images during normal operation
- webcam and screen images are stored only for error or violation events
- the monitoring dashboard remains usable without full snapshot reload loops
- PostgreSQL no longer receives continuous heartbeat and periodic autosave row creation from every candidate

## Architecture Overview

### Durable Control Plane

Django and PostgreSQL remain the system of record for:

- exam sessions
- answers
- submissions
- materialized proctoring events
- stored evidence metadata
- violation cases and reviews
- slow-changing media state

The durable control plane is responsible for correctness, auditability, and submission integrity.

### Hot State Plane

Redis becomes the runtime source for short-lived operational state:

- candidate online presence
- candidate current connection state
- candidate current question index
- live-view requests
- currently occupied live-view slots
- per-exam monitoring deltas

The hot state plane is responsible for cheap updates and near-real-time operator feedback.

### Media Plane

LiveKit remains available on the same VPS but is used only for the narrow case of selective viewing.

Normal candidates do not connect and publish webcam media at exam start. They publish only after an admin requests live view and stop publishing when the view session ends or times out.

## Candidate Runtime Design

### Startup

When a proctored exam starts:

1. candidate opens the exam runner
2. browser requests webcam, microphone, and screen-share permission
3. candidate client stores the local media tracks
4. candidate client registers device capability once
5. candidate client opens the exam control channel
6. candidate client does not request a publish token and does not connect to LiveKit yet

This preserves evidence readiness without incurring live media cost.

### Normal Exam Operation

During ordinary exam activity:

- webcam stays local
- screen track stays local
- no routine snapshots are stored
- no live media is published
- answers are saved on meaningful changes
- lightweight presence is refreshed through Redis-backed heartbeats

### Violation And Error Handling

Evidence is stored only when the candidate triggers a violation or capture-related error.

The triggering classes in V1 are:

- tab switch
- fullscreen exit
- unexpected screen-share end
- manual alert
- other explicit proctoring failures classified by product policy as alert-worthy

For those triggers:

1. client records a `ProctorEvent`
2. client captures one local webcam image
3. client captures one local screen image when screen track is available
4. images are compressed before upload
5. images are uploaded and linked to the event and related violation case

No ordinary heartbeat, answer save, or routine exam activity should create image evidence.

## Live View Design

### Default Behavior

Candidates are not live-streaming webcam by default.

### Admin-Initiated View

When an admin chooses to view a candidate camera:

1. admin clicks `View camera`
2. backend checks live-view quota
3. backend marks a live request in Redis
4. backend notifies the candidate client over the control channel
5. candidate client requests a publish token
6. candidate client connects to LiveKit and publishes webcam
7. admin receives a view token and joins the room

When the admin closes the view, the backend sends a stop signal and the candidate client disconnects from LiveKit.

### Live View Quotas

The system must hard-limit live viewing to protect the VPS:

- maximum concurrent live streams system-wide: 5
- recommended per-exam live-view cap: 2 to 3
- maximum admin viewers per candidate stream: 1 in V1

If the quota is exhausted, the UI must show that no live slot is available.

## Database Write Reduction

### Heartbeats

The current database-backed heartbeat flow must be removed from the normal runtime path.

New behavior:

- candidate sends presence heartbeat every 45 to 60 seconds
- backend refreshes Redis TTL
- backend writes PostgreSQL only on material state transitions, such as:
  - candidate became offline beyond threshold
  - candidate reconnected after offline state
  - live view started
  - live view stopped
  - violation occurred
  - capture failed

`SessionHeartbeat` may remain for audit snapshots, but it is no longer the sink for every periodic ping.

### Autosave

The current periodic `AutosaveSnapshot` creation must be removed from the ordinary path.

New behavior:

- multiple choice answers save on selection or question change
- essay answers save with debounce
- dirty essay state flushes on blur, question change, submit, and forced interval
- if a "last saved" indicator is needed, it should be derived from response timestamps, not new snapshot rows

`AutosaveSnapshot` can be retained only for exceptional recovery cases or removed from the hot path entirely.

## Redis State Model

Recommended key strategy:

- `presence:session:{id}`
  - value: `online`
  - TTL: 150 seconds
- `monitor:session:{id}`
  - hash fields:
    - `question_index`
    - `connection_status`
    - `camera_ready`
    - `screen_ready`
    - `live_state`
    - `updated_at`
- `monitor:exam:{exam_id}:sessions`
  - active session set
- `live:req:session:{id}`
  - current live-view request state
- `live:slots`
  - active live-view slot occupancy
- `monitor:delta:exam:{exam_id}`
  - small operator-facing change feed

This design makes Redis the runtime state cache and removes pressure from PostgreSQL.

## Monitoring UI Design

The admin monitoring experience should become delta-driven rather than full-snapshot-driven.

### Required Changes

- remove frequent 5-second full polling as the main refresh mechanism
- stop reloading the full monitoring snapshot after every small websocket event
- load a full snapshot only:
  - on initial page load
  - on manual refresh
  - on occasional long refresh interval if needed
- consume websocket deltas for:
  - presence changes
  - answer progress changes
  - violation alerts
  - live-view availability changes

### Candidate View State

For each candidate row, the UI should show:

- online presence
- current progress
- camera permission readiness
- screen-share readiness
- whether a live slot is currently active
- whether a live slot is available to request

## Evidence Policy

### Storage Rules

Store evidence only when the candidate produces an error or violation event.

Do not store:

- periodic webcam images
- periodic screen images
- routine monitoring thumbnails
- normal-operation snapshots

### Encoding Rules

To protect CPU, disk, and bandwidth:

- convert routine evidence uploads from PNG to JPEG or WebP
- resize before upload
- target 150 KB to 250 KB per image
- cap width around 960 to 1280 pixels

### Retention Rules

Because the VPS only has 30 GB NVMe, local retention must be conservative.

Recommended production rule on this VPS:

- 3 to 7 days of evidence retention by default

If 15-day retention is mandatory, the system must accept a much lower evidence volume ceiling or move evidence to separate object storage.

## Runtime Configuration For The VPS

Use one VPS with direct services, not a development-style deployment.

Recommended processes:

- `nginx`
- `Django ASGI app`
- `PostgreSQL`
- `Redis`
- `Celery worker`
- `Celery beat`
- `LiveKit`

Recommended operational posture:

- PostgreSQL local, not SQLite
- small worker counts
- low Celery concurrency
- swap enabled at 4 to 8 GB as emergency headroom
- LiveKit treated as a low-concurrency selective-view component

## Hard Limits

The following limits should be environment-backed and enforced:

- heartbeat interval: 60 seconds
- presence TTL: 150 seconds
- max concurrent live views: 5
- max live views per exam: 2 to 3
- essay debounce: 25 seconds
- forced dirty flush: 90 to 120 seconds
- evidence width cap: 1280 pixels
- evidence target size: 150 KB to 250 KB per image
- max evidence uploads per triggering event: 2
- monitoring candidate page size: 50 to 100

These are part of the design, not optional tuning details.

## Rollout Plan

### Phase 1: Reduce Database Pressure

- remove periodic heartbeat row creation
- remove periodic autosave snapshot row creation
- move hot presence state to Redis

### Phase 2: Add Publish-On-Demand

- stop publishing webcam at exam start
- add admin-triggered live request flow
- add live-view quotas

### Phase 3: Convert Monitoring To Delta-Driven

- remove 5-second full snapshot polling as the default path
- add websocket deltas
- retain full snapshot only for initial load and manual recovery

### Phase 4: Evidence And Operational Hardening

- compress evidence images
- tune retention
- add metrics and resource alerts

## Testing Strategy

### Functional Tests

Add coverage for:

- candidate starts proctored exam without default webcam publishing
- admin requests live view and candidate begins publishing
- admin closes live view and candidate stops publishing
- violation creates exactly one webcam and one screen image when available
- ordinary exam activity does not create evidence records

### Load Tests

Run controlled tests for:

- 1,000 concurrent active candidates
- 45 to 60 second heartbeat
- answer-save traffic under normal usage
- zero live views
- 3 to 5 live views concurrently

### Failure Tests

Validate behavior when:

- Redis restarts
- LiveKit restarts
- PostgreSQL slows down
- candidate loses connectivity
- candidate revokes screen share

## Expected Capacity

After the redesign, the target operating envelope for the specified VPS is:

- 700 to 900 concurrent candidates as a conservative operating band
- 1,000 to 1,200 concurrent candidates as a stretch goal that requires load validation
- more than 1,200 concurrent candidates should not be promised on this hardware
- 3 to 5 concurrent live webcam sessions should be treated as the practical maximum

These estimates assume:

- PostgreSQL, not SQLite
- no eager webcam publishing
- Redis-backed presence
- reduced monitoring reload behavior
- evidence saved only for error or violation events

## Risks And Controls

### Risk: Admins request too many live streams at once

Control:

- enforce hard quotas
- expose slot exhaustion clearly in the UI

### Risk: Monitoring UI still performs heavy reloads

Control:

- migrate to websocket deltas
- make full refresh explicit and infrequent

### Risk: Disk fills from evidence accumulation

Control:

- compress images
- reduce retention
- alert on disk usage

### Risk: Redis becomes a silent dependency

Control:

- define degraded behavior explicitly
- fall back to conservative operator messaging if hot state is unavailable

## Open Implementation Notes

- Existing `SessionHeartbeat` and `AutosaveSnapshot` models may remain for compatibility, but must leave the hot path.
- Existing `ProctoringMediaState` can remain the durable media state record, but should only reflect important transitions.
- Existing candidate evidence upload flow can be retained after adding image compression and stricter trigger rules.
- Existing LiveKit token flow can be retained after moving it from exam startup to admin-triggered activation.
