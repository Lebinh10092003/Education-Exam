# Reset Demo Data Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a destructive local reset command that flushes the current database and recreates a full deterministic demo dataset for end-to-end testing across the EduExam admin and candidate experience.

**Architecture:** Keep `seed_demo_data` as the minimal RBAC bootstrap path and add a separate `reset_demo_data` command for full local demo data. Put orchestration in a dedicated backend seed service, reuse existing domain services for questions, exams, sessions, grading, notifications, and proctoring where those services already enforce the correct business shape, and update the single root README to use the new command as the main local setup path.

**Tech Stack:** Django management commands, Django ORM, existing domain services, pytest

---

## Chunk 1: Seed Orchestration

### Task 1: Add a full demo seed service and reset command

**Files:**
- Create: `backend/apps/platform_core/demo_seed.py`
- Create: `backend/apps/identity/management/commands/reset_demo_data.py`

- [ ] Define deterministic demo user, school, group, subject, and exam constants.
- [ ] Implement a seed orchestrator that creates the full demo dataset in domain order.
- [ ] Implement a reset command that runs `flush --noinput`, invokes the orchestrator, and prints demo credentials.

## Chunk 2: Domain Dataset Coverage

### Task 2: Seed questions, exams, sessions, grading, materials, notifications, audit, and proctoring

**Files:**
- Modify: `backend/apps/platform_core/demo_seed.py`

- [ ] Seed objective and essay questions using existing question services.
- [ ] Seed exam periods, rooms, and exams using existing exam authoring services.
- [ ] Seed candidate sessions and submissions using candidate delivery services.
- [ ] Seed pending and finalized grading paths using grading services.
- [ ] Seed materials and representative notifications.
- [ ] Seed audit events and proctoring activity using the current services/helpers.

## Chunk 3: Regression Coverage

### Task 3: Add a command-level regression test

**Files:**
- Create: `backend/tests/identity/test_reset_demo_data_command.py`

- [ ] Write a transactional test that creates pre-existing junk data, runs `reset_demo_data`, and verifies the junk data is gone.
- [ ] Assert that the resulting demo dataset includes users, groups, subjects, exams, sessions, results, materials, notifications, audit events, and proctoring records.

## Chunk 4: Documentation

### Task 4: Update local setup instructions

**Files:**
- Modify: `README.md`

- [ ] Replace the primary local demo setup command with `python manage.py reset_demo_data`.
- [ ] Keep `seed_demo_data` documented as the minimal RBAC-only alternative.
- [ ] Warn clearly that `reset_demo_data` wipes all business data in the current database.

## Verification

- `backend\\.venv\\Scripts\\python.exe -m pytest backend/tests/identity/test_reset_demo_data_command.py -q`
- `backend\\.venv\\Scripts\\python.exe -m pytest backend/tests/exam_authoring/test_period_room_api.py backend/tests/exam_delivery/test_candidate_dashboard_api.py backend/tests/grading/test_api.py backend/tests/grading/test_candidate_results_api.py backend/tests/identity/test_role_api.py backend/tests/institutions/test_group_import_api.py backend/tests/materials/test_candidate_api.py backend/tests/notifications backend/tests/platform_core/test_audit_api.py backend/tests/proctoring/test_services.py -q`
- `backend\\.venv\\Scripts\\python.exe backend\\manage.py spectacular --file backend\\openapi.yaml`
