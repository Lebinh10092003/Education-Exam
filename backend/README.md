# EduExam Backend

This directory contains the Django API backend for the EduExam platform.

## Local Setup

1. Create a virtual environment in `backend/.venv`.
2. Install dependencies from `backend/pyproject.toml`.
3. Copy `.env.example` to `.env` and adjust values if needed.
4. Start local services with `docker compose -f backend/docker-compose.yml up -d`.
5. Run migrations with `python backend/manage.py migrate`.
6. Seed a demo admin with `python backend/manage.py seed_demo_data`.

## Round 2 Scope

Round 2 adds:

- custom RBAC records (`roles`, `permissions`, `user_roles`)
- schools, candidate groups, and group memberships
- subjects
- user management APIs with lock and unlock actions

Primary admin endpoints:

- `POST /api/v1/auth/login/`
- `GET /api/v1/profile/`
- `GET|POST /api/v1/users/`
- `POST /api/v1/users/{id}/lock/`
- `POST /api/v1/users/{id}/unlock/`
- `GET|POST /api/v1/roles/`
- `GET /api/v1/permissions/`
- `GET|POST /api/v1/schools/`
- `GET|POST /api/v1/groups/`
- `GET|POST /api/v1/groups/{id}/memberships/`
- `GET|POST /api/v1/subjects/`

The `seed_demo_data` command also seeds system permissions and roles, then attaches the demo admin to the `administrator` role.

## Round 3 Scope

Round 3 adds:

- question bank CRUD under `/api/v1/questions/`
- immutable question revisions with nested options and answer keys
- tag management via `/api/v1/question-tags/`
- import batches via `/api/v1/question-imports/`

Supported question types:

- `multiple_choice`
- `essay`
- `true_false`

Supported difficulty values:

- `easy`
- `medium`
- `hard`

Import fields:

- JSON rows: `subject_code`, `difficulty`, `question_type`, `question_text`, `tags`, `options`, `correct_option_keys`, `essay_rubric`, `sample_answer`, `acceptable_answers`
- CSV columns: `subject_code`, `difficulty`, `question_type`, `question_text`, `tags`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_option_keys`, `essay_rubric`, `sample_answer`, `acceptable_answers`

## Round 4 Scope

Round 4 adds:

- versioned exam authoring under `/api/v1/exams/`
- immutable exam versions with manual items and persisted random-selection rules
- schedule windows, clone action, and assignment summary payloads
- group assignment workflow via `/api/v1/exams/{id}/group-assignments/`

Supported exam statuses:

- `draft`
- `scheduled`
- `open`
- `paused`
- `closed`
- `archived`

Create or update payload shape:

- `name`
- `subject_id`
- `description`
- `status`
- `duration_minutes`
- `passing_score`
- `max_attempts`
- `shuffle_questions`
- `show_results_immediately`
- `enable_proctoring`
- `opening_at`
- `closing_at`
- `manual_question_ids`
- `random_rules`: list of `{difficulty?, question_type?, tag_ids?, count}`
- `group_ids`
- `user_ids`

Primary exam endpoints:

- `GET|POST /api/v1/exams/`
- `GET|PATCH|PUT|DELETE /api/v1/exams/{id}/`
- `POST /api/v1/exams/{id}/clone/`
- `GET|POST /api/v1/exams/{id}/group-assignments/`

## Round 5 Scope

Round 5 adds:

- candidate assigned-exam listing under `/api/v1/my-exams/`
- start or resume flow under `/api/v1/exams/{id}/start-session/`
- session delivery under `/api/v1/exam-sessions/{id}/`
- answer save, autosave snapshot, and submit actions
- objective auto-scoring during submission

Session status values:

- `in_progress`
- `submitted`
- `expired`
- `terminated`

Answer save payload shape:

- `selected_option_keys`
- `answer_text`
- `is_marked_for_review`

Candidate delivery endpoints:

- `GET /api/v1/my-exams/`
- `POST /api/v1/exams/{id}/start-session/`
- `GET /api/v1/exam-sessions/{id}/`
- `PUT /api/v1/exam-sessions/{session_id}/answers/{question_id}/`
- `POST /api/v1/exam-sessions/{id}/autosave/`
- `POST /api/v1/exam-sessions/{id}/submit/`

## Round 6 Scope

Round 6 adds:

- manual grading tasks under `/api/v1/grading/tasks/`
- grading action for essay answers
- result consolidation and publication under `/api/v1/results/`
- summary metrics for the `Results & Reports` screen

Grading task status values:

- `pending`
- `graded`

Result workflow values:

- `pending_grading`
- `finalized`

Result publish states:

- `draft`
- `published`

Manual grading payload shape:

- `score_awarded`
- `feedback`

Result endpoints:

- `GET /api/v1/grading/tasks/`
- `GET /api/v1/grading/tasks/{id}/`
- `POST /api/v1/grading/tasks/{id}/grade/`
- `GET /api/v1/results/`
- `GET /api/v1/results/{id}/`
- `GET /api/v1/results/summary/`
- `POST /api/v1/results/{id}/publish/`

## Round 7 Scope

Round 7 adds:

- candidate-side proctoring endpoints for client capability, heartbeat, event, and evidence uploads
- admin monitoring snapshot and violation case review APIs
- live monitoring websocket broadcasts scoped by exam
- violation case tracking for warning and critical proctor events

Client capability values:

- `web`
- `native`

Heartbeat connection values:

- `stable`
- `unstable`
- `offline`

Proctor event values:

- `tab_switch`
- `fullscreen_exit`
- `connection_unstable`
- `webcam_capture`
- `screen_capture`
- `manual_alert`

Proctor event severities:

- `info`
- `warning`
- `critical`

Violation case states:

- `open`
- `resolved`
- `dismissed`

Candidate proctoring endpoints:

- `POST /api/v1/proctoring/sessions/{id}/capability/`
- `POST /api/v1/proctoring/sessions/{id}/heartbeats/`
- `POST /api/v1/proctoring/sessions/{id}/events/`
- `POST /api/v1/proctoring/sessions/{id}/evidence/`

Admin monitoring endpoints:

- `GET /api/v1/proctoring/exams/{id}/monitoring/`
- `GET /api/v1/proctoring/cases/`
- `GET /api/v1/proctoring/cases/{id}/`
- `POST /api/v1/proctoring/cases/{id}/resolve/`

Live monitoring websocket:

- `GET ws://<host>/ws/monitoring/exams/{id}/?token=<access-jwt>`

## Round 8 Scope

Round 8 adds:

- dashboard aggregation endpoint under `/api/v1/dashboard/overview/`
- materials library CRUD under `/api/v1/materials/`
- profile update and password change endpoints
- forgot-password request endpoint for the frontend auth flow

Dashboard endpoint:

- `GET /api/v1/dashboard/overview/`

Materials endpoints:

- `GET|POST /api/v1/materials/`
- `GET|PATCH|DELETE /api/v1/materials/{id}/`
- `GET /api/v1/materials/{id}/download/`

Profile and auth utility endpoints:

- `PATCH /api/v1/profile/`
- `POST /api/v1/profile/change-password/`
- `POST /api/v1/auth/forgot-password/`

## Useful Commands

- `python backend/manage.py check`
- `python backend/manage.py migrate`
- `python backend/manage.py seed_demo_data`
- `python -m pytest backend/tests -q`
- `python backend/manage.py spectacular --file backend/openapi.yaml`
