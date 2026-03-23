# Practice Isolation And Same-Origin Deploy Design

Date: 2026-03-23

## Goal

Introduce a true student practice mode that is fully isolated from live exam sessions, and standardize production deployment around a same-origin public topology that remains scalable for large candidate volumes.

## Current Context

- The current candidate area exposes:
  - `/candidate`
  - `/candidate/dashboard`
  - `/candidate/exams`
  - `/candidate/exams/:id/instructions`
  - `/candidate/exam/:id`
  - `/candidate/practice`
  - `/candidate/results`
- `/candidate/materials`
- `/candidate/notifications`
- The current `Practice` page is not a real practice domain.
  - the current practice page currently loads `/api/v1/my-exams/`
  - the CTA enters `/candidate/exam/:id`
  - the exam runner starts a real exam session via `/api/v1/exams/:id/start-session/`
- This means the current practice path can consume real attempts, real timing, and real monitoring behavior.
- Frontend runtime currently assumes either:
  - same-origin via Vite dev proxy, or
  - explicit `VITE_API_BASE_URL`
- Backend currently has no explicit CORS layer configured for production-style cross-origin browser traffic.
- The user has explicitly chosen:
  - practice must be separate from real exams
  - practice must pull from the question bank
  - production should optimize for large candidate scale and operational safety

## Product Decision

### Chosen Approach

Use a new practice domain with dedicated practice sessions and same-origin production delivery.

This means:

- practice becomes a first-class candidate feature, not a variation of assigned exams
- practice uses question-bank-driven random assembly
- practice sessions never create or mutate real `ExamSession`, `Submission`, `Result`, or proctoring data
- production presents one public origin to the browser
- frontend static assets, API, and websockets are routed under the same external domain

### Rejected Alternatives

#### Keep practice as a thin wrapper over live exams

Rejected because it preserves the current behavioral bug: practice affects real attempts and real exam state.

#### Build admin-curated practice sets first

Rejected for this phase because it increases scope and slows delivery. The design will remain extensible so curated sets can be added later.

#### Standardize on cross-origin frontend/backend for production

Rejected because it adds unnecessary browser failure modes in the exam runtime path, especially around authentication, preflight, autosave, and websocket stability.

## Scope

This design covers:

- a new isolated practice session domain
- candidate-facing practice configuration, session, and review flows
- production deploy topology for same-origin public access
- local development expectations for the new topology
- migration, testing, and rollout for this package

This design does not cover:

- deep result review for real published exam results
- bulk import/export redesign
- admin-created curated practice sets
- question-authoring enhancements beyond what practice needs

## Architecture Overview

The system should split candidate activity into two independent domains:

- real exam domain:
  - assignment-driven
  - attempt-limited
  - optionally proctored
  - produces real submissions and real results
- practice domain:
  - candidate-initiated
  - question-bank-driven
  - not proctored
  - produces only practice summaries and review data

The browser-facing production topology should be:

- `https://exam.example.com/` for frontend
- `https://exam.example.com/api/...` for HTTP API
- `https://exam.example.com/ws/...` for websocket traffic

Behind that single origin, app servers, websocket servers, workers, Redis, and the database may all scale independently.

## Practice Domain Design

### Core Principle

Practice must be isolated at the data model and API level, not just at the UI level.

No practice request may call:

- `/api/v1/my-exams/`
- `/api/v1/exams/:id/start-session/`
- `/api/v1/exam-sessions/...`
- real result publication or grading endpoints

### New Practice Models

Add a dedicated practice namespace, preferably under a new app such as `apps.practice` or a clearly separated module.

Recommended V1 models:

- `PracticeSession`
  - candidate user
  - subject
  - status: `in_progress`, `submitted`, `expired`, `abandoned`
  - question count
  - duration minutes
  - started at
  - expires at
  - submitted at
  - correct count
  - total count
  - score percentage
- `PracticeSessionQuestion`
  - parent practice session
  - source question id
  - frozen question text
  - frozen difficulty
  - frozen question type
  - frozen options
  - correct answer payload
  - explanation payload if available
  - chosen answer payload
  - answered flag
  - review metadata

V1 should support only auto-reviewable objective types:

- `multiple_choice`
- `true_false`

Do not include `essay` in random practice V1.

Reason:

- practice review is meant to be immediate and trustworthy
- essay without grading support produces a weak and misleading review experience

### Session Lifecycle

1. candidate opens practice landing page
2. candidate chooses subject, question count, duration, and difficulty mix
3. backend validates question-bank availability
4. backend creates a `PracticeSession` and snapshots selected questions
5. candidate answers questions in a dedicated practice runner
6. autosave persists within the practice domain only
7. submission finalizes the practice session
8. review endpoint returns correct answers, candidate answers, and summary metrics

## Practice Question Assembly

### V1 Candidate Configuration

The practice setup form should allow:

- subject
- total question count
- duration minutes
- difficulty distribution:
  - easy
  - medium
  - hard

Validation rules:

- total requested questions must equal the sum of difficulty counts
- each difficulty count must be zero or positive
- subject is required
- duration is required and bounded to a safe range
- backend must reject requests when the bank does not contain enough eligible questions

### Selection Rules

V1 selection should:

- pull only active, usable objective questions from the question bank
- filter by selected subject
- filter by requested difficulty counts
- randomize question selection
- freeze prompt/options/answers inside the practice session at creation time

Freezing is required so a practice attempt remains stable even if question-bank content changes later.

## Candidate UX Flow

### Practice Landing

Route:

- `/candidate/practice`

Responsibilities:

- configure a quick practice session
- show available subjects and question availability
- list resumable in-progress practice sessions
- show recent practice history with score and date

This page must stop presenting assigned exams as practice content.

### Practice Runner

Recommended route:

- `/candidate/practice/sessions/:id`

Responsibilities:

- show timer
- allow answer selection
- autosave progress
- allow question navigation
- submit the practice session

This runner may share view components with the live exam runner, but it must not share the live exam API adapter.

### Practice Review

Recommended route:

- `/candidate/practice/sessions/:id/review`

Responsibilities:

- show final score and percentage
- show correct versus incorrect counts
- show per-question review
- show candidate answer versus correct answer
- show explanation text when present in the source question

This review page is the core educational payoff of practice mode.

## API Design

Recommended V1 endpoints:

- `GET /api/v1/practice/catalog/`
  - returns candidate-usable subjects and question availability by difficulty
- `POST /api/v1/practice/sessions/`
  - creates a new practice session
- `GET /api/v1/practice/sessions/{id}/`
  - returns an in-progress or submitted session
- `PUT /api/v1/practice/sessions/{session_id}/answers/{question_id}/`
  - saves one answer
- `POST /api/v1/practice/sessions/{id}/autosave/`
  - stores lightweight progress metadata
- `POST /api/v1/practice/sessions/{id}/submit/`
  - finalizes the session and computes summary metrics
- `GET /api/v1/practice/sessions/{id}/review/`
  - returns review payload for submitted sessions
- `GET /api/v1/practice/history/`
  - returns recent sessions for the current candidate

### API Guardrails

- candidate users may access only their own practice sessions
- practice sessions may not be mutated after submission except read-only review access
- review payload should only be available after submission
- autosave and answer updates should reject expired or submitted sessions

## Relationship To Existing Candidate Area

The following live-exam routes remain unchanged:

- `/candidate/exams`
- `/candidate/exams/:id/instructions`
- `/candidate/exam/:id`

The following practice route changes behavior:

- `/candidate/practice`

Expected navigation behavior after implementation:

- `My Exams` is the only place that leads to real exams
- `Practice` is the only place that leads to practice sessions
- the two paths must be visually and behaviorally distinct

## Same-Origin Production Deploy Strategy

### Public Topology

Production should expose one public origin.

Example:

- frontend: `https://exam.example.com/`
- api: `https://exam.example.com/api/...`
- websocket: `wss://exam.example.com/ws/...`

This should be implemented with a reverse proxy or ingress layer that:

- serves static frontend assets
- forwards `/api` to the Django API service
- forwards `/ws` to the ASGI/websocket service

### Why Same-Origin Is The Standard

Benefits for large-scale exam operations:

- no browser CORS/preflight dependency in the exam runtime path
- simpler auth behavior for tokens and refresh flow
- fewer client-side failure modes during timed sessions
- easier CDN caching for static frontend assets
- clearer operational runbooks for support teams

### Internal Scaling Model

Same-origin outside does not mean monolith inside.

The following may scale independently:

- static asset delivery via CDN or edge cache
- Django API workers
- ASGI/websocket workers
- Celery workers for import/export and background jobs
- Redis
- PostgreSQL

### Local Development

Local development may continue using:

- Vite dev server on one port
- Django on another port
- Vite proxy for `/api` and `/ws`

This remains a developer convenience, not the production architecture standard.

### Cross-Origin Support Policy

Cross-origin browser deployment should not be the default production assumption.

If special environments need it:

- enable explicit CORS by environment
- use a strict allowlist
- never rely on permissive wildcard behavior for authenticated exam traffic

## Migration Strategy

This package should be additive.

Recommended migration approach:

- add new practice models and tables
- add new practice API routes
- replace practice page wiring in frontend
- keep real exam models and routes untouched

This reduces regression risk and simplifies rollback.

## Rollout Strategy

### Phase 1

- implement backend practice domain
- implement frontend practice setup, runner, and review
- rewire `/candidate/practice` to the new domain

### Phase 2

- document production same-origin deploy architecture
- document `/`, `/api`, `/ws` reverse-proxy assumptions
- add smoke tests for same-origin release topology

### Phase 3

- leave extension points for future curated practice sets
- do not build admin practice-set management yet

## Testing Strategy

### Backend Tests

Add coverage for:

- catalog availability
- session creation with valid and invalid difficulty mixes
- insufficient question-bank inventory
- answer save and autosave
- session submission and score computation
- review payload shape and correctness
- candidate access isolation
- explicit proof that practice does not create:
  - `ExamSession`
  - `Submission`
  - `Result`
  - proctoring records

### Frontend Tests

Add coverage for:

- practice setup form validation
- routing into practice session
- resume in-progress practice session
- review page rendering
- no linkage from practice to real exam API paths

### Browser Smoke Tests

Required smoke path:

1. login as candidate
2. open practice
3. create random practice session
4. answer a subset of questions
5. submit
6. open review
7. confirm real exam routes still work independently

## Risks And Controls

### Risk: Shared UI logic leaks real exam behavior into practice

Control:

- separate API adapters and route trees
- share only presentational components where practical

### Risk: Question bank lacks enough questions for some subjects

Control:

- catalog endpoint reports availability up front
- session creation returns structured validation errors

### Risk: Production deploy drifts back into accidental cross-origin

Control:

- document same-origin as the standard architecture
- make release smoke tests run against same-origin topology

## Future Extensions

The design should leave room for later additions:

- admin-curated practice sets
- subject/topic-level practice analytics
- explanation authoring improvements
- difficulty-adaptive practice

These are not required for this package.

## Success Criteria

This package is successful when:

- students can practice from the question bank without touching real exam attempts or results
- practice has its own session lifecycle and review flow
- production deployment is standardized on one public origin
- the live exam path continues to behave exactly as a real exam path
