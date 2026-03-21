# EduExam Round 6 Manual Grading and Results Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the manual grading and result consolidation slice for EduExam, covering essay grading tasks, grader actions, finalized results, publication control, and result reporting APIs for the existing results screen.

**Architecture:** Add a focused `grading` app that is triggered from `exam_delivery.submit_session`. Submission creates grading tasks for essay answers and a result record that tracks workflow state, publication state, and final scoring. Grading APIs operate on `ManualGradingTask`, while result APIs expose consolidated rows and summary analytics for the admin UI.

**Tech Stack:** Python, Django, Django REST Framework, drf-spectacular, pytest, pytest-django

---

**Preconditions**

- Rounds 1-5 are already implemented in `backend/`.
- `exam_delivery.submit_session` is the submission boundary that must initialize grading state.
- Round 6 should not yet implement exports, dashboard snapshots, or proctoring review workflows.
- The workspace is still not a Git repository, so worktree and commit steps remain informational only.

## Chunk 1: Grading Data Model

### Task 1: Create the `grading` app with manual grading task, manual grade, and result models

**Files:**
- Create: `backend/apps/grading/__init__.py`
- Create: `backend/apps/grading/apps.py`
- Create: `backend/apps/grading/models.py`
- Create: `backend/apps/grading/admin.py`
- Create: `backend/apps/grading/migrations/__init__.py`
- Modify: `backend/config/settings/base.py`
- Create: `backend/tests/grading/__init__.py`
- Create: `backend/tests/grading/test_models.py`

- [ ] **Step 1: Write the failing model tests**

```python
def test_manual_grading_task_is_unique_per_session_question(...):
    ManualGradingTask.objects.create(session_question=question, session=session)
    with pytest.raises(IntegrityError):
        ManualGradingTask.objects.create(session_question=question, session=session)
```

```python
def test_result_is_unique_per_session(...):
    Result.objects.create(session=session, ...)
    with pytest.raises(IntegrityError):
        Result.objects.create(session=session, ...)
```

- [ ] **Step 2: Run the model tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/grading/test_models.py -q`
Expected: FAIL because the app and models do not exist yet.

- [ ] **Step 3: Implement the grading models**

```python
class ManualGradingTask(TimeStampedModel):
    session = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name="manual_grading_tasks")
    session_question = models.OneToOneField(SessionQuestion, on_delete=models.CASCADE, related_name="manual_grading_task")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
```

```python
class ManualGrade(TimeStampedModel):
    task = models.OneToOneField(ManualGradingTask, on_delete=models.CASCADE, related_name="manual_grade")
    score_awarded = models.DecimalField(max_digits=8, decimal_places=2)
    feedback = models.TextField(blank=True)
```

```python
class Result(TimeStampedModel):
    session = models.OneToOneField(ExamSession, on_delete=models.CASCADE, related_name="result")
    workflow_status = models.CharField(max_length=20, choices=WorkflowStatus.choices)
    publish_state = models.CharField(max_length=16, choices=PublishState.choices, default=PublishState.DRAFT)
```

- [ ] **Step 4: Create and apply migrations**

Run: `backend\.venv\Scripts\python backend\manage.py makemigrations grading`
Expected: New migration file created.

Run: `backend\.venv\Scripts\python backend\manage.py migrate`
Expected: PASS.

- [ ] **Step 5: Re-run the model tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/grading/test_models.py -q`
Expected: PASS.

## Chunk 2: Submission Hook and Grading Services

### Task 2: Add services for grading initialization, manual scoring, result recalculation, and publication

**Files:**
- Create: `backend/apps/grading/services.py`
- Modify: `backend/apps/exam_delivery/services.py`
- Create: `backend/tests/grading/test_services.py`

- [ ] **Step 1: Write failing service tests**

```python
def test_initialize_grading_for_submission_creates_pending_tasks_for_essay_answers(...):
    submission = submit_session(...)
    assert session.manual_grading_tasks.count() == 1
    assert session.result.workflow_status == "pending_grading"
```

```python
def test_objective_only_submission_finalizes_result_without_manual_tasks(...):
    submit_session(...)
    assert session.result.workflow_status == "finalized"
```

```python
def test_grade_manual_task_updates_manual_score_and_finalizes_result_when_last_task_completed(...):
    task = session.manual_grading_tasks.first()
    grade_manual_task(task=task, grader=admin_user, score_awarded="4.0")
    assert task.status == "graded"
    assert session.result.workflow_status == "finalized"
```

```python
def test_publish_result_marks_result_as_published(...):
    publish_result(result=result, published_by=admin_user)
    assert result.publish_state == "published"
```

- [ ] **Step 2: Run the service tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/grading/test_services.py -q`
Expected: FAIL because the services and submission integration do not exist yet.

- [ ] **Step 3: Implement transactional grading helpers**

```python
@transaction.atomic
def initialize_grading_for_submission(*, session):
    ...
```

```python
@transaction.atomic
def grade_manual_task(*, task, grader, score_awarded, feedback=""):
    ...
```

```python
@transaction.atomic
def publish_result(*, result, published_by):
    ...
```

- [ ] **Step 4: Hook submission into grading initialization**

Update `submit_session` so that after creating the submission it initializes grading records and leaves the session/result consistent for both objective-only and essay-containing exams.

- [ ] **Step 5: Re-run the service tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/grading/test_services.py -q`
Expected: PASS.

## Chunk 3: Grading APIs

### Task 3: Build manual grading task list and grade action APIs

**Files:**
- Create: `backend/apps/grading/api/__init__.py`
- Create: `backend/apps/grading/api/serializers.py`
- Create: `backend/apps/grading/api/views.py`
- Create: `backend/apps/grading/api/urls.py`
- Modify: `backend/config/urls.py`
- Modify: `backend/apps/identity/bootstrap.py`
- Modify: `backend/tests/conftest.py`
- Create: `backend/tests/grading/test_api.py`

- [ ] **Step 1: Write failing grading API tests**

```python
def test_admin_can_list_manual_grading_tasks(...):
    response = api_client.get("/api/v1/grading/tasks/")
    assert response.status_code == 200
```

```python
def test_admin_can_grade_manual_task(...):
    response = api_client.post(f"/api/v1/grading/tasks/{task.id}/grade/", {"score_awarded": 4})
    assert response.status_code == 200
```

```python
def test_grading_task_list_supports_status_and_exam_filters(...):
    response = api_client.get("/api/v1/grading/tasks/?status=pending&exam=1")
    assert response.status_code == 200
```

- [ ] **Step 2: Run the grading API tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/grading/test_api.py -q`
Expected: FAIL because the routes and serializers do not exist yet.

- [ ] **Step 3: Implement task serializers and viewset**

```python
class ManualGradingTaskViewSet(...):
    permission_codes = {"GET": "grading.view", "POST": "grading.manage"}
```

```python
@action(detail=True, methods=["post"])
def grade(self, request, pk=None):
    ...
```

- [ ] **Step 4: Re-run the grading API tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/grading/test_api.py -q`
Expected: PASS.

### Task 4: Build result list, summary, detail, and publish APIs

**Files:**
- Modify: `backend/apps/grading/api/serializers.py`
- Modify: `backend/apps/grading/api/views.py`
- Create: `backend/tests/grading/test_result_api.py`

- [ ] **Step 1: Write failing result API tests**

```python
def test_admin_can_list_results_with_candidate_and_exam_filters(...):
    response = api_client.get("/api/v1/results/?search=john&exam=1")
    assert response.status_code == 200
```

```python
def test_results_summary_returns_pass_fail_and_distribution_metrics(...):
    response = api_client.get("/api/v1/results/summary/")
    assert response.status_code == 200
```

```python
def test_admin_can_publish_finalized_result(...):
    response = api_client.post(f"/api/v1/results/{result.id}/publish/")
    assert response.status_code == 200
```

- [ ] **Step 2: Run the result API tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/grading/test_result_api.py -q`
Expected: FAIL because the result routes and actions do not exist yet.

- [ ] **Step 3: Implement result serializers and viewset actions**

```python
class ResultViewSet(...):
    permission_codes = {"GET": "results.view", "POST": "results.manage"}
```

```python
@action(detail=False, methods=["get"], url_path="summary")
def summary(self, request):
    ...
```

```python
@action(detail=True, methods=["post"])
def publish(self, request, pk=None):
    ...
```

- [ ] **Step 4: Re-run the result API tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/grading/test_result_api.py -q`
Expected: PASS.

## Chunk 4: Docs and Verification

### Task 5: Update docs and verify the full backend slice

**Files:**
- Modify: `backend/README.md`
- Modify: `backend/openapi.yaml`

- [ ] **Step 1: Update backend README**

Document:
- grading task endpoints
- result workflow and publish states
- grading payload shape
- result summary endpoint

- [ ] **Step 2: Run full verification**

Run: `backend\.venv\Scripts\python backend\manage.py check`
Expected: PASS.

Run: `backend\.venv\Scripts\python -m pytest backend/tests -q`
Expected: PASS with Rounds 1-6 green.

Run: `backend\.venv\Scripts\python backend\manage.py spectacular --file backend\openapi.yaml`
Expected: PASS with schema including grading tasks and results endpoints.

- [ ] **Step 3: Checkpoint note**

Because this workspace is not under Git, record completion in the session log instead of committing. If Git is initialized later, checkpoint after Round 6.
