# Scalable Proctoring With Webcam Live And 15-Day Snapshot Retention Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scalable proctoring control plane that supports near real-time webcam viewing for selected candidates, captures webcam and screen snapshots on violations, and deletes stored evidence automatically after 15 days without introducing stored video.

**Architecture:** Keep Django, Redis, Channels, and Celery as the exam-control and evidence-control plane, and integrate a pluggable external SFU media provider through short-lived tokens instead of routing media through Django. Extend the existing `proctoring` app with media-status and evidence-retention metadata, then upgrade the live candidate runner and admin monitoring UI to use the new control APIs while leaving exam submission, grading, and real-time monitoring snapshots behaviorally intact.

**Tech Stack:** Django 5, Django REST Framework, Channels, Celery, Redis, PostgreSQL/SQLite-compatible models, object storage via Django storages, React, TypeScript, Vitest, Testing Library, Vite

---

## File Map

- Create: `backend/apps/proctoring/tasks.py`
- Create: `backend/apps/proctoring/media.py`
- Create: `backend/apps/proctoring/migrations/0002_proctoring_media_and_evidence_retention.py`
- Create: `backend/tests/proctoring/test_tasks.py`
- Modify: `backend/apps/proctoring/models.py`
- Modify: `backend/apps/proctoring/services.py`
- Modify: `backend/apps/proctoring/admin.py`
- Modify: `backend/apps/proctoring/api/serializers.py`
- Modify: `backend/apps/proctoring/api/views.py`
- Modify: `backend/apps/proctoring/api/urls.py`
- Modify: `backend/config/settings/base.py`
- Modify: `backend/.env.example`
- Modify: `backend/tests/proctoring/test_models.py`
- Modify: `backend/tests/proctoring/test_services.py`
- Modify: `backend/tests/proctoring/test_candidate_api.py`
- Modify: `backend/tests/proctoring/test_admin_api.py`
- Modify: `backend/tests/proctoring/test_websocket.py`
- Create: `src/app/lib/proctoringCapture.ts`
- Create: `src/app/lib/proctoringMedia.ts`
- Create: `src/app/pages/TakeExam.test.tsx`
- Create: `src/app/pages/LiveMonitoring.test.tsx`
- Modify: `src/app/pages/TakeExam.tsx`
- Modify: `src/app/pages/LiveMonitoring.tsx`
- Modify: `src/test/setup.ts`
- Modify: `README.md`

## Scope Guard

This plan covers only the approved package:

- webcam live control-plane integration
- violation-triggered webcam and screen snapshots
- evidence retention and deletion after 15 days
- selected-candidate live monitoring in the admin UI
- production deployment and environment defaults for a split control/media architecture

This plan does not cover:

- actual SFU cluster provisioning scripts or Docker manifests
- stored webcam or screen video
- AI face detection or automated cheating analysis
- practice mode changes
- question import/export redesign

## Chunk 1: Proctoring Persistence And Retention

### Task 1: Write failing backend tests for evidence retention and media session state

**Files:**
- Create: `backend/tests/proctoring/test_tasks.py`
- Modify: `backend/tests/proctoring/test_models.py`
- Modify: `backend/tests/proctoring/test_services.py`

- [ ] **Step 1: Add a failing model test for retention metadata on `ProctorEvidence`**

```python
@pytest.mark.django_db
def test_proctor_evidence_can_track_expiry_and_deletion(subject, admin_user, candidate_user):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from apps.proctoring.models import ProctorEvidence

    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    evidence = ProctorEvidence.objects.create(
        session=session,
        evidence_type="webcam_snapshot",
        file=SimpleUploadedFile("webcam.png", b"img", content_type="image/png"),
        expires_at=timezone.now() + timedelta(days=15),
    )

    assert evidence.expires_at is not None
    assert evidence.deleted_at is None
```

- [ ] **Step 2: Add a failing service test for media-status updates on a session**

```python
@pytest.mark.django_db
def test_update_media_status_records_publish_and_capture_state(subject, admin_user, candidate_user):
    from apps.proctoring.services import update_media_status

    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)

    media_state = update_media_status(
        session=session,
        webcam_publish_status="publishing",
        webcam_publish_error="",
        screen_capture_status="ready",
        metadata={"provider": "self_hosted"},
    )

    assert media_state.webcam_publish_status == "publishing"
    assert media_state.screen_capture_status == "ready"
```

- [ ] **Step 3: Add a failing task test for deleting expired evidence files safely**

```python
@pytest.mark.django_db
def test_delete_expired_proctor_evidence_marks_record_deleted(subject, admin_user, candidate_user):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from apps.proctoring.models import ProctorEvidence
    from apps.proctoring.tasks import delete_expired_proctor_evidence

    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    evidence = ProctorEvidence.objects.create(
        session=session,
        evidence_type="screen_capture",
        file=SimpleUploadedFile("screen.png", b"img", content_type="image/png"),
        expires_at=timezone.now() - timedelta(minutes=1),
    )

    delete_expired_proctor_evidence()
    evidence.refresh_from_db()

    assert evidence.deleted_at is not None
    assert not evidence.file
```

- [ ] **Step 4: Run the focused proctoring tests to verify failure**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/proctoring/test_models.py backend/tests/proctoring/test_services.py backend/tests/proctoring/test_tasks.py -q`
Expected: FAIL because the new retention and media-status fields do not exist yet.

### Task 2: Extend proctoring models and add the cleanup task

**Files:**
- Modify: `backend/apps/proctoring/models.py`
- Create: `backend/apps/proctoring/tasks.py`
- Create: `backend/apps/proctoring/migrations/0002_proctoring_media_and_evidence_retention.py`
- Modify: `backend/apps/proctoring/admin.py`
- Modify: `backend/config/settings/base.py`

- [ ] **Step 1: Add a dedicated one-to-one media-state model for each `ExamSession`**

```python
class ProctoringMediaState(TimeStampedModel):
    class PublishStatus(models.TextChoices):
        IDLE = "idle", "Idle"
        PUBLISHING = "publishing", "Publishing"
        FAILED = "failed", "Failed"
        STOPPED = "stopped", "Stopped"

    class CaptureStatus(models.TextChoices):
        UNAVAILABLE = "unavailable", "Unavailable"
        READY = "ready", "Ready"
        REVOKED = "revoked", "Revoked"
        FAILED = "failed", "Failed"

    session = models.OneToOneField("exam_delivery.ExamSession", on_delete=models.CASCADE, related_name="proctoring_media_state")
    provider = models.CharField(max_length=32, default="self_hosted")
    room_name = models.CharField(max_length=255, blank=True)
    participant_name = models.CharField(max_length=255, blank=True)
    webcam_publish_status = models.CharField(max_length=16, choices=PublishStatus.choices, default=PublishStatus.IDLE)
    screen_capture_status = models.CharField(max_length=16, choices=CaptureStatus.choices, default=CaptureStatus.UNAVAILABLE)
    webcam_publish_error = models.TextField(blank=True)
    last_publish_at = models.DateTimeField(null=True, blank=True)
    last_status_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
```

- [ ] **Step 2: Extend `ProctorEvidence` with retention and deletion fields**

```python
expires_at = models.DateTimeField(default=_default_proctor_evidence_expiry)
deleted_at = models.DateTimeField(null=True, blank=True)
deletion_error = models.TextField(blank=True)
```

- [ ] **Step 3: Register the new media-state admin and expose retention fields in evidence admin**

```python
@admin.register(ProctoringMediaState)
class ProctoringMediaStateAdmin(admin.ModelAdmin):
    list_display = ("session", "provider", "webcam_publish_status", "screen_capture_status", "last_status_at")
```

- [ ] **Step 4: Add a Celery task that deletes expired evidence files and marks records deleted**

```python
@shared_task
def delete_expired_proctor_evidence():
    queryset = ProctorEvidence.objects.filter(
        deleted_at__isnull=True,
        expires_at__lte=timezone.now(),
    ).exclude(file="")
```

- [ ] **Step 5: Add environment-backed defaults for provider name and retention days**

```python
PROCTORING_MEDIA_PROVIDER = env("PROCTORING_MEDIA_PROVIDER")
PROCTORING_EVIDENCE_RETENTION_DAYS = env.int("PROCTORING_EVIDENCE_RETENTION_DAYS")
CELERY_BEAT_SCHEDULE["delete-expired-proctor-evidence"] = {
    "task": "apps.proctoring.tasks.delete_expired_proctor_evidence",
    "schedule": crontab(minute="*/15"),
}
```

- [ ] **Step 6: Create the migration**

Run: `backend\.venv\Scripts\python.exe backend\manage.py makemigrations proctoring`
Expected: a new migration that adds `ProctoringMediaState` and the evidence retention fields.

- [ ] **Step 7: Re-run the retention and model tests**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/proctoring/test_models.py backend/tests/proctoring/test_services.py backend/tests/proctoring/test_tasks.py -q`
Expected: PASS

- [ ] **Step 8: Commit the persistence slice**

```bash
git add backend/apps/proctoring/models.py backend/apps/proctoring/tasks.py backend/apps/proctoring/admin.py backend/apps/proctoring/migrations/0002_proctoring_media_and_evidence_retention.py backend/config/settings/base.py backend/tests/proctoring/test_models.py backend/tests/proctoring/test_services.py backend/tests/proctoring/test_tasks.py
git commit -m "feat: add proctoring media state and evidence retention"
```

## Chunk 2: Media Control APIs And Provider Adapter

### Task 3: Write failing API tests for media token issuance and status reporting

**Files:**
- Modify: `backend/tests/proctoring/test_candidate_api.py`
- Modify: `backend/tests/proctoring/test_admin_api.py`

- [ ] **Step 1: Add a failing candidate test for requesting a publish token**

```python
@pytest.mark.django_db
def test_candidate_can_request_media_publish_token(api_client, subject, admin_user, candidate_user):
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.post(f"/api/v1/proctoring/sessions/{session.id}/media/publish-token/", {}, format="json")

    assert response.status_code == 200
    assert response.json()["participant_name"]
```

- [ ] **Step 2: Add a failing candidate test for reporting webcam and screen status**

```python
@pytest.mark.django_db
def test_candidate_can_report_media_status(api_client, subject, admin_user, candidate_user):
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.post(
        f"/api/v1/proctoring/sessions/{session.id}/media/status/",
        {
            "webcam_publish_status": "publishing",
            "screen_capture_status": "ready",
            "metadata": {"browser": "chromium"},
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["webcam_publish_status"] == "publishing"
```

- [ ] **Step 3: Add a failing admin test for requesting a live-view token**

```python
@pytest.mark.django_db
def test_admin_can_request_view_token_for_candidate_session(api_client, admin_token, subject, admin_user, candidate_user):
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(f"/api/v1/proctoring/sessions/{session.id}/media/view-token/", {}, format="json")

    assert response.status_code == 200
    assert response.json()["room_name"]
```

- [ ] **Step 4: Run the focused API tests to verify failure**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/proctoring/test_candidate_api.py backend/tests/proctoring/test_admin_api.py -q`
Expected: FAIL because the media endpoints and serializers do not exist yet.

### Task 4: Add provider abstraction and the new proctoring API endpoints

**Files:**
- Create: `backend/apps/proctoring/media.py`
- Modify: `backend/apps/proctoring/services.py`
- Modify: `backend/apps/proctoring/api/serializers.py`
- Modify: `backend/apps/proctoring/api/views.py`
- Modify: `backend/apps/proctoring/api/urls.py`
- Modify: `backend/tests/proctoring/test_candidate_api.py`
- Modify: `backend/tests/proctoring/test_admin_api.py`

- [ ] **Step 1: Add a provider adapter with a stable interface for publish and view token generation**

```python
class MediaProviderToken(TypedDict):
    provider: str
    room_name: str
    participant_name: str
    access_token: str
    expires_at: str


class BaseMediaProvider:
    def build_publish_token(self, *, session, user) -> MediaProviderToken: ...
    def build_view_token(self, *, session, user) -> MediaProviderToken: ...
```

- [ ] **Step 2: Start with a self-hosted provider implementation behind env vars instead of hard-coding media credentials in views**

```python
def get_media_provider():
    provider = settings.PROCTORING_MEDIA_PROVIDER
    if provider == "self_hosted":
        return SelfHostedMediaProvider()
    raise ImproperlyConfigured(f"Unsupported proctoring media provider: {provider}")
```

- [ ] **Step 3: Add service functions for issuing tokens and updating media state**

```python
def issue_candidate_publish_token(*, session, user):
    assert_candidate_session_access(session=session, user=user)
    payload = get_media_provider().build_publish_token(session=session, user=user)
    update_media_status(
        session=session,
        webcam_publish_status=ProctoringMediaState.PublishStatus.IDLE,
        metadata={"room_name": payload["room_name"], "participant_name": payload["participant_name"]},
    )
    return payload
```

- [ ] **Step 4: Add serializers and views for publish-token, view-token, and media-status endpoints**

```python
path(
    "proctoring/sessions/<int:session_id>/media/publish-token/",
    CandidateSessionMediaPublishTokenView.as_view(),
    name="proctoring-session-media-publish-token",
),
path(
    "proctoring/sessions/<int:session_id>/media/status/",
    CandidateSessionMediaStatusView.as_view(),
    name="proctoring-session-media-status",
),
path(
    "proctoring/sessions/<int:session_id>/media/view-token/",
    AdminSessionMediaViewTokenView.as_view(),
    name="proctoring-session-media-view-token",
),
```

- [ ] **Step 5: Extend the monitoring snapshot serializer so admin clients can see media availability without opening the stream**

```python
"media": {
    "webcam_publish_status": media_state.webcam_publish_status if media_state else "idle",
    "screen_capture_status": media_state.screen_capture_status if media_state else "unavailable",
    "last_publish_at": media_state.last_publish_at.isoformat() if media_state and media_state.last_publish_at else None,
}
```

- [ ] **Step 6: Re-run the proctoring API tests and system check**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/proctoring/test_candidate_api.py backend/tests/proctoring/test_admin_api.py backend/tests/proctoring/test_services.py -q`
Expected: PASS

Run: `backend\.venv\Scripts\python.exe backend\manage.py check`
Expected: `System check identified no issues`

- [ ] **Step 7: Commit the API and provider slice**

```bash
git add backend/apps/proctoring/media.py backend/apps/proctoring/services.py backend/apps/proctoring/api/serializers.py backend/apps/proctoring/api/views.py backend/apps/proctoring/api/urls.py backend/tests/proctoring/test_candidate_api.py backend/tests/proctoring/test_admin_api.py
git commit -m "feat: add proctoring media control api"
```

## Chunk 3: Candidate Exam Runner Permission Gating And Snapshot Capture

### Task 5: Write failing frontend tests for permission gating and violation snapshots

**Files:**
- Create: `src/app/pages/TakeExam.test.tsx`
- Modify: `src/test/setup.ts`

- [ ] **Step 1: Add a failing test for blocking a proctored session when webcam access is denied**

```tsx
it("blocks the candidate when webcam permission is denied", async () => {
  mockGetUserMedia.mockRejectedValueOnce(new Error("denied"));
  renderTakeExam();
  expect(await screen.findByText(/webcam access is required/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Add a failing test for calling the new media token and status endpoints after permissions succeed**

```tsx
expect(mockApiRequest).toHaveBeenCalledWith(
  "/api/v1/proctoring/sessions/77/media/publish-token/",
  expect.objectContaining({ method: "POST" }),
);
expect(mockApiRequest).toHaveBeenCalledWith(
  "/api/v1/proctoring/sessions/77/media/status/",
  expect.objectContaining({ method: "POST" }),
);
```

- [ ] **Step 3: Add a failing test for uploading webcam and screen evidence after a fullscreen violation**

```tsx
expect(mockApiRequest).toHaveBeenCalledWith(
  "/api/v1/proctoring/sessions/77/events/",
  expect.objectContaining({ method: "POST" }),
);
expect(mockApiRequest).toHaveBeenCalledWith(
  "/api/v1/proctoring/sessions/77/evidence/",
  expect.objectContaining({ method: "POST" }),
);
```

- [ ] **Step 4: Run the focused exam-runner tests to verify failure**

Run: `npm.cmd test -- src/app/pages/TakeExam.test.tsx`
Expected: FAIL because the current exam runner has no permission-gating or snapshot upload orchestration.

### Task 6: Implement browser capture helpers and integrate them into `TakeExam`

**Files:**
- Create: `src/app/lib/proctoringCapture.ts`
- Create: `src/app/lib/proctoringMedia.ts`
- Modify: `src/app/pages/TakeExam.tsx`
- Modify: `src/test/setup.ts`
- Modify: `src/app/pages/TakeExam.test.tsx`

- [ ] **Step 1: Add a dedicated helper for acquiring webcam and screen streams plus single-frame snapshot capture**

```ts
export async function requestProctoringStreams() {
  const webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  return { webcamStream, screenStream };
}

export async function captureSnapshot(track: MediaStreamTrack): Promise<Blob> {
  // draw one frame to a canvas and export as PNG blob
}
```

- [ ] **Step 2: Add a focused helper for the new media-control API calls so `TakeExam.tsx` does not absorb provider details**

```ts
export async function requestPublishToken(sessionId: number) {
  return apiRequest(`/api/v1/proctoring/sessions/${sessionId}/media/publish-token/`, { method: "POST" });
}
```

- [ ] **Step 3: Add a proctoring preflight in `TakeExam.tsx` before the session enters the normal heartbeat loop**

```tsx
const [proctoringBlockReason, setProctoringBlockReason] = useState<string | null>(null);
const [captureResources, setCaptureResources] = useState<ProctoringCaptureResources | null>(null);
```

- [ ] **Step 4: When proctoring is enabled, request webcam and screen permission, then call the new publish-token and media-status endpoints**

```tsx
const tokenPayload = await requestPublishToken(session.id);
await reportMediaStatus(session.id, {
  webcam_publish_status: "publishing",
  screen_capture_status: "ready",
  metadata: { room_name: tokenPayload.room_name },
});
```

- [ ] **Step 5: Keep screen-share local-only and upload snapshots only when a violation event is recorded**

```tsx
const event = await apiRequest<ProctorEventRecord>(`/api/v1/proctoring/sessions/${session.id}/events/`, { ... });
await uploadEvidence(session.id, event.id, "webcam_snapshot", webcamBlob, metadata);
await uploadEvidence(session.id, event.id, "screen_capture", screenBlob, metadata);
```

- [ ] **Step 6: Track revoked screen sharing as a critical event and update media status accordingly**

```tsx
screenTrack.addEventListener("ended", () => {
  void reportMediaStatus(session.id, {
    webcam_publish_status: "publishing",
    screen_capture_status: "revoked",
    metadata: {},
  });
});
```

- [ ] **Step 7: Re-run the focused `TakeExam` tests**

Run: `npm.cmd test -- src/app/pages/TakeExam.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit the candidate runtime slice**

```bash
git add src/app/lib/proctoringCapture.ts src/app/lib/proctoringMedia.ts src/app/pages/TakeExam.tsx src/test/setup.ts src/app/pages/TakeExam.test.tsx
git commit -m "feat: add proctored exam media preflight"
```

## Chunk 4: Admin Monitoring Live View And Evidence Depth

### Task 7: Write failing admin UI tests for selected-candidate live view and evidence indicators

**Files:**
- Create: `src/app/pages/LiveMonitoring.test.tsx`

- [ ] **Step 1: Add a failing test for showing media availability in the candidate status list**

```tsx
expect(await screen.findByText(/webcam live available/i)).toBeInTheDocument();
expect(screen.getByText(/screen evidence ready/i)).toBeInTheDocument();
```

- [ ] **Step 2: Add a failing test for requesting a view token only when the admin opens a candidate stream**

```tsx
await user.click(screen.getByRole("button", { name: /open webcam/i }));
expect(mockApiRequest).toHaveBeenCalledWith(
  "/api/v1/proctoring/sessions/77/media/view-token/",
  expect.objectContaining({ method: "POST" }),
);
```

- [ ] **Step 3: Add a failing test for rendering linked evidence thumbnails in violation cases**

```tsx
expect(await screen.findByAltText(/webcam evidence/i)).toBeInTheDocument();
expect(screen.getByAltText(/screen evidence/i)).toBeInTheDocument();
```

- [ ] **Step 4: Run the monitoring UI tests to verify failure**

Run: `npm.cmd test -- src/app/pages/LiveMonitoring.test.tsx`
Expected: FAIL because the current page has no live-view or evidence-preview UI.

### Task 8: Upgrade the monitoring page to selective live viewing

**Files:**
- Modify: `backend/apps/proctoring/services.py`
- Modify: `backend/apps/proctoring/api/serializers.py`
- Modify: `src/app/pages/LiveMonitoring.tsx`
- Modify: `src/app/pages/LiveMonitoring.test.tsx`

- [ ] **Step 1: Extend monitoring snapshot payloads and case serializers with media availability and evidence preview URLs**

```python
class ViolationCaseSerializer(serializers.ModelSerializer):
    evidence_items = serializers.SerializerMethodField()
```

- [ ] **Step 2: Return the newest linked evidence previews directly from the case serializer to avoid N+1 fetches in the admin UI**

```python
def get_evidence_items(self, obj):
    return [
        {
            "id": evidence.id,
            "evidence_type": evidence.evidence_type,
            "file_url": safe_file_url(evidence),
            "captured_at": evidence.captured_at.isoformat(),
            "deleted_at": evidence.deleted_at.isoformat() if evidence.deleted_at else None,
        }
        for evidence in obj.evidences.order_by("-captured_at")[:4]
    ]
```

- [ ] **Step 3: Add a selected-candidate live panel in `LiveMonitoring.tsx` that requests a view token on demand instead of auto-subscribing everyone**

```tsx
const openLiveView = async (sessionId: number) => {
  const token = await apiRequest<MediaViewTokenRecord>(`/api/v1/proctoring/sessions/${sessionId}/media/view-token/`, {
    method: "POST",
  });
  setSelectedLiveView(token);
};
```

- [ ] **Step 4: Render clear media status labels and keep the rest of the dashboard triage-first**

```tsx
<p className="text-xs text-gray-500">
  Webcam: {candidateStatus.media.webcam_publish_status} • Screen: {candidateStatus.media.screen_capture_status}
</p>
```

- [ ] **Step 5: Re-run the monitoring UI tests and websocket regression**

Run: `npm.cmd test -- src/app/pages/LiveMonitoring.test.tsx`
Expected: PASS

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/proctoring/test_websocket.py -q`
Expected: PASS

- [ ] **Step 6: Commit the monitoring slice**

```bash
git add backend/apps/proctoring/services.py backend/apps/proctoring/api/serializers.py src/app/pages/LiveMonitoring.tsx src/app/pages/LiveMonitoring.test.tsx
git commit -m "feat: add selective live webcam monitoring"
```

## Chunk 5: Environment Defaults, Docs, And Full Verification

### Task 9: Document environment knobs and production assumptions

**Files:**
- Modify: `backend/.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add the new proctoring media and retention environment variables to `.env.example`**

```env
PROCTORING_MEDIA_PROVIDER=self_hosted
PROCTORING_MEDIA_API_URL=
PROCTORING_MEDIA_API_KEY=
PROCTORING_MEDIA_API_SECRET=
PROCTORING_EVIDENCE_RETENTION_DAYS=15
```

- [ ] **Step 2: Add a Windows-friendly README section for scalable proctoring deployment assumptions**

```md
## Proctoring architecture

- Django handles exam control, events, evidence metadata, and cleanup jobs.
- Webcam live traffic must go through a separate self-hosted SFU/media service.
- The app does not record video. Only violation snapshots are stored for 15 days.
```

- [ ] **Step 3: Add a short operational note that admins should view selected flagged candidates, not all candidates at once**

```md
The monitoring dashboard is designed for triage and selective live viewing. Do not expect one operator workstation to render every candidate webcam simultaneously.
```

- [ ] **Step 4: Re-read the docs changes**

Run: `Get-Content README.md -TotalCount 320`
Expected: the new proctoring section reads coherently and does not break the Windows-first setup guide.

### Task 10: Run the full verification matrix

**Files:**
- Modify: `README.md`
- Modify: `backend/.env.example`

- [ ] **Step 1: Run the full backend proctoring suite**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/proctoring/test_models.py backend/tests/proctoring/test_services.py backend/tests/proctoring/test_candidate_api.py backend/tests/proctoring/test_admin_api.py backend/tests/proctoring/test_websocket.py backend/tests/proctoring/test_tasks.py -q`
Expected: PASS

- [ ] **Step 2: Run live exam and candidate regression tests to ensure proctoring changes did not break delivery**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/exam_delivery/test_candidate_api.py backend/tests/grading/test_candidate_results_api.py backend/tests/notifications/test_api.py -q`
Expected: PASS

- [ ] **Step 3: Run the frontend regression pack including the new monitoring and exam-runner tests**

Run: `npm.cmd test -- src/app/routes.test.tsx src/app/pages/StudentShell.test.tsx src/app/pages/MyExams.test.tsx src/app/pages/PracticeExam.test.tsx src/app/pages/PracticeSession.test.tsx src/app/pages/PracticeReview.test.tsx src/app/pages/ResultDetail.test.tsx src/app/pages/StudentNotifications.test.tsx src/app/pages/TakeExam.test.tsx src/app/pages/LiveMonitoring.test.tsx`
Expected: PASS

- [ ] **Step 4: Run the production build**

Run: `npm.cmd run build`
Expected: Vite build completes without type or route errors.

- [ ] **Step 5: Run manual browser smoke checks**

Run manually:
- admin opens a live monitoring page
- candidate starts a proctored exam and grants webcam plus screen-share
- candidate triggers a fullscreen-exit violation
- admin sees the new alert and evidence previews
- admin opens the candidate webcam live panel

Expected:
- media tokens are requested from Django, not media streamed through `/api`
- violation snapshots are uploaded exactly once per violation trigger
- evidence appears in the case panel
- the normal exam submit flow still works

- [ ] **Step 6: Commit the docs and verification slice**

```bash
git add backend/.env.example README.md
git commit -m "docs: add scalable proctoring deployment guidance"
```
