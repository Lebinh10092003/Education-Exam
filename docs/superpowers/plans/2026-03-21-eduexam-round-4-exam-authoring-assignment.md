# EduExam Round 4 Exam Authoring and Assignment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the exam authoring and assignment backend slice for EduExam, covering exam CRUD, versioned question selection, schedule and settings, random question rules, exam cloning, and assignment to candidate groups and individual users.

**Architecture:** Add a focused `exam_authoring` app that separates mutable exam metadata from immutable version snapshots of question composition. Use transactional services to create and revise exams, expose REST APIs for exam management and assignment workflows, and reuse `question_bank` revisions so published exams reference stable question content.

**Tech Stack:** Python, Django, Django REST Framework, drf-spectacular, pytest, pytest-django

---

**Preconditions**

- Rounds 1-3 are already implemented in `backend/`.
- The workspace is still not a Git repository, so worktree and commit steps remain informational only.
- Round 4 should not yet create candidate sessions or scoring flows.

## Chunk 1: Exam Authoring Data Model

### Task 1: Create the `exam_authoring` app with exam, version, item, random rule, schedule, and assignment models

**Files:**
- Create: `backend/apps/exam_authoring/__init__.py`
- Create: `backend/apps/exam_authoring/apps.py`
- Create: `backend/apps/exam_authoring/models.py`
- Create: `backend/apps/exam_authoring/admin.py`
- Create: `backend/apps/exam_authoring/migrations/__init__.py`
- Modify: `backend/config/settings/base.py`
- Create: `backend/tests/exam_authoring/__init__.py`
- Create: `backend/tests/exam_authoring/test_models.py`

- [ ] **Step 1: Write the failing model tests**

```python
def test_exam_version_numbers_increment_per_exam(...):
    exam = Exam.objects.create(...)
    ExamVersion.objects.create(exam=exam, version_number=1, created_by=user)
    version = ExamVersion.objects.create(exam=exam, version_number=2, created_by=user)
    assert version.version_number == 2
```

```python
def test_exam_assignment_is_unique_per_exam_target(...):
    ExamAssignment.objects.create(exam=exam, group=group)
    with pytest.raises(IntegrityError):
        ExamAssignment.objects.create(exam=exam, group=group)
```

- [ ] **Step 2: Run the model tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_authoring/test_models.py -q`
Expected: FAIL because the app and models do not exist yet.

- [ ] **Step 3: Implement the core models**

```python
class Exam(TimeStampedModel):
    name = models.CharField(max_length=255)
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="exams")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
```

```python
class ExamVersion(TimeStampedModel):
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField()
```

```python
class ExamItem(TimeStampedModel):
    version = models.ForeignKey(ExamVersion, on_delete=models.CASCADE, related_name="items")
    question_revision = models.ForeignKey(QuestionRevision, on_delete=models.PROTECT)
```

```python
class ExamAssignment(TimeStampedModel):
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="assignments")
    group = models.ForeignKey(CandidateGroup, null=True, blank=True, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE)
```

- [ ] **Step 4: Create and apply migrations**

Run: `backend\.venv\Scripts\python backend\manage.py makemigrations exam_authoring`
Expected: New migration file created.

Run: `backend\.venv\Scripts\python backend\manage.py migrate`
Expected: PASS.

- [ ] **Step 5: Re-run model tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_authoring/test_models.py -q`
Expected: PASS.

## Chunk 2: Transactional Authoring Services

### Task 2: Add exam creation, revision, clone, and assignment sync services

**Files:**
- Create: `backend/apps/exam_authoring/services.py`
- Create: `backend/tests/exam_authoring/test_services.py`

- [ ] **Step 1: Write failing service tests**

```python
def test_create_exam_builds_current_version_schedule_and_assignments(...):
    exam = create_exam(...)
    assert exam.current_version.version_number == 1
    assert exam.assignments.count() == 2
```

```python
def test_update_exam_creates_new_version_without_mutating_old_items(...):
    exam = create_exam(...)
    old_version = exam.current_version
    updated = revise_exam(exam=exam, ...)
    assert updated.current_version.version_number == 2
    assert old_version.items.count() == 2
```

```python
def test_clone_exam_copies_current_version_and_assignments(...):
    cloned = clone_exam(exam=source_exam, created_by=user)
    assert cloned.current_version.items.count() == source_exam.current_version.items.count()
```

- [ ] **Step 2: Run the service tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_authoring/test_services.py -q`
Expected: FAIL because the services do not exist yet.

- [ ] **Step 3: Implement transactional service helpers**

```python
@transaction.atomic
def create_exam(...):
    exam = Exam.objects.create(...)
    version = ExamVersion.objects.create(...)
    ExamItem.objects.bulk_create(...)
```

```python
def sync_exam_assignments(exam, *, group_ids, user_ids):
    ...
```

- [ ] **Step 4: Re-run the service tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_authoring/test_services.py -q`
Expected: PASS.

## Chunk 3: Exam APIs and Assignment Workflows

### Task 3: Build serializers and viewsets for exam management, wizard create/update, and cloning

**Files:**
- Create: `backend/apps/exam_authoring/api/__init__.py`
- Create: `backend/apps/exam_authoring/api/serializers.py`
- Create: `backend/apps/exam_authoring/api/views.py`
- Create: `backend/apps/exam_authoring/api/urls.py`
- Modify: `backend/config/urls.py`
- Modify: `backend/apps/identity/bootstrap.py`
- Create: `backend/tests/exam_authoring/test_api.py`

- [ ] **Step 1: Write failing exam API tests**

```python
def test_admin_can_create_exam_with_manual_questions_random_rules_and_groups(...):
    response = api_client.post("/api/v1/exams/", {...})
    assert response.status_code == 201
```

```python
def test_exam_list_supports_search_and_status_filters(...):
    response = api_client.get("/api/v1/exams/?search=math&status=draft")
    assert response.status_code == 200
```

```python
def test_exam_update_creates_new_version(...):
    response = api_client.patch(f"/api/v1/exams/{exam.id}/", {...})
    assert response.status_code == 200
    assert response.json()["current_version"]["version_number"] == 2
```

```python
def test_clone_endpoint_creates_new_exam_copy(...):
    response = api_client.post(f"/api/v1/exams/{exam.id}/clone/")
    assert response.status_code == 201
```

- [ ] **Step 2: Run the exam API tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_authoring/test_api.py -q`
Expected: FAIL because the routes and serializers do not exist yet.

- [ ] **Step 3: Implement serializers and nested read models**

```python
class ExamWriteSerializer(serializers.Serializer):
    subject_id = serializers.PrimaryKeyRelatedField(...)
    manual_question_ids = serializers.ListField(...)
    random_rules = ExamRandomRuleInputSerializer(many=True, required=False)
```

- [ ] **Step 4: Implement exam viewset and clone action**

```python
class ExamViewSet(ModelViewSet):
    permission_codes = {"GET": "exams.view", "POST": "exams.manage", ...}

    @action(detail=True, methods=["post"])
    def clone(self, request, pk=None):
        ...
```

- [ ] **Step 5: Re-run the exam API tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_authoring/test_api.py -q`
Expected: PASS.

### Task 4: Add assignment-summary and assignment-sync APIs for the exam assignment screen

**Files:**
- Modify: `backend/apps/exam_authoring/api/serializers.py`
- Modify: `backend/apps/exam_authoring/api/views.py`
- Create: `backend/tests/exam_authoring/test_assignment_api.py`

- [ ] **Step 1: Write failing assignment API tests**

```python
def test_assignment_summary_returns_all_groups_with_assigned_flags(...):
    response = api_client.get(f"/api/v1/exams/{exam.id}/group-assignments/")
    assert response.status_code == 200
```

```python
def test_assignment_sync_replaces_existing_group_assignments(...):
    response = api_client.post(f"/api/v1/exams/{exam.id}/group-assignments/", {"group_ids": [...]})
    assert response.status_code == 200
```

- [ ] **Step 2: Run the assignment API tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_authoring/test_assignment_api.py -q`
Expected: FAIL because the actions do not exist yet.

- [ ] **Step 3: Implement group-assignment summary and sync actions**

```python
@action(detail=True, methods=["get", "post"], url_path="group-assignments")
def group_assignments(self, request, pk=None):
    ...
```

- [ ] **Step 4: Re-run the assignment API tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_authoring/test_assignment_api.py -q`
Expected: PASS.

## Chunk 4: Docs and Verification

### Task 5: Update docs and verify the full backend slice

**Files:**
- Modify: `backend/README.md`
- Modify: `backend/openapi.yaml`

- [ ] **Step 1: Update backend README**

Document:
- exam endpoints
- exam status values
- manual question selection and random rule payload shape
- assignment sync endpoints

- [ ] **Step 2: Run full verification**

Run: `backend\.venv\Scripts\python backend\manage.py check`
Expected: PASS.

Run: `backend\.venv\Scripts\python -m pytest backend/tests -q`
Expected: PASS with Rounds 1-4 green.

Run: `backend\.venv\Scripts\python backend\manage.py spectacular --file backend\openapi.yaml`
Expected: PASS with schema including exams, versions, items, schedules, and assignment actions.

- [ ] **Step 3: Checkpoint note**

Because this workspace is not under Git, record completion in the session log instead of committing. If Git is initialized later, checkpoint after Round 4.
