# EduExam Round 3 Question Bank Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the question bank backend slice for EduExam, including question CRUD, immutable revisions, answer options and keys, tags, search and filter APIs, and a first-pass import pipeline for CSV and JSON uploads.

**Architecture:** Add a focused `question_bank` app that stores authorable question entities separately from immutable published revisions. Keep create and update flows transactional via service helpers, expose REST APIs under `/api/v1/questions/` and `/api/v1/question-imports/`, and reuse Round 2 RBAC for access control.

**Tech Stack:** Python, Django, Django REST Framework, drf-spectacular, pytest, pytest-django

---

**Preconditions**

- Round 1 and Round 2 are already implemented in `backend/`.
- The workspace is still not a Git repository, so worktree and commit steps remain informational only.
- Round 3 should not yet touch exams, candidate sessions, or grading workflows.

## Chunk 1: Question Bank Data Model

### Task 1: Create the `question_bank` app with question, revision, option, tag, answer key, and import models

**Files:**
- Create: `backend/apps/question_bank/__init__.py`
- Create: `backend/apps/question_bank/apps.py`
- Create: `backend/apps/question_bank/models.py`
- Create: `backend/apps/question_bank/admin.py`
- Create: `backend/apps/question_bank/migrations/__init__.py`
- Modify: `backend/config/settings/base.py`
- Create: `backend/tests/question_bank/__init__.py`
- Create: `backend/tests/question_bank/test_models.py`

- [ ] **Step 1: Write the failing model tests**

```python
def test_question_update_creates_new_revision_number(...):
    question = create_question(...)
    updated = revise_question(question, ...)
    assert updated.current_revision.revision_number == 2
```

```python
def test_question_tags_are_unique_by_slug(...):
    QuestionTag.objects.create(name="Calculus", slug="calculus")
    with pytest.raises(IntegrityError):
        QuestionTag.objects.create(name="Calculus 2", slug="calculus")
```

- [ ] **Step 2: Run the model tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/question_bank/test_models.py -q`
Expected: FAIL because the app and models do not exist yet.

- [ ] **Step 3: Implement the core models**

```python
class Question(TimeStampedModel):
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="questions")
    current_revision = models.ForeignKey("QuestionRevision", null=True, blank=True, on_delete=models.SET_NULL)
```

```python
class QuestionRevision(TimeStampedModel):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="revisions")
    revision_number = models.PositiveIntegerField()
    question_text = models.TextField()
```

```python
class QuestionAnswerKey(TimeStampedModel):
    revision = models.OneToOneField(QuestionRevision, on_delete=models.CASCADE, related_name="answer_key")
    correct_option_keys = models.JSONField(default=list)
```

- [ ] **Step 4: Create and apply migrations**

Run: `backend\.venv\Scripts\python backend\manage.py makemigrations question_bank`
Expected: New migration file created.

Run: `backend\.venv\Scripts\python backend\manage.py migrate`
Expected: PASS.

- [ ] **Step 5: Re-run model tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/question_bank/test_models.py -q`
Expected: PASS.

### Task 2: Add question creation and revision services

**Files:**
- Create: `backend/apps/question_bank/services.py`
- Create: `backend/tests/question_bank/test_services.py`

- [ ] **Step 1: Write failing service tests**

```python
def test_create_question_builds_revision_options_and_answer_key(...):
    question = create_question(...)
    assert question.current_revision.options.count() == 4
```

```python
def test_update_question_creates_revision_without_mutating_old_revision(...):
    question = create_question(...)
    old_revision_id = question.current_revision_id
    updated = revise_question(question, ...)
    assert updated.current_revision_id != old_revision_id
```

- [ ] **Step 2: Run the service tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/question_bank/test_services.py -q`
Expected: FAIL because the services do not exist yet.

- [ ] **Step 3: Implement transactional create and revise helpers**

```python
with transaction.atomic():
    question = Question.objects.create(...)
    revision = QuestionRevision.objects.create(...)
    QuestionOption.objects.bulk_create(...)
```

- [ ] **Step 4: Re-run service tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/question_bank/test_services.py -q`
Expected: PASS.

## Chunk 2: Question CRUD APIs

### Task 3: Build serializers and API views for questions, tags, and details

**Files:**
- Create: `backend/apps/question_bank/api/__init__.py`
- Create: `backend/apps/question_bank/api/serializers.py`
- Create: `backend/apps/question_bank/api/views.py`
- Create: `backend/apps/question_bank/api/urls.py`
- Modify: `backend/config/urls.py`
- Modify: `backend/apps/identity/bootstrap.py`
- Create: `backend/tests/question_bank/test_api.py`

- [ ] **Step 1: Write failing question API tests**

```python
def test_admin_can_create_multiple_choice_question(...):
    response = api_client.post("/api/v1/questions/", {...})
    assert response.status_code == 201
```

```python
def test_question_list_supports_search_subject_and_difficulty_filters(...):
    response = api_client.get("/api/v1/questions/?search=derivative&subject=1&difficulty=easy")
    assert response.status_code == 200
```

```python
def test_question_update_creates_new_revision(...):
    response = api_client.patch(f"/api/v1/questions/{question.id}/", {...})
    assert response.status_code == 200
    assert response.json()["current_revision"]["revision_number"] == 2
```

- [ ] **Step 2: Run the question API tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/question_bank/test_api.py -q`
Expected: FAIL because the routes and serializers do not exist yet.

- [ ] **Step 3: Implement question and tag serializers with nested options**

```python
class QuestionWriteSerializer(serializers.Serializer):
    subject_id = serializers.PrimaryKeyRelatedField(...)
    question_text = serializers.CharField()
    options = QuestionOptionInputSerializer(many=True, required=False)
```

- [ ] **Step 4: Implement viewsets with search and filters**

```python
class QuestionViewSet(ModelViewSet):
    permission_codes = {"GET": "questions.view", "POST": "questions.manage", ...}
```

- [ ] **Step 5: Re-run the question API tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/question_bank/test_api.py -q`
Expected: PASS.

## Chunk 3: Import Pipeline

### Task 4: Add CSV and JSON import batch support for question uploads

**Files:**
- Modify: `backend/apps/question_bank/services.py`
- Modify: `backend/apps/question_bank/api/serializers.py`
- Modify: `backend/apps/question_bank/api/views.py`
- Create: `backend/tests/question_bank/test_import_api.py`

- [ ] **Step 1: Write failing import tests**

```python
def test_json_import_creates_batch_and_questions(...):
    response = api_client.post("/api/v1/question-imports/", {"format": "json", "file": upload})
    assert response.status_code == 201
    assert response.json()["status"] == "completed"
```

```python
def test_csv_import_records_row_errors_without_crashing(...):
    response = api_client.post("/api/v1/question-imports/", {"format": "csv", "file": upload})
    assert response.status_code == 201
    assert response.json()["error_count"] == 1
```

- [ ] **Step 2: Run the import tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/question_bank/test_import_api.py -q`
Expected: FAIL because import handling does not exist yet.

- [ ] **Step 3: Implement batch import parsing and persistence**

```python
def import_questions_from_file(...):
    if source_format == "json":
        rows = json.load(...)
    else:
        rows = csv.DictReader(...)
```

- [ ] **Step 4: Expose `/api/v1/question-imports/` create/list endpoints**

```python
class QuestionImportBatchViewSet(ModelViewSet):
    http_method_names = ["get", "post"]
```

- [ ] **Step 5: Re-run the import tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/question_bank/test_import_api.py -q`
Expected: PASS.

## Chunk 4: Verification and Docs

### Task 5: Update docs and verify the full backend slice

**Files:**
- Modify: `backend/README.md`
- Modify: `backend/openapi.yaml`

- [ ] **Step 1: Update backend README**

Document:
- question bank endpoints
- accepted question types and difficulty values
- import formats and required columns

- [ ] **Step 2: Run full verification**

Run: `backend\.venv\Scripts\python backend\manage.py check`
Expected: PASS.

Run: `backend\.venv\Scripts\python -m pytest backend/tests -q`
Expected: PASS with Rounds 1-3 green.

Run: `backend\.venv\Scripts\python backend\manage.py spectacular --file backend\openapi.yaml`
Expected: PASS with schema including questions, tags, revisions, and question-imports.

- [ ] **Step 3: Checkpoint note**

Because this workspace is not under Git, record completion in the session log instead of committing. If Git is initialized later, checkpoint after Round 3.
