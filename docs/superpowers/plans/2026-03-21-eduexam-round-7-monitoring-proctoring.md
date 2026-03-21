# EduExam Round 7 Monitoring and Proctoring Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the monitoring and proctoring slice for EduExam, covering session capability registration, heartbeat tracking, proctor event capture, evidence uploads, violation case review, monitoring APIs, and live monitoring websocket updates.

**Architecture:** Add a focused `proctoring` app attached to `exam_delivery.ExamSession`. Candidate-side APIs write capability, heartbeat, event, and evidence records, while admin-side APIs expose monitoring summaries and violation review actions. A Channels consumer broadcasts monitoring updates per exam via JWT-authenticated websocket connections so the existing live monitoring UI can move from mock data to realtime state.

**Tech Stack:** Python, Django, Django REST Framework, drf-spectacular, Channels, pytest, pytest-django

---

**Preconditions**

- Rounds 1-6 are already implemented in `backend/`.
- `exam_delivery.ExamSession` is the authoritative source for candidate exam state.
- `channels` is already installed and test settings use `InMemoryChannelLayer`.
- Round 7 should not yet implement native lockdown, recording pipelines, or report exports.
- The workspace is still not a Git repository, so worktree and commit steps remain informational only.

## Chunk 1: Proctoring Data Model

### Task 1: Create the `proctoring` app with capability, heartbeat, event, evidence, and violation models

**Files:**
- Create: `backend/apps/proctoring/__init__.py`
- Create: `backend/apps/proctoring/apps.py`
- Create: `backend/apps/proctoring/models.py`
- Create: `backend/apps/proctoring/admin.py`
- Create: `backend/apps/proctoring/migrations/__init__.py`
- Modify: `backend/config/settings/base.py`
- Create: `backend/tests/proctoring/__init__.py`
- Create: `backend/tests/proctoring/test_models.py`

- [ ] **Step 1: Write the failing model tests**

```python
def test_client_capability_is_unique_per_session(...):
    ClientCapability.objects.create(session=session, ...)
    with pytest.raises(IntegrityError):
        ClientCapability.objects.create(session=session, ...)
```

```python
def test_violation_case_can_track_multiple_events(...):
    case = ViolationCase.objects.create(session=session, ...)
    case.events.add(event_one, event_two)
    assert case.events.count() == 2
```

- [ ] **Step 2: Run the model tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/proctoring/test_models.py -q`
Expected: FAIL because the app and models do not exist yet.

- [ ] **Step 3: Implement the proctoring models**

```python
class ClientCapability(TimeStampedModel):
    session = models.OneToOneField(ExamSession, on_delete=models.CASCADE, related_name="client_capability")
    client_type = models.CharField(max_length=16, choices=ClientType.choices)
```

```python
class SessionHeartbeat(TimeStampedModel):
    session = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name="heartbeats")
    connection_status = models.CharField(max_length=16, choices=ConnectionStatus.choices)
```

```python
class ProctorEvent(TimeStampedModel):
    session = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name="proctor_events")
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.INFO)
```

```python
class ViolationCase(TimeStampedModel):
    session = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name="violation_cases")
    events = models.ManyToManyField(ProctorEvent, related_name="violation_cases", blank=True)
```

- [ ] **Step 4: Create and apply migrations**

Run: `backend\.venv\Scripts\python backend\manage.py makemigrations proctoring`
Expected: New migration file created.

Run: `backend\.venv\Scripts\python backend\manage.py migrate`
Expected: PASS.

- [ ] **Step 5: Re-run the model tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/proctoring/test_models.py -q`
Expected: PASS.

## Chunk 2: Proctoring Services and Broadcasts

### Task 2: Add services for capability registration, heartbeat logging, event capture, evidence creation, case resolution, and broadcast helpers

**Files:**
- Create: `backend/apps/proctoring/services.py`
- Create: `backend/tests/proctoring/test_services.py`

- [ ] **Step 1: Write failing service tests**

```python
def test_register_client_capability_upserts_capability_for_session(...):
    capability = register_client_capability(...)
    assert capability.client_type == "web"
```

```python
def test_record_proctor_event_creates_violation_case_for_warning_events(...):
    event = record_proctor_event(...)
    assert event.violation_cases.count() == 1
```

```python
def test_build_exam_monitoring_snapshot_returns_candidate_statuses_and_alerts(...):
    snapshot = build_exam_monitoring_snapshot(exam=exam)
    assert snapshot["total_candidates"] >= 1
```

```python
def test_resolve_violation_case_marks_case_resolved(...):
    resolve_violation_case(case=case, reviewer=admin_user, decision="resolved")
    assert case.status == "resolved"
```

- [ ] **Step 2: Run the service tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/proctoring/test_services.py -q`
Expected: FAIL because the services do not exist yet.

- [ ] **Step 3: Implement transactional proctoring helpers**

```python
@transaction.atomic
def register_client_capability(*, session, ...):
    ...
```

```python
@transaction.atomic
def record_heartbeat(*, session, ...):
    ...
```

```python
@transaction.atomic
def record_proctor_event(*, session, ...):
    ...
```

```python
def build_exam_monitoring_snapshot(*, exam):
    ...
```

- [ ] **Step 4: Re-run the service tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/proctoring/test_services.py -q`
Expected: PASS.

## Chunk 3: REST APIs

### Task 3: Add candidate proctoring APIs for capability, heartbeat, event, and evidence submission

**Files:**
- Create: `backend/apps/proctoring/api/__init__.py`
- Create: `backend/apps/proctoring/api/serializers.py`
- Create: `backend/apps/proctoring/api/views.py`
- Create: `backend/apps/proctoring/api/urls.py`
- Modify: `backend/config/urls.py`
- Modify: `backend/apps/identity/bootstrap.py`
- Modify: `backend/tests/conftest.py`
- Create: `backend/tests/proctoring/test_candidate_api.py`

- [ ] **Step 1: Write failing candidate proctoring API tests**

```python
def test_candidate_can_register_client_capability(...):
    response = api_client.post(f"/api/v1/proctoring/sessions/{session.id}/capability/", {...})
    assert response.status_code == 200
```

```python
def test_candidate_can_post_heartbeat(...):
    response = api_client.post(f"/api/v1/proctoring/sessions/{session.id}/heartbeats/", {...})
    assert response.status_code == 201
```

```python
def test_candidate_can_post_proctor_event_and_evidence(...):
    response = api_client.post(f"/api/v1/proctoring/sessions/{session.id}/events/", {...})
    assert response.status_code == 201
```

- [ ] **Step 2: Run the candidate API tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/proctoring/test_candidate_api.py -q`
Expected: FAIL because the routes and serializers do not exist yet.

- [ ] **Step 3: Implement candidate-side proctoring APIs**

```python
path("proctoring/sessions/<int:session_id>/capability/", ...)
path("proctoring/sessions/<int:session_id>/heartbeats/", ...)
path("proctoring/sessions/<int:session_id>/events/", ...)
path("proctoring/sessions/<int:session_id>/evidence/", ...)
```

- [ ] **Step 4: Re-run the candidate API tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/proctoring/test_candidate_api.py -q`
Expected: PASS.

### Task 4: Add admin monitoring and violation review APIs

**Files:**
- Modify: `backend/apps/proctoring/api/serializers.py`
- Modify: `backend/apps/proctoring/api/views.py`
- Create: `backend/tests/proctoring/test_admin_api.py`

- [ ] **Step 1: Write failing admin monitoring API tests**

```python
def test_admin_can_fetch_exam_monitoring_snapshot(...):
    response = api_client.get(f"/api/v1/proctoring/exams/{exam.id}/monitoring/")
    assert response.status_code == 200
```

```python
def test_admin_can_list_violation_cases(...):
    response = api_client.get("/api/v1/proctoring/cases/")
    assert response.status_code == 200
```

```python
def test_admin_can_resolve_violation_case(...):
    response = api_client.post(f"/api/v1/proctoring/cases/{case.id}/resolve/", {...})
    assert response.status_code == 200
```

- [ ] **Step 2: Run the admin API tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/proctoring/test_admin_api.py -q`
Expected: FAIL because the monitoring routes and actions do not exist yet.

- [ ] **Step 3: Implement monitoring snapshot and case review APIs**

```python
path("proctoring/exams/<int:exam_id>/monitoring/", ...)
router.register("proctoring/cases", ViolationCaseViewSet, ...)
```

- [ ] **Step 4: Re-run the admin API tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/proctoring/test_admin_api.py -q`
Expected: PASS.

## Chunk 4: WebSocket Monitoring Stream

### Task 5: Add JWT-authenticated websocket consumer for live monitoring updates

**Files:**
- Create: `backend/apps/proctoring/auth.py`
- Create: `backend/apps/proctoring/consumers.py`
- Create: `backend/apps/proctoring/routing.py`
- Modify: `backend/config/asgi.py`
- Create: `backend/tests/proctoring/test_websocket.py`

- [ ] **Step 1: Write failing websocket tests**

```python
async def test_monitoring_consumer_rejects_invalid_token(...):
    communicator = WebsocketCommunicator(application, "/ws/monitoring/exams/1/?token=bad")
    connected, _ = await communicator.connect()
    assert connected is False
```

```python
async def test_monitoring_consumer_receives_event_broadcast_for_exam(...):
    communicator = WebsocketCommunicator(application, f"/ws/monitoring/exams/{exam.id}/?token={token}")
    connected, _ = await communicator.connect()
    assert connected is True
```

- [ ] **Step 2: Run the websocket tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/proctoring/test_websocket.py -q`
Expected: FAIL because the auth middleware, routing, and consumer do not exist yet.

- [ ] **Step 3: Implement JWT websocket auth and consumer**

```python
websocket_urlpatterns = [
    path("ws/monitoring/exams/<int:exam_id>/", ExamMonitoringConsumer.as_asgi()),
]
```

```python
class ExamMonitoringConsumer(AsyncJsonWebsocketConsumer):
    ...
```

- [ ] **Step 4: Re-run the websocket tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/proctoring/test_websocket.py -q`
Expected: PASS.

## Chunk 5: Docs and Verification

### Task 6: Update docs and verify the full backend slice

**Files:**
- Modify: `backend/README.md`
- Modify: `backend/openapi.yaml`

- [ ] **Step 1: Update backend README**

Document:
- candidate proctoring endpoints
- monitoring snapshot and violation review endpoints
- websocket endpoint and JWT query-param auth contract
- core event and case status values

- [ ] **Step 2: Run full verification**

Run: `backend\.venv\Scripts\python backend\manage.py check`
Expected: PASS.

Run: `backend\.venv\Scripts\python -m pytest backend/tests -q`
Expected: PASS with Rounds 1-7 green.

Run: `backend\.venv\Scripts\python backend\manage.py spectacular --file backend\openapi.yaml`
Expected: PASS with schema including proctoring APIs.

- [ ] **Step 3: Checkpoint note**

Because this workspace is not under Git, record completion in the session log instead of committing. If Git is initialized later, checkpoint after Round 7.
