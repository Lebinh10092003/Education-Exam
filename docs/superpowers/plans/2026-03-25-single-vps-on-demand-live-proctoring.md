# Single-VPS On-Demand Live Proctoring Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the current proctoring runtime so a single VPS can support far more concurrent candidates by removing periodic database hot-path writes, keeping webcam and screen capture local by default, and only publishing live webcam when an admin explicitly requests it.

**Architecture:** Shift hot runtime state from PostgreSQL to Redis, replace eager webcam publishing with an admin-triggered publish flow, and make monitoring consume deltas instead of frequent full reloads. Keep durable exam, event, evidence, and violation records in Django/PostgreSQL while ensuring webcam and screen images are stored only for violations or capture-related failures.

**Tech Stack:** Django 5, Django REST Framework, Channels, Redis, Celery, PostgreSQL-compatible Django models, React, TypeScript, Vitest, Testing Library, LiveKit

---

## File Map

- Modify: `backend/config/settings/base.py`
- Modify: `backend/apps/proctoring/services.py`
- Modify: `backend/apps/proctoring/consumers.py`
- Modify: `backend/apps/proctoring/routing.py`
- Modify: `backend/apps/proctoring/api/views.py`
- Modify: `backend/apps/proctoring/api/serializers.py`
- Modify: `backend/apps/proctoring/api/urls.py`
- Modify: `backend/apps/exam_delivery/services.py`
- Modify: `backend/apps/exam_delivery/api/views.py`
- Modify: `backend/apps/exam_delivery/api/serializers.py`
- Modify: `backend/apps/proctoring/media.py`
- Create: `backend/apps/proctoring/runtime.py`
- Create: `backend/tests/proctoring/test_runtime.py`
- Modify: `backend/tests/proctoring/test_candidate_api.py`
- Modify: `backend/tests/proctoring/test_admin_api.py`
- Modify: `backend/tests/proctoring/test_services.py`
- Modify: `backend/tests/proctoring/test_websocket.py`
- Modify: `backend/tests/exam_delivery/test_session_api.py`
- Modify: `src/app/pages/TakeExam.tsx`
- Modify: `src/app/pages/LiveMonitoring.tsx`
- Modify: `src/app/lib/proctoringMedia.ts`
- Modify: `src/app/lib/proctoringCapture.ts`
- Modify: `src/app/pages/TakeExam.test.tsx`
- Modify: `src/app/pages/LiveMonitoring.test.tsx`
- Modify: `README.md`
- Modify: `backend/.env.example`

## Chunk 1: Hot State And Database Write Reduction

### Task 1: Add Redis-backed runtime helpers for presence, live requests, and quotas

**Files:**
- Create: `backend/apps/proctoring/runtime.py`
- Modify: `backend/config/settings/base.py`
- Test: `backend/tests/proctoring/test_runtime.py`

- [ ] **Step 1: Write the failing runtime helper tests**

```python
def test_refresh_presence_sets_expected_ttl():
    ...

def test_live_slot_acquire_and_release_enforces_quota():
    ...

def test_runtime_snapshot_reads_from_redis_when_present():
    ...
```

- [ ] **Step 2: Run the runtime helper tests to verify failure**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/proctoring/test_runtime.py -q`
Expected: FAIL because `apps.proctoring.runtime` does not exist yet.

- [ ] **Step 3: Implement the Redis runtime module**

```python
def refresh_presence(*, session_id, exam_id, payload):
    ...

def mark_live_request(*, session_id, enabled):
    ...

def acquire_live_slot(*, session_id, max_slots):
    ...

def release_live_slot(*, session_id):
    ...
```

- [ ] **Step 4: Add env-backed runtime defaults**

```python
PROCTORING_PRESENCE_TTL_SECONDS = env.int("PROCTORING_PRESENCE_TTL_SECONDS", default=150)
PROCTORING_HEARTBEAT_INTERVAL_SECONDS = env.int("PROCTORING_HEARTBEAT_INTERVAL_SECONDS", default=60)
PROCTORING_MAX_CONCURRENT_LIVE_VIEWS = env.int("PROCTORING_MAX_CONCURRENT_LIVE_VIEWS", default=5)
```

- [ ] **Step 5: Re-run the runtime helper tests**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/proctoring/test_runtime.py -q`
Expected: PASS

- [ ] **Step 6: Commit the runtime helper slice**

```bash
git add backend/apps/proctoring/runtime.py backend/config/settings/base.py backend/tests/proctoring/test_runtime.py
git commit -m "feat: add redis-backed proctoring runtime state"
```

### Task 2: Remove periodic database hot-path writes from heartbeat and autosave flows

**Files:**
- Modify: `backend/apps/proctoring/services.py`
- Modify: `backend/apps/proctoring/api/views.py`
- Modify: `backend/apps/exam_delivery/services.py`
- Modify: `backend/apps/exam_delivery/api/views.py`
- Modify: `backend/apps/exam_delivery/api/serializers.py`
- Modify: `src/app/pages/TakeExam.tsx`
- Modify: `src/app/pages/TakeExam.test.tsx`
- Test: `backend/tests/proctoring/test_services.py`
- Test: `backend/tests/proctoring/test_candidate_api.py`
- Test: `backend/tests/exam_delivery/test_session_api.py`

- [ ] **Step 1: Add failing backend tests for non-persistent heartbeat and lightweight autosave**

```python
def test_record_heartbeat_refreshes_runtime_state_without_creating_rows():
    ...

def test_autosave_endpoint_returns_last_saved_timestamp_without_creating_snapshot_history():
    ...
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/proctoring/test_services.py backend/tests/proctoring/test_candidate_api.py backend/tests/exam_delivery/test_session_api.py -q`
Expected: FAIL because the current implementation still inserts `SessionHeartbeat` and `AutosaveSnapshot` rows.

- [ ] **Step 3: Rework heartbeat service behavior**

```python
def record_heartbeat(...):
    runtime_state = refresh_presence(...)
    _broadcast_exam_monitoring_update(...)
    return runtime_state
```

- [ ] **Step 3a: Add transition persistence for offline/reconnect and other material state changes**

```python
def persist_runtime_transition(*, session, transition, metadata=None):
    SessionHeartbeat.objects.create(
        session=session,
        connection_status=transition,
        payload=metadata or {},
    )
```

Required transitions:
- offline beyond threshold
- reconnect after offline
- live publish started
- live publish stopped
- capture failure

- [ ] **Step 4: Rework autosave behavior to reuse response timestamps instead of creating snapshots**

```python
def create_autosave_snapshot(*, session, payload=None):
    now = _assert_session_is_active(session)
    session.last_activity_at = now
    session.save(update_fields=["last_activity_at", "updated_at"])
    return {"created_at": now, "payload": payload or {}}
```

- [ ] **Step 5: Update serializers/views to accept the lightweight autosave response shape**

```python
class AutosaveSnapshotSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    payload = serializers.JSONField(required=False)
    created_at = serializers.DateTimeField()
```

- [ ] **Step 6: Re-run the focused tests**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/proctoring/test_services.py backend/tests/proctoring/test_candidate_api.py backend/tests/exam_delivery/test_session_api.py -q`
Expected: PASS

- [ ] **Step 7: Add the client-side save semantics required by the spec**

```tsx
// multiple choice
await saveAnswer(question.id, { selected_option_keys: [value] })

// essay
useEffect(() => {
  const timer = window.setTimeout(() => flushDirtyEssay(), 25_000)
  return () => window.clearTimeout(timer)
}, [dirtyEssayVersion])

const flushBeforeQuestionChange = async () => {
  await persistEssayAnswer()
}
```

- [ ] **Step 8: Extend the candidate exam tests for debounce, blur flush, question-change flush, and no periodic autosave rows**

```tsx
it("flushes dirty essay text on blur and question change", async () => {
  ...
})

it("does not depend on periodic autosave snapshots for the saved indicator", async () => {
  ...
})
```

- [ ] **Step 9: Re-run the focused backend and frontend tests**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/proctoring/test_services.py backend/tests/proctoring/test_candidate_api.py backend/tests/exam_delivery/test_session_api.py -q`
Expected: PASS

Run: `npm.cmd test -- src/app/pages/TakeExam.test.tsx`
Expected: PASS

- [ ] **Step 10: Commit the hot-path reduction slice**

```bash
git add backend/apps/proctoring/services.py backend/apps/proctoring/api/views.py backend/apps/exam_delivery/services.py backend/apps/exam_delivery/api/views.py backend/apps/exam_delivery/api/serializers.py backend/tests/proctoring/test_services.py backend/tests/proctoring/test_candidate_api.py backend/tests/exam_delivery/test_session_api.py src/app/pages/TakeExam.tsx src/app/pages/TakeExam.test.tsx
git commit -m "feat: remove periodic heartbeat and autosave db writes"
```

## Chunk 2: Candidate Publish-On-Demand And Violation-Only Evidence

### Task 3: Stop eager webcam publishing and add control-channel live requests

**Files:**
- Modify: `backend/apps/proctoring/consumers.py`
- Modify: `backend/apps/proctoring/routing.py`
- Modify: `backend/apps/proctoring/services.py`
- Modify: `backend/tests/proctoring/test_websocket.py`
- Modify: `src/app/pages/TakeExam.tsx`
- Modify: `src/app/lib/proctoringMedia.ts`
- Modify: `src/app/pages/TakeExam.test.tsx`

- [ ] **Step 1: Add failing websocket and candidate-runtime tests**

```python
def test_candidate_control_consumer_receives_live_request_message():
    ...
```

```tsx
it("does not request a publish token during protected exam startup", async () => {
  ...
})

it("starts publishing only after a live-request control message arrives", async () => {
  ...
})
```

- [ ] **Step 2: Run the focused backend and frontend tests to verify failure**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/proctoring/test_websocket.py -q`
Expected: FAIL because there is no candidate control consumer yet.

Run: `npm.cmd test -- src/app/pages/TakeExam.test.tsx`
Expected: FAIL because startup still requests `/media/publish-token/`.

- [ ] **Step 3: Add a candidate control websocket consumer and routing**

```python
class CandidateControlConsumer(AsyncJsonWebsocketConsumer):
    async def live_request(self, event):
        await self.send_json({"type": "live_request", "payload": event["payload"]})
```

- [ ] **Step 4: Add service helpers to broadcast live on/off requests**

```python
def request_candidate_live_publish(*, session, requested_by):
    ...

def stop_candidate_live_publish(*, session, requested_by):
    ...
```

- [ ] **Step 5: Update `TakeExam.tsx` so startup stays local-only**

```tsx
await requestProctoringStreams()
await registerCapability(...)
// no publish token request here
```

- [ ] **Step 6: Update the candidate client to start/stop LiveKit only on control messages**

```tsx
if (message.type === "live_request" && message.payload.enabled) {
  await startLivePublish()
}
if (message.type === "live_request" && !message.payload.enabled) {
  await stopLivePublish()
}
```

- [ ] **Step 7: Re-run the focused backend and frontend tests**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/proctoring/test_websocket.py -q`
Expected: PASS

Run: `npm.cmd test -- src/app/pages/TakeExam.test.tsx`
Expected: PASS

- [ ] **Step 8: Add timeout-safe stop behavior and verified slot release hooks**

```python
def stop_candidate_live_publish(..., reason="admin_stopped"):
    release_live_slot(session_id=session.id)
    ...
```

```tsx
if (message.type === "live_request" && !message.payload.enabled) {
  await stopLivePublish({ reason: message.payload.reason })
}
```

- [ ] **Step 9: Re-run the focused backend and frontend tests**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/proctoring/test_websocket.py -q`
Expected: PASS

Run: `npm.cmd test -- src/app/pages/TakeExam.test.tsx`
Expected: PASS

- [ ] **Step 10: Commit the candidate on-demand live slice**

```bash
git add backend/apps/proctoring/consumers.py backend/apps/proctoring/routing.py backend/apps/proctoring/services.py backend/tests/proctoring/test_websocket.py src/app/pages/TakeExam.tsx src/app/lib/proctoringMedia.ts src/app/pages/TakeExam.test.tsx
git commit -m "feat: make candidate webcam publish on demand"
```

### Task 4: Store evidence only for violations or capture-related failures, and compress images before upload

**Files:**
- Modify: `src/app/lib/proctoringCapture.ts`
- Modify: `src/app/pages/TakeExam.tsx`
- Modify: `src/app/pages/TakeExam.test.tsx`
- Modify: `backend/tests/proctoring/test_candidate_api.py`

- [ ] **Step 1: Add failing frontend tests for violation-only evidence**

```tsx
it("does not upload evidence during normal exam startup", async () => {
  ...
})

it("uploads compressed webcam and screen evidence only after a violation", async () => {
  ...
})

it("captures evidence for tab switch, fullscreen exit, screen-share end, and manual alert paths", async () => {
  ...
})
```

- [ ] **Step 2: Run the focused frontend test to verify failure**

Run: `npm.cmd test -- src/app/pages/TakeExam.test.tsx`
Expected: FAIL until image compression and violation-only upload conditions are implemented.

- [ ] **Step 3: Add compression support to `proctoringCapture.ts`**

```ts
export async function captureTrackSnapshot(track: MediaStreamTrack, options?: { maxWidth?: number; quality?: number }) {
  ...
  canvas.toBlob(resolve, "image/jpeg", options?.quality ?? 0.75)
}
```

- [ ] **Step 4: Keep evidence uploads tied strictly to violation/error paths**

```tsx
const captureViolationEvidence = async (...) => {
  const webcamSnapshot = await captureTrackSnapshot(track, { maxWidth: 1280, quality: 0.75 })
  ...
}
```

Required V1 triggers:
- tab switch
- fullscreen exit
- unexpected screen-share end
- manual alert
- explicit capture failures classified as alert-worthy

- [ ] **Step 5: Re-run the focused frontend test**

Run: `npm.cmd test -- src/app/pages/TakeExam.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit the evidence-policy slice**

```bash
git add src/app/lib/proctoringCapture.ts src/app/pages/TakeExam.tsx src/app/pages/TakeExam.test.tsx backend/tests/proctoring/test_candidate_api.py
git commit -m "feat: limit evidence uploads to violations and compress images"
```

## Chunk 3: Admin Live Requests And Delta-Driven Monitoring

### Task 5: Add admin live-request APIs with Redis-backed slot enforcement

**Files:**
- Modify: `backend/apps/proctoring/api/views.py`
- Modify: `backend/apps/proctoring/api/serializers.py`
- Modify: `backend/apps/proctoring/api/urls.py`
- Modify: `backend/apps/proctoring/services.py`
- Modify: `backend/tests/proctoring/test_admin_api.py`
- Modify: `src/app/pages/LiveMonitoring.tsx`
- Modify: `src/app/pages/LiveMonitoring.test.tsx`

- [ ] **Step 1: Add failing admin API tests**

```python
def test_admin_can_request_candidate_live_publish():
    ...

def test_admin_cannot_request_live_publish_when_slot_quota_is_exhausted():
    ...

def test_admin_cannot_request_more_than_per_exam_live_limit():
    ...

def test_admin_can_stop_candidate_live_publish():
    ...
```

- [ ] **Step 2: Run the focused admin API tests to verify failure**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/proctoring/test_admin_api.py -q`
Expected: FAIL because the live-request endpoints do not exist yet.

- [ ] **Step 3: Add request/stop endpoints and serializers**

```python
path("proctoring/sessions/<int:session_id>/media/live-request/", AdminSessionLiveRequestView.as_view(), ...)
path("proctoring/sessions/<int:session_id>/media/live-stop/", AdminSessionLiveStopView.as_view(), ...)
```

- [ ] **Step 4: Wire the endpoints to runtime quota enforcement and websocket signals**

```python
payload = request_candidate_live_publish(session=session, requested_by=request.user)
return Response(payload, status=200)
```

The service must enforce both:
- global cap: `PROCTORING_MAX_CONCURRENT_LIVE_VIEWS`
- per-exam cap: `PROCTORING_MAX_LIVE_VIEWS_PER_EXAM`

- [ ] **Step 5: Add the admin-side handshake for joining and leaving the room**

```tsx
const openLiveView = async (candidateStatus) => {
  await apiRequest(`/api/v1/proctoring/sessions/${candidateStatus.session_id}/media/live-request/`, { method: "POST" })
  const token = await requestViewToken(candidateStatus.session_id)
  const room = await connectViewerRoom(token)
  ...
}

const closeLiveView = async () => {
  await apiRequest(`/api/v1/proctoring/sessions/${selectedSessionId}/media/live-stop/`, { method: "POST" })
  await disconnectRoom(liveRoomRef.current)
}
```

- [ ] **Step 6: Add a timeout-safe cleanup path**

```tsx
useEffect(() => {
  return () => {
    if (selectedSessionId) {
      void apiRequest(`/api/v1/proctoring/sessions/${selectedSessionId}/media/live-stop/`, { method: "POST" })
    }
  }
}, [selectedSessionId])
```

- [ ] **Step 7: Re-run the focused admin API and frontend tests**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/proctoring/test_admin_api.py -q`
Expected: PASS

Run: `npm.cmd test -- src/app/pages/LiveMonitoring.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit the admin live-request slice**

```bash
git add backend/apps/proctoring/api/views.py backend/apps/proctoring/api/serializers.py backend/apps/proctoring/api/urls.py backend/apps/proctoring/services.py backend/tests/proctoring/test_admin_api.py src/app/pages/LiveMonitoring.tsx src/app/pages/LiveMonitoring.test.tsx
git commit -m "feat: add admin-triggered live request controls"
```

### Task 6: Convert monitoring UI from frequent full reloads to delta-driven updates

**Files:**
- Modify: `backend/apps/proctoring/services.py`
- Modify: `backend/apps/proctoring/consumers.py`
- Modify: `backend/tests/proctoring/test_websocket.py`
- Modify: `src/app/pages/LiveMonitoring.tsx`
- Modify: `src/app/pages/LiveMonitoring.test.tsx`

- [ ] **Step 1: Add failing tests for delta-driven monitoring**

```tsx
it("does not poll the full monitoring snapshot every 5 seconds", async () => {
  ...
})

it("updates candidate rows from websocket deltas without forcing a full reload", async () => {
  ...
})
```

- [ ] **Step 2: Run the focused test suite to verify failure**

Run: `npm.cmd test -- src/app/pages/LiveMonitoring.test.tsx`
Expected: FAIL because the page still auto-polls and reloads snapshots.

- [ ] **Step 3: Extend monitoring broadcasts to include runtime deltas**

```python
_broadcast_exam_monitoring_update(
    exam_id=session.exam_id,
    message_type="candidate_runtime",
    payload={...},
)
```

- [ ] **Step 4: Update `LiveMonitoring.tsx` to apply websocket deltas in memory**

```tsx
if (message.type === "candidate_runtime") {
  setSnapshot((current) => applyRuntimeDelta(current, message.payload))
  return
}
```

- [ ] **Step 5: Remove the 5-second full reload loop and keep manual or long-interval recovery only**

```tsx
// delete the 5000ms interval effect
```

- [ ] **Step 6: Re-run the focused websocket and frontend tests**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/proctoring/test_websocket.py -q`
Expected: PASS

Run: `npm.cmd test -- src/app/pages/LiveMonitoring.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit the monitoring delta slice**

```bash
git add backend/apps/proctoring/services.py backend/apps/proctoring/consumers.py backend/tests/proctoring/test_websocket.py src/app/pages/LiveMonitoring.tsx src/app/pages/LiveMonitoring.test.tsx
git commit -m "feat: make monitoring updates delta-driven"
```

## Chunk 4: Configuration, Docs, And Verification

### Task 7: Expose production knobs for the single-VPS mode

**Files:**
- Modify: `backend/.env.example`
- Modify: `README.md`
- Modify: `backend/config/settings/base.py`

- [ ] **Step 1: Add env defaults for the optimized runtime**

```env
PROCTORING_HEARTBEAT_INTERVAL_SECONDS=60
PROCTORING_PRESENCE_TTL_SECONDS=150
PROCTORING_MAX_CONCURRENT_LIVE_VIEWS=5
PROCTORING_MAX_LIVE_VIEWS_PER_EXAM=3
PROCTORING_ESSAY_DEBOUNCE_SECONDS=25
PROCTORING_ESSAY_FORCE_FLUSH_SECONDS=120
PROCTORING_EVIDENCE_MAX_WIDTH=1280
PROCTORING_EVIDENCE_IMAGE_QUALITY=0.75
PROCTORING_EVIDENCE_TARGET_MAX_BYTES=250000
PROCTORING_MAX_EVIDENCE_UPLOADS_PER_EVENT=2
PROCTORING_EVIDENCE_RETENTION_DAYS=7
```

- [ ] **Step 2: Wire the new knobs into Django settings and client config readers**

```python
PROCTORING_MAX_LIVE_VIEWS_PER_EXAM = env.int("PROCTORING_MAX_LIVE_VIEWS_PER_EXAM", default=3)
PROCTORING_ESSAY_DEBOUNCE_SECONDS = env.int("PROCTORING_ESSAY_DEBOUNCE_SECONDS", default=25)
PROCTORING_ESSAY_FORCE_FLUSH_SECONDS = env.int("PROCTORING_ESSAY_FORCE_FLUSH_SECONDS", default=120)
```

- [ ] **Step 3: Document the on-demand live-view model**

```md
- candidate webcam and screen capture stay local by default
- live webcam publishing starts only when an admin requests it
- webcam and screen images are stored only for violations or capture errors
```

- [ ] **Step 4: Re-read the docs for coherence**

Run: `Get-Content README.md -TotalCount 320`
Expected: clear documentation of the optimized single-VPS operating mode.

- [ ] **Step 5: Commit the configuration/docs slice**

```bash
git add backend/.env.example README.md backend/config/settings/base.py
git commit -m "docs: add single-vps on-demand proctoring guidance"
```

### Task 8: Run the full focused verification matrix

**Files:**
- Modify: none

- [ ] **Step 1: Run the backend verification pack**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/proctoring/test_runtime.py backend/tests/proctoring/test_candidate_api.py backend/tests/proctoring/test_admin_api.py backend/tests/proctoring/test_services.py backend/tests/proctoring/test_websocket.py backend/tests/exam_delivery/test_session_api.py -q`
Expected: PASS

- [ ] **Step 2: Run the frontend verification pack**

Run: `npm.cmd test -- src/app/pages/TakeExam.test.tsx src/app/pages/LiveMonitoring.test.tsx`
Expected: PASS

- [ ] **Step 3: Run the production build**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 4: Run the failure-mode checks called for by the spec**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/proctoring/test_runtime.py backend/tests/proctoring/test_websocket.py -q`
Expected: PASS with explicit coverage for reconnect, slot release, and degraded runtime behavior.

- [ ] **Step 5: Prepare and document the post-merge validation commands for load/failure drills**

Document at minimum:
- 1,000 concurrent candidate control-plane test
- 3 to 5 concurrent live-view test
- Redis restart drill
- LiveKit restart drill
- PostgreSQL slowdown or restart drill
- candidate disconnect/reconnect drill

Expected: README or rollout notes include the commands or scripts to run on the VPS.

- [ ] **Step 6: Summarize any verification blocked by the harness**

Examples:
- browser-only smoke tests
- load tests for 1,000 concurrent sessions
- OS-level service tuning on the real VPS

- [ ] **Step 7: Commit any final verification-only adjustments if needed**

```bash
git add .
git commit -m "test: finalize single-vps on-demand proctoring verification"
```
