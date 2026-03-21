# EduExam Round 5 Candidate Delivery Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the candidate exam delivery slice for EduExam, covering assigned-exam listing, session start or resume, question delivery, answer persistence, autosave snapshots, submission finalization, and objective auto-scoring.

**Architecture:** Add a focused `exam_delivery` app centered on `ExamSession`. A session snapshots the active `ExamVersion` into session-specific questions and answers, so the candidate flow stays stable even if exam authoring changes later. Delivery endpoints remain candidate-safe and use domain validation rather than admin RBAC permissions.

**Tech Stack:** Python, Django, Django REST Framework, drf-spectacular, pytest, pytest-django

---

**Preconditions**

- Rounds 1-4 are already implemented in `backend/`.
- `exam_authoring.ExamAssignment` is the source of eligibility for delivery.
- Round 5 should not yet implement essay manual grading workflows or proctoring streams.
- The workspace is still not a Git repository, so worktree and commit steps remain informational only.

## Chunk 1: Exam Delivery Data Model

### Task 1: Create the `exam_delivery` app with session, session question, answer, autosave, and submission models

**Files:**
- Create: `backend/apps/exam_delivery/__init__.py`
- Create: `backend/apps/exam_delivery/apps.py`
- Create: `backend/apps/exam_delivery/models.py`
- Create: `backend/apps/exam_delivery/admin.py`
- Create: `backend/apps/exam_delivery/migrations/__init__.py`
- Modify: `backend/config/settings/base.py`
- Create: `backend/tests/exam_delivery/__init__.py`
- Create: `backend/tests/exam_delivery/test_models.py`

- [ ] **Step 1: Write the failing model tests**

```python
def test_exam_session_attempt_number_increments_per_candidate_and_exam(...):
    ExamSession.objects.create(exam=exam, candidate=user, attempt_number=1, ...)
    session = ExamSession.objects.create(exam=exam, candidate=user, attempt_number=2, ...)
    assert session.attempt_number == 2
```

```python
def test_submission_is_unique_per_session(...):
    Submission.objects.create(session=session, submitted_by=user)
    with pytest.raises(IntegrityError):
        Submission.objects.create(session=session, submitted_by=user)
```

- [ ] **Step 2: Run the model tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_delivery/test_models.py -q`
Expected: FAIL because the app and models do not exist yet.

- [ ] **Step 3: Implement the core models**

```python
class ExamSession(TimeStampedModel):
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="sessions")
    candidate = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="exam_sessions")
    exam_version = models.ForeignKey(ExamVersion, on_delete=models.PROTECT, related_name="delivery_sessions")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.IN_PROGRESS)
```

```python
class SessionQuestion(TimeStampedModel):
    session = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name="questions")
    question_revision = models.ForeignKey(QuestionRevision, on_delete=models.PROTECT)
    sort_order = models.PositiveIntegerField()
```

```python
class SessionAnswer(TimeStampedModel):
    session_question = models.OneToOneField(SessionQuestion, on_delete=models.CASCADE, related_name="answer")
    selected_option_keys = models.JSONField(default=list, blank=True)
    answer_text = models.TextField(blank=True)
```

```python
class Submission(TimeStampedModel):
    session = models.OneToOneField(ExamSession, on_delete=models.CASCADE, related_name="submission")
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
```

- [ ] **Step 4: Create and apply migrations**

Run: `backend\.venv\Scripts\python backend\manage.py makemigrations exam_delivery`
Expected: New migration file created.

Run: `backend\.venv\Scripts\python backend\manage.py migrate`
Expected: PASS.

- [ ] **Step 5: Re-run the model tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_delivery/test_models.py -q`
Expected: PASS.

## Chunk 2: Candidate Delivery Services

### Task 2: Add transactional services for eligibility, start or resume, answer save, autosave, and submit

**Files:**
- Create: `backend/apps/exam_delivery/services.py`
- Create: `backend/tests/exam_delivery/test_services.py`

- [ ] **Step 1: Write failing service tests**

```python
def test_start_or_resume_session_creates_snapshot_questions_from_current_exam_version(...):
    session = start_or_resume_session(exam=exam, candidate=user)
    assert session.questions.count() == exam.current_version.items.count()
```

```python
def test_start_or_resume_returns_existing_in_progress_session(...):
    first = start_or_resume_session(exam=exam, candidate=user)
    second = start_or_resume_session(exam=exam, candidate=user)
    assert second.id == first.id
```

```python
def test_save_answer_updates_session_answer_and_autosave_snapshot(...):
    save_answer(...)
    snapshot = create_autosave_snapshot(...)
    assert snapshot.answered_count == 1
```

```python
def test_submit_session_is_idempotent_and_auto_scores_objective_items(...):
    submit_session(session=session, submitted_by=user)
    repeated = submit_session(session=session, submitted_by=user)
    assert repeated.id == session.submission.id
    assert session.objective_score == 1
```

- [ ] **Step 2: Run the service tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_delivery/test_services.py -q`
Expected: FAIL because the services do not exist yet.

- [ ] **Step 3: Implement transactional service helpers**

```python
@transaction.atomic
def start_or_resume_session(*, exam, candidate):
    ...
```

```python
@transaction.atomic
def save_session_answer(*, session, session_question, ...):
    ...
```

```python
@transaction.atomic
def submit_session(*, session, submitted_by):
    ...
```

- [ ] **Step 4: Re-run the service tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_delivery/test_services.py -q`
Expected: PASS.

## Chunk 3: Candidate APIs

### Task 3: Add candidate exam list and start or resume APIs

**Files:**
- Create: `backend/apps/exam_delivery/api/__init__.py`
- Create: `backend/apps/exam_delivery/api/serializers.py`
- Create: `backend/apps/exam_delivery/api/views.py`
- Create: `backend/apps/exam_delivery/api/urls.py`
- Modify: `backend/config/urls.py`
- Create: `backend/tests/exam_delivery/test_candidate_api.py`

- [ ] **Step 1: Write failing candidate list and start API tests**

```python
def test_candidate_can_list_assigned_exams(...):
    response = api_client.get("/api/v1/my-exams/")
    assert response.status_code == 200
```

```python
def test_candidate_can_start_exam_session_when_assigned_and_open(...):
    response = api_client.post(f"/api/v1/exams/{exam.id}/start-session/")
    assert response.status_code == 200
```

```python
def test_candidate_cannot_start_exam_without_assignment(...):
    response = api_client.post(f"/api/v1/exams/{exam.id}/start-session/")
    assert response.status_code == 403
```

- [ ] **Step 2: Run the candidate API tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_delivery/test_candidate_api.py -q`
Expected: FAIL because the routes and serializers do not exist yet.

- [ ] **Step 3: Implement candidate list and start or resume endpoints**

```python
path("my-exams/", CandidateAssignedExamListView.as_view())
path("exams/<int:pk>/start-session/", CandidateExamStartView.as_view())
```

- [ ] **Step 4: Re-run the candidate API tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_delivery/test_candidate_api.py -q`
Expected: PASS.

### Task 4: Add session detail, answer save, autosave, and submit APIs

**Files:**
- Modify: `backend/apps/exam_delivery/api/serializers.py`
- Modify: `backend/apps/exam_delivery/api/views.py`
- Create: `backend/tests/exam_delivery/test_session_api.py`

- [ ] **Step 1: Write failing session API tests**

```python
def test_candidate_can_fetch_session_detail_with_questions_and_answers(...):
    response = api_client.get(f"/api/v1/exam-sessions/{session.id}/")
    assert response.status_code == 200
```

```python
def test_candidate_can_save_answer_for_session_question(...):
    response = api_client.put(f"/api/v1/exam-sessions/{session.id}/answers/{question.id}/", {...})
    assert response.status_code == 200
```

```python
def test_candidate_can_create_autosave_snapshot(...):
    response = api_client.post(f"/api/v1/exam-sessions/{session.id}/autosave/", {...})
    assert response.status_code == 201
```

```python
def test_candidate_can_submit_session_and_receive_scoring_summary(...):
    response = api_client.post(f"/api/v1/exam-sessions/{session.id}/submit/")
    assert response.status_code == 200
```

- [ ] **Step 2: Run the session API tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_delivery/test_session_api.py -q`
Expected: FAIL because the routes and actions do not exist yet.

- [ ] **Step 3: Implement session delivery APIs**

```python
class ExamSessionViewSet(...):
    @action(detail=True, methods=["post"])
    def autosave(self, request, pk=None):
        ...
```

```python
class SessionAnswerWriteAPIView(APIView):
    def put(self, request, session_id, question_id):
        ...
```

- [ ] **Step 4: Re-run the session API tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_delivery/test_session_api.py -q`
Expected: PASS.

## Chunk 4: Docs and Verification

### Task 5: Update docs and verify the full backend slice

**Files:**
- Modify: `backend/README.md`
- Modify: `backend/openapi.yaml`

- [ ] **Step 1: Update backend README**

Document:
- candidate delivery endpoints
- session status values
- answer save payload shape
- autosave and submit behavior

- [ ] **Step 2: Run full verification**

Run: `backend\.venv\Scripts\python backend\manage.py check`
Expected: PASS.

Run: `backend\.venv\Scripts\python -m pytest backend/tests -q`
Expected: PASS with Rounds 1-5 green.

Run: `backend\.venv\Scripts\python backend\manage.py spectacular --file backend\openapi.yaml`
Expected: PASS with schema including my-exams, session detail, answer save, autosave, and submit actions.

- [ ] **Step 3: Checkpoint note**

Because this workspace is not under Git, record completion in the session log instead of committing. If Git is initialized later, checkpoint after Round 5.
