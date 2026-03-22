# EduExam Reset Demo Data Design

**Date:** 2026-03-22

**Status:** Approved design baseline for implementation

## Context

The repository currently exposes a working end-to-end admin and candidate application, but the only built-in seed command is `seed_demo_data`, which creates a minimal admin account plus RBAC system records.

That is not enough for local validation of:

- user and role management
- school and candidate group workflows
- question bank and exam authoring
- candidate dashboard, assigned exams, and practice flows
- manual grading and results
- materials
- notifications
- audit activity
- proctoring and live monitoring

The user wants a one-command local reset that wipes all business data in the current database and recreates a fixed demo dataset for end-to-end testing.

## Goals

- Add a destructive local-only reset command that clears all business data in the current database and rebuilds a deterministic demo dataset.
- Provide enough seeded data to exercise the current admin and candidate UI with real API responses.
- Keep the current minimal `seed_demo_data` command for lightweight RBAC-only setup.
- Update the single root `README.md` so the default local setup path uses the new full demo data command.

## Non-Goals

- Supporting production-safe partial demo imports.
- Preserving any existing business data in the database.
- Building a fixture-based seed pipeline.
- Translating or changing business logic unrelated to demo data setup.

## Chosen Approach

Use a new management command, `reset_demo_data`, that:

1. runs `flush --noinput`
2. recreates system users and roles
3. seeds a full deterministic local dataset through Python services

This command will be implemented as:

- command entrypoint in `backend/apps/identity/management/commands/reset_demo_data.py`
- seed orchestration service in `backend/apps/platform_core/demo_seed.py`

## Seeded Dataset

The fixed dataset will include:

- system users:
  - admin
  - two examiners
  - one proctor
  - multiple candidates
- institutions:
  - two schools
  - several candidate groups
  - memberships
- academics:
  - multiple subjects
- question bank:
  - objective and essay questions
  - tags
  - at least one revised question
- exam authoring:
  - periods
  - rooms
  - exams across multiple statuses
  - versions, manual items, random rules, assignments
- candidate delivery:
  - unstarted, in-progress, and submitted sessions
  - saved answers and submissions
- grading and results:
  - pending manual grading
  - graded manual task
  - published and unpublished results
- materials:
  - multiple active materials
- notifications:
  - candidate-facing and admin-facing records
- audit:
  - representative activity records for security, grading, results, and exam actions
- proctoring:
  - heartbeats
  - warning and critical events
  - evidence
  - open and reviewed violation cases

## Technical Notes

- The seed command should remain deterministic enough that re-running after flush produces the same logical dataset every time.
- Demo file artifacts for materials and proctoring evidence should be stored under a dedicated demo seed path so local reruns do not scatter unpredictable files.
- Existing domain services should be reused where they provide the correct side effects, especially for:
  - question creation
  - exam creation
  - candidate session startup and submission
  - grading initialization and grading
  - result publication
  - proctoring events and case review
- The command should not run migrations; the local setup flow still expects `migrate` first.

## Documentation Impact

The root `README.md` should be updated so local setup and local update instructions use:

```bash
python manage.py reset_demo_data
```

The minimal `seed_demo_data` command should remain documented as the lightweight alternative when only admin + RBAC data is needed.
