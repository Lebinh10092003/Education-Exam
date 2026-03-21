# EduExam Django API Backend Design

**Date:** 2026-03-21

**Status:** Approved design baseline for implementation planning

## Context

Current project state:

- The existing codebase is a standalone `React/Vite` frontend.
- UI screens already exist for login, dashboard, users, groups, subjects, question bank, exams, assignment, live monitoring, candidate exam flow, materials, reports, and profile.
- The frontend currently uses mock data embedded directly in components.
- The backend will be added as a separate `Python/Django` API project and the frontend will gradually switch from mock data to live API calls.

Business context:

- The system is operated by one organizing body (`single-tenant` deployment).
- Candidates can come from many schools.
- The platform must support current roles and future role expansion.
- The platform must support a full online exam lifecycle, including proctoring, grading, reporting, and study materials.

## Goals

- Build a production-shaped backend for the existing UI.
- Keep the frontend as an independent SPA and expose all backend capabilities through APIs.
- Support JWT-based authentication for the React client.
- Support flexible authorization with a mix of system roles and custom roles.
- Support exam authoring, assignment, candidate sessions, autosave, submission, scoring, manual grading, monitoring, reporting, and materials.
- Support object storage for media and files.
- Support realtime monitoring and exam session updates.
- Leave a clean integration path for a future native safe exam browser or desktop agent.

## Non-Goals

- Serving the frontend from Django.
- Implementing full native kiosk or OS-level lockdown in the web phase.
- Building true multi-tenant isolation in the first architecture.
- Making reporting depend directly on heavy transactional queries at runtime.

## Architecture

Frontend and backend topology:

- `React/Vite SPA` remains a separate app.
- `Django + Django REST Framework` provides the REST API.
- `SimpleJWT` provides access and refresh tokens.
- `PostgreSQL` stores transactional and reporting data.
- `Redis` supports caching, channels, and Celery.
- `Celery` runs asynchronous jobs.
- `Django Channels` provides WebSocket support for realtime features.
- `S3-compatible object storage` stores materials, exports, media evidence, and large file artifacts.

Operational shape:

- Backend is the source of truth for permissions, exam timing, attempt rules, grading state, and proctoring events.
- Frontend is a thin client for state display, user input, and media capture where browser capabilities allow it.
- Realtime updates are used for live monitoring, heartbeat state, autosave acknowledgements, and session state changes.
- Media-heavy and export-heavy flows are processed asynchronously.

## Technology Decisions

- API style: versioned REST under `/api/v1/...`
- Auth: JWT access/refresh tokens
- Persistence: PostgreSQL
- Cache and broker: Redis
- Background processing: Celery
- Realtime: Django Channels over WebSocket
- Media storage: S3-compatible object storage
- Deployment shape: production-ready service separation from the start

## Core Bounded Contexts

The backend should be split into focused Django apps instead of one large monolith module.

Recommended app layout:

- `platform_core`
- `identity`
- `institutions`
- `academics`
- `question_bank`
- `exam_authoring`
- `exam_delivery`
- `grading`
- `proctoring`
- `materials`
- `reporting`
- `notifications`

Responsibilities:

### `platform_core`

- Shared abstract models
- request and correlation IDs
- audit helpers
- common enums
- health checks
- system settings

### `identity`

- custom user model
- profile data
- JWT auth endpoints
- system roles
- custom roles
- permissions
- user-role assignments
- password reset and account state

### `institutions`

- schools
- candidate groups
- group memberships
- group import and bulk assignment support

### `academics`

- subjects
- future academic metadata tied to subjects

### `question_bank`

- questions
- question revisions
- options
- answer keys
- rubrics
- tags
- import jobs and validation errors

### `exam_authoring`

- exams
- exam drafts and versions
- exam items
- random question rules
- scheduling settings
- assignment-ready publication rules

### `exam_delivery`

- assignments
- eligibility
- exam sessions
- answers
- autosave snapshots
- final submissions
- timing and attempt enforcement

### `grading`

- auto-scoring
- essay grading tasks
- reviewer grading actions
- grading adjustments
- final score consolidation

### `proctoring`

- session heartbeat
- browser capability registration
- violation events
- evidence files
- case review workflow
- safe exam browser integration hooks for future native client support

### `materials`

- study materials
- file metadata
- download logs

### `reporting`

- result snapshots
- dashboard aggregates
- export jobs
- downloadable report artifacts

### `notifications`

- system notifications
- email notifications
- async delivery jobs

## Domain Model

### Identity and Access

- `User`
- `Profile`
- `Role`
- `Permission`
- `RolePermission`
- `UserRole`
- `RefreshTokenAudit`

Design rules:

- Keep a custom `User` model from day one.
- Support both fixed system roles and custom roles.
- Treat permissions as first-class records, grouped by module and action.
- Allow role expansion later without rewriting the authorization layer.

### Institutions and Participation

- `School`
- `CandidateGroup`
- `GroupMembership`

Design rules:

- The platform is not multi-tenant.
- `School` is a participating institution, not a tenant boundary.
- Candidates, group memberships, and reporting can be filtered by school.

### Academic Catalog

- `Subject`

### Question Bank

- `Question`
- `QuestionRevision`
- `QuestionOption`
- `QuestionAnswerKey`
- `QuestionTag`
- `QuestionImportBatch`
- `QuestionImportError`

Design rules:

- Questions are mutable over time, but exams must bind to a frozen revision.
- `QuestionRevision` stores immutable content used by authored exams and candidate sessions.
- Objective questions store machine-checkable answer keys.
- Essay questions store rubric and grading guidance for manual review.

### Exam Authoring

- `Exam`
- `ExamVersion`
- `ExamItem`
- `ExamQuestionSelectionRule`
- `ExamScheduleWindow`
- `ExamAssignmentPolicy`

Design rules:

- Exam authoring must support both manual and random question selection.
- An exam should be publishable only when it is internally valid.
- Authoring changes after publication should create a new version or be restricted by workflow.

### Assignment and Delivery

- `ExamAssignment`
- `CandidateEligibility`
- `ExamSession`
- `SessionQuestion`
- `SessionAnswer`
- `AutosaveSnapshot`
- `Submission`

Design rules:

- `ExamSession` is the center of candidate activity.
- Each session owns its question order, timing state, and answer state.
- Session timing is computed by the backend.
- Autosave stores authoritative progress state.
- Submission must be idempotent and tamper-resistant.

### Grading

- `AutoScore`
- `ManualGradingTask`
- `ManualGrade`
- `ScoreAdjustment`
- `Result`
- `ResultPublishRecord`

Design rules:

- Objective questions are scored automatically on submission.
- Essay questions create manual grading tasks.
- Final result is generated only after all required grading work is complete or explicitly overridden.

### Proctoring

- `ClientCapability`
- `SessionHeartbeat`
- `ProctorEvent`
- `ProctorEvidence`
- `ViolationCase`
- `ViolationReview`

Design rules:

- The browser client provides best-effort monitoring only.
- Proctoring data is attached to `ExamSession`.
- Web client and future native client must be able to emit compatible event structures.
- Evidence assets are stored outside the database, with metadata and signed access rules.

### Materials and Reporting

- `Material`
- `MaterialAsset`
- `MaterialDownloadLog`
- `DashboardSnapshot`
- `ReportExportJob`
- `ResultExportArtifact`

## API Design

Base conventions:

- Prefix all endpoints with `/api/v1/`
- Use pagination for all list endpoints
- Support search and filter parameters where the UI requires them
- Return structured validation errors
- Use resource-oriented URLs

Primary endpoint groups:

- `/auth`
- `/users`
- `/roles`
- `/permissions`
- `/schools`
- `/groups`
- `/subjects`
- `/questions`
- `/question-imports`
- `/exams`
- `/exam-assignments`
- `/exam-sessions`
- `/grading`
- `/proctoring`
- `/materials`
- `/results`
- `/reports`
- `/notifications`
- `/profile`

Key flow contracts:

### Authentication

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/profile`

### Admin Management

- CRUD for users, roles, groups, schools, subjects, and materials
- bulk import endpoints for users and questions
- list endpoints must support search and filters to match the existing UI tables and cards

### Exam Creation

- create draft exam
- update basic info
- attach question revisions
- save random selection rules
- save scheduling
- save assignment
- publish or unpublish according to business rules

### Candidate Delivery

- start or resume a session
- retrieve personalized session question set
- save answer
- autosave session progress
- submit session
- fetch current timing and session status

### Grading and Results

- list pending manual grading tasks
- grade essay answers
- publish results
- export results

### Proctoring and Monitoring

- create heartbeat
- submit event logs
- upload evidence metadata
- list violation cases
- review and resolve violations
- stream monitoring updates over WebSocket

## Realtime Contract

WebSockets are required for:

- live exam monitoring
- candidate session state updates
- heartbeat updates
- proctor alerts
- autosave acknowledgements where useful

Channel groups should be scoped by:

- exam
- exam session
- monitoring room
- user

Event classes should cover:

- session started
- session resumed
- heartbeat received
- connection unstable
- tab switched
- fullscreen exited
- webcam capture received
- screen capture received
- autosave completed
- session submitted
- session expired
- violation raised
- violation resolved

## Future Native Client Path

The first release remains browser-based, but the design must leave room for a future native safe exam browser or agent.

Required hooks:

- `client_type` field on session or capability registration
- `client_version`
- signed `attestation_payload`
- declared `client_capabilities`
- event source typing for `web` versus `native`
- room to add device trust checks later without rewriting session flow

This keeps the exam engine stable while allowing stronger clients later.

## File and Media Handling

All large files and media should use object storage.

Stored asset categories:

- study materials
- CSV and JSON import artifacts
- exported reports
- avatars
- webcam snapshots
- screen captures
- future session recording artifacts

Rules:

- store metadata in the database
- store binary objects in S3-compatible storage
- use signed URLs for controlled retrieval
- validate file size, extension, and MIME type
- process expensive file tasks asynchronously

## Security and Integrity

Authorization:

- enforce module and action permissions on every protected endpoint
- use object-level checks where school, group, exam, or session scope matters

Exam integrity:

- backend controls official timing
- backend controls attempt limits
- backend controls submission finality
- all sensitive state changes run inside transactions

Auditability:

- audit login, logout, role changes, exam publication, assignment changes, session submission, grading actions, and violation reviews

Abuse resistance:

- rate limit auth and sensitive endpoints
- validate WebSocket authentication
- prevent duplicate or replayed submission flows

## Error Handling

Use consistent error envelopes for:

- validation errors
- authentication failures
- permission failures
- domain rule violations
- expired or invalid session actions
- storage and async job failures

Rules:

- do not expose raw internal traces to the SPA
- return machine-friendly error codes
- include user-safe messages that frontend can surface directly

## Testing Strategy

Testing layers:

- unit tests for models, scoring, permission checks, and rule engines
- API tests for CRUD and workflow endpoints
- WebSocket tests for monitoring and realtime session flows
- async job tests for imports, exports, and media processing
- workflow integration tests for end-to-end exam lifecycle

Critical end-to-end flows:

- login and token refresh
- create question and exam
- assign exam to group
- start session
- autosave answers
- submit exam
- auto-score objective questions
- manually grade essay questions
- publish result
- review proctor violations

## Implementation Rounds

### Round 1: Foundation

- scaffold Django project
- configure settings split
- configure PostgreSQL
- configure Redis
- configure Celery
- configure Channels
- configure S3-compatible storage
- add base auth and health endpoints
- add audit and shared core utilities

### Round 2: Identity and Directory

- custom user model
- profile
- schools
- groups
- memberships
- subjects
- role and permission model
- user management APIs

### Round 3: Question Bank

- question CRUD
- revisions
- options and answer keys
- tags
- import pipeline

### Round 4: Exam Authoring and Assignment

- exam CRUD
- exam versions
- manual and random question selection
- scheduling
- assignment to groups and users

### Round 5: Candidate Delivery

- start and resume session
- question delivery
- answer save and autosave
- submit flow
- auto-score objective answers

### Round 6: Manual Grading and Results

- essay grading tasks
- grading UI support APIs
- result consolidation
- result publication

### Round 7: Monitoring and Proctoring

- heartbeat
- live monitoring websocket streams
- event capture
- evidence upload pipeline
- violation review workflow

### Round 8: Materials, Reporting, and Hardening

- material library APIs
- dashboard snapshots
- export jobs
- notifications
- operational hardening

## Delivery Notes for the Existing Frontend

- Replace mock datasets page by page instead of rewriting the entire SPA at once.
- Keep frontend route structure intact.
- Introduce a shared API client layer in the SPA before replacing every page.
- Migrate pages in the same order as the backend rounds.
- Preserve current visual behavior unless backend realities require a UI adjustment.

## Risks and Constraints

- Browser-only proctoring cannot guarantee OS-level lockdown.
- Realtime monitoring can create heavy event volume and must be rate-limited and aggregated.
- Essay grading and reporting can create delayed completion states that the UI must represent clearly.
- Media evidence can become large quickly and needs retention rules.
- Role flexibility increases authorization complexity and requires disciplined permission design.

## Recommendation

Proceed with implementation as vertical slices by round, using the existing UI as the acceptance surface for each backend capability.
