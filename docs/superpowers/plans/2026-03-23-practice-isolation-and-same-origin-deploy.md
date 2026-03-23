# Practice Isolation And Same-Origin Deploy Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a true question-bank-driven practice mode that never touches live exam sessions, and document the same-origin production deployment model that should be treated as the default for candidate traffic.

**Architecture:** Add a new backend `apps.practice` domain with its own session, question snapshot, autosave, submit, review, and history APIs. Rebuild `/candidate/practice` around those APIs, add dedicated practice session and review routes, and leave the live exam delivery stack (`ExamSession`, `/candidate/exam/:id`, proctoring, grading) behaviorally intact except for fixing links that currently point back to the wrong page once practice is isolated.

**Tech Stack:** Django 5, Django REST Framework, PostgreSQL/SQLite-compatible models, React, TypeScript, React Router, Vitest, Testing Library, Vite dev proxy

---

## File Map

- Create: `backend/apps/practice/__init__.py`
- Create: `backend/apps/practice/apps.py`
- Create: `backend/apps/practice/models.py`
- Create: `backend/apps/practice/services.py`
- Create: `backend/apps/practice/api/__init__.py`
- Create: `backend/apps/practice/api/serializers.py`
- Create: `backend/apps/practice/api/views.py`
- Create: `backend/apps/practice/api/urls.py`
- Create: `backend/apps/practice/migrations/__init__.py`
- Create: `backend/apps/practice/migrations/0001_initial.py`
- Create: `backend/tests/practice/test_services.py`
- Create: `backend/tests/practice/test_api.py`
- Modify: `backend/config/settings/base.py`
- Modify: `backend/config/urls.py`
- Modify: `backend/.env.example`
- Modify: `README.md`
- Modify: `src/app/routes.ts`
- Modify: `src/app/routes.test.tsx`
- Modify: `src/app/components/layouts/CandidateLayout.tsx`
- Modify: `src/app/pages/PracticeExam.tsx`
- Modify: `src/app/pages/TakeExam.tsx`
- Create: `src/app/pages/practiceShared.ts`
- Create: `src/app/pages/PracticeExam.test.tsx`
- Create: `src/app/pages/PracticeSession.tsx`
- Create: `src/app/pages/PracticeSession.test.tsx`
- Create: `src/app/pages/PracticeReview.tsx`
- Create: `src/app/pages/PracticeReview.test.tsx`

## Scope Guard

This plan only covers the approved package:

- isolated practice sessions from question bank
- candidate practice UI flow
- same-origin deploy documentation/defaults

This plan does not cover:

- real-result question-by-question review depth
- bulk import/export redesign or audit
- admin-curated practice sets

## Chunk 1: Backend Practice Domain

### Task 1: Write failing service tests for isolated practice behavior

**Files:**
- Create: `backend/tests/practice/test_services.py`

- [ ] **Step 1: Add a failing test for session creation that snapshots only objective questions from the selected subject and difficulty mix**

```python
def test_create_practice_session_snapshots_requested_objective_questions(candidate_user, subject, admin_user):
    from apps.practice.services import create_practice_session
    from apps.question_bank.services import create_question

    create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="Easy question",
        options=[{"key": "A", "text": "1"}, {"key": "B", "text": "2"}],
        correct_option_keys=["A"],
    )
    create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="hard",
        question_type="true_false",
        question_text="Hard question",
        options=[{"key": "A", "text": "True"}, {"key": "B", "text": "False"}],
        correct_option_keys=["A"],
    )

    session = create_practice_session(
        candidate=candidate_user,
        subject=subject,
        duration_minutes=25,
        difficulty_counts={"easy": 1, "medium": 0, "hard": 1},
    )

    assert session.questions.count() == 2
    assert {question.question_type for question in session.questions.all()} == {"multiple_choice", "true_false"}
    assert all(question.source_question_id for question in session.questions.all())
```

- [ ] **Step 2: Add a failing test for rejecting insufficient bank coverage and essay-only inventory**

```python
def test_create_practice_session_rejects_when_bank_cannot_fill_request(candidate_user, subject):
    from rest_framework.exceptions import ValidationError
    from apps.practice.services import create_practice_session

    with pytest.raises(ValidationError):
        create_practice_session(
            candidate=candidate_user,
            subject=subject,
            duration_minutes=20,
            difficulty_counts={"easy": 3, "medium": 0, "hard": 0},
        )
```

- [ ] **Step 3: Add a failing test for answer save and submit scoring inside the practice domain**

```python
def test_submit_practice_session_computes_correct_count_and_percentage(candidate_user, subject, admin_user):
    from apps.practice.services import create_practice_session, save_practice_answer, submit_practice_session
    from apps.question_bank.services import create_question

    create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="What is 1 + 1?",
        options=[{"key": "A", "text": "2"}, {"key": "B", "text": "3"}],
        correct_option_keys=["A"],
    )

    session = create_practice_session(
        candidate=candidate_user,
        subject=subject,
        duration_minutes=15,
        difficulty_counts={"easy": 1, "medium": 0, "hard": 0},
    )

    question = session.questions.first()
    save_practice_answer(session=session, session_question=question, selected_option_keys=["A"])
    submit_practice_session(session=session)

    session.refresh_from_db()
    assert session.status == "submitted"
    assert session.correct_count == 1
    assert session.score_percentage == Decimal("100.00")
```

- [ ] **Step 4: Run the new service tests to verify failure**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/practice/test_services.py -q`
Expected: FAIL because `apps.practice` and its services do not exist yet.

### Task 2: Add the new `apps.practice` domain and persistence models

**Files:**
- Create: `backend/apps/practice/__init__.py`
- Create: `backend/apps/practice/apps.py`
- Create: `backend/apps/practice/models.py`
- Create: `backend/apps/practice/migrations/__init__.py`
- Create: `backend/apps/practice/migrations/0001_initial.py`
- Modify: `backend/config/settings/base.py`

- [ ] **Step 1: Register `apps.practice` in Django**

```python
INSTALLED_APPS = [
    ...,
    "apps.notifications",
    "apps.practice",
]
```

- [ ] **Step 2: Add `PracticeSession`, `PracticeSessionQuestion`, and `PracticeAutosaveSnapshot` models with practice-only status and summary fields**

```python
class PracticeSession(TimeStampedModel):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In Progress"
        SUBMITTED = "submitted", "Submitted"
        EXPIRED = "expired", "Expired"
        ABANDONED = "abandoned", "Abandoned"

    candidate = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="practice_sessions")
    subject = models.ForeignKey("academics.Subject", on_delete=models.PROTECT, related_name="practice_sessions")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.IN_PROGRESS)
    duration_minutes = models.PositiveIntegerField()
    question_count = models.PositiveIntegerField()
    started_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    submitted_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(null=True, blank=True)
    correct_count = models.PositiveIntegerField(default=0)
    total_count = models.PositiveIntegerField(default=0)
    score_percentage = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
```

- [ ] **Step 3: Snapshot question payload inside `PracticeSessionQuestion` instead of linking runtime reads back to live delivery models**

```python
class PracticeSessionQuestion(TimeStampedModel):
    session = models.ForeignKey(PracticeSession, on_delete=models.CASCADE, related_name="questions")
    source_question = models.ForeignKey("question_bank.Question", on_delete=models.PROTECT, related_name="practice_snapshots")
    source_revision = models.ForeignKey("question_bank.QuestionRevision", on_delete=models.PROTECT, related_name="practice_snapshots")
    sort_order = models.PositiveIntegerField()
    difficulty = models.CharField(max_length=16)
    question_type = models.CharField(max_length=32)
    question_text = models.TextField()
    options_payload = models.JSONField(default=list, blank=True)
    correct_option_keys = models.JSONField(default=list, blank=True)
    explanation_text = models.TextField(blank=True)
    selected_option_keys = models.JSONField(default=list, blank=True)
    is_answered = models.BooleanField(default=False)
    is_marked_for_review = models.BooleanField(default=False)
    is_correct = models.BooleanField(null=True, blank=True)
```

- [ ] **Step 4: Add a small autosave model for resumable practice metadata**

```python
class PracticeAutosaveSnapshot(TimeStampedModel):
    session = models.ForeignKey(PracticeSession, on_delete=models.CASCADE, related_name="autosave_snapshots")
    payload = models.JSONField(default=dict, blank=True)
    answered_count = models.PositiveIntegerField(default=0)
    marked_count = models.PositiveIntegerField(default=0)
```

- [ ] **Step 5: Create the initial migration for the practice app**

Run: `backend\.venv\Scripts\python.exe backend\manage.py makemigrations practice`
Expected: a new `backend/apps/practice/migrations/0001_initial.py` defining the three practice tables.

### Task 3: Implement practice services with scalable question selection

**Files:**
- Create: `backend/apps/practice/services.py`
- Modify: `backend/tests/practice/test_services.py`

- [ ] **Step 1: Implement creation validation and avoid `order_by("?")` for random selection**

```python
def _pick_question_ids(*, subject, difficulty, count):
    eligible_ids = list(
        Question.objects.filter(
            subject=subject,
            question_type__in=[Question.Type.MULTIPLE_CHOICE, Question.Type.TRUE_FALSE],
            difficulty=difficulty,
            current_revision__isnull=False,
        ).values_list("id", flat=True)
    )
    if len(eligible_ids) < count:
        raise ValidationError("Not enough practice questions available for the requested configuration.")
    return random.sample(eligible_ids, count)
```

- [ ] **Step 2: Implement `create_practice_session` to snapshot question text, options, answers, and explanation data in one transaction**

```python
@transaction.atomic
def create_practice_session(*, candidate, subject, duration_minutes, difficulty_counts):
    selected_ids = []
    for difficulty, count in difficulty_counts.items():
        if count:
            selected_ids.extend(_pick_question_ids(subject=subject, difficulty=difficulty, count=count))

    questions = {
        question.id: question
        for question in Question.objects.select_related("current_revision__answer_key").prefetch_related("current_revision__options").filter(id__in=selected_ids)
    }

    session = PracticeSession.objects.create(
        candidate=candidate,
        subject=subject,
        duration_minutes=duration_minutes,
        question_count=len(selected_ids),
        started_at=timezone.now(),
        expires_at=timezone.now() + timedelta(minutes=duration_minutes),
        last_activity_at=timezone.now(),
    )
```

- [ ] **Step 3: Implement `save_practice_answer`, `create_practice_autosave_snapshot`, `submit_practice_session`, `get_remaining_seconds`, and `user_can_access_practice_session`**

```python
def save_practice_answer(*, session, session_question, selected_option_keys=None, is_marked_for_review=UNSET):
    now = _assert_session_is_active(session)
    session_question.selected_option_keys = [str(value) for value in selected_option_keys or []]
    session_question.is_answered = bool(session_question.selected_option_keys)
    if is_marked_for_review is not UNSET:
        session_question.is_marked_for_review = bool(is_marked_for_review)
    session_question.save(...)
    session.last_activity_at = now
    session.save(update_fields=["last_activity_at", "updated_at"])
```

- [ ] **Step 4: Re-run the service tests**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/practice/test_services.py -q`
Expected: PASS

- [ ] **Step 5: Commit the backend domain slice**

```bash
git add backend/apps/practice backend/config/settings/base.py backend/tests/practice/test_services.py
git commit -m "feat: add isolated practice session domain"
```

## Chunk 2: Backend Practice API

### Task 4: Write failing API tests for catalog, session lifecycle, and ownership guards

**Files:**
- Create: `backend/tests/practice/test_api.py`

- [ ] **Step 1: Add a failing test for the practice catalog endpoint**

```python
def test_candidate_can_fetch_practice_catalog(api_client, candidate_user, subject, admin_user):
    from apps.question_bank.services import create_question
    from rest_framework_simplejwt.tokens import RefreshToken

    create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="Catalog question",
        options=[{"key": "A", "text": "Yes"}, {"key": "B", "text": "No"}],
        correct_option_keys=["A"],
    )

    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.get("/api/v1/practice/catalog/")

    assert response.status_code == 200
    assert response.json()["results"][0]["subject"]["code"] == subject.code
```

- [ ] **Step 2: Add a failing test for full session lifecycle through the API**

```python
def test_candidate_can_create_answer_submit_and_review_practice_session(api_client, candidate_user, subject, admin_user):
    from apps.question_bank.services import create_question
    from rest_framework_simplejwt.tokens import RefreshToken

    create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="Practice lifecycle question",
        options=[{"key": "A", "text": "2"}, {"key": "B", "text": "3"}],
        correct_option_keys=["A"],
    )

    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    create_response = api_client.post(
        "/api/v1/practice/sessions/",
        {
            "subject_id": subject.id,
            "duration_minutes": 20,
            "difficulty_counts": {"easy": 1, "medium": 0, "hard": 0},
        },
        format="json",
    )

    assert create_response.status_code == 201
    session_id = create_response.json()["id"]
```

- [ ] **Step 3: Add a failing test for ownership and immutability guards**

```python
def test_candidate_cannot_access_other_users_practice_session(api_client, candidate_user, user, subject, admin_user):
    from apps.practice.services import create_practice_session
    from apps.question_bank.services import create_question
    from rest_framework_simplejwt.tokens import RefreshToken

    create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="Owned question",
        options=[{"key": "A", "text": "1"}, {"key": "B", "text": "0"}],
        correct_option_keys=["A"],
    )

    practice_session = create_practice_session(
        candidate=candidate_user,
        subject=subject,
        duration_minutes=15,
        difficulty_counts={"easy": 1, "medium": 0, "hard": 0},
    )

    token = str(RefreshToken.for_user(user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.get(f"/api/v1/practice/sessions/{practice_session.id}/")
    assert response.status_code == 403
```

- [ ] **Step 4: Run the API tests to verify failure**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/practice/test_api.py -q`
Expected: FAIL because the practice API endpoints are not wired yet.

### Task 5: Implement the practice API contract and route registration

**Files:**
- Create: `backend/apps/practice/api/__init__.py`
- Create: `backend/apps/practice/api/serializers.py`
- Create: `backend/apps/practice/api/views.py`
- Create: `backend/apps/practice/api/urls.py`
- Modify: `backend/config/urls.py`
- Modify: `backend/config/settings/base.py`
- Modify: `backend/tests/practice/test_api.py`

- [ ] **Step 1: Add serializers for catalog, create-session input, session detail, answer save, autosave, history, and review**

```python
class PracticeSessionCreateSerializer(serializers.Serializer):
    subject_id = serializers.IntegerField()
    duration_minutes = serializers.IntegerField(min_value=5, max_value=180)
    difficulty_counts = serializers.DictField(child=serializers.IntegerField(min_value=0))

    def validate(self, attrs):
        counts = attrs["difficulty_counts"]
        if sum(counts.get(level, 0) for level in ("easy", "medium", "hard")) <= 0:
            raise serializers.ValidationError("At least one practice question is required.")
        return attrs
```

- [ ] **Step 2: Implement API views with explicit ownership checks and practice-only service calls**

```python
class PracticeSessionCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PracticeSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subject = get_object_or_404(Subject, pk=serializer.validated_data["subject_id"], is_active=True)
        session = create_practice_session(
            candidate=request.user,
            subject=subject,
            duration_minutes=serializer.validated_data["duration_minutes"],
            difficulty_counts=serializer.validated_data["difficulty_counts"],
        )
        return Response(PracticeSessionSerializer(session).data, status=status.HTTP_201_CREATED)
```

- [ ] **Step 3: Expose the approved routes under `/api/v1/practice/`**

```python
urlpatterns = [
    path("catalog/", PracticeCatalogView.as_view(), name="practice-catalog"),
    path("history/", PracticeHistoryView.as_view(), name="practice-history"),
    path("sessions/", PracticeSessionCreateView.as_view(), name="practice-session-create"),
    path("sessions/<int:pk>/", PracticeSessionDetailView.as_view(), name="practice-session-detail"),
    path("sessions/<int:session_id>/answers/<int:question_id>/", PracticeSessionAnswerView.as_view(), name="practice-session-answer"),
    path("sessions/<int:pk>/autosave/", PracticeSessionAutosaveView.as_view(), name="practice-session-autosave"),
    path("sessions/<int:pk>/submit/", PracticeSessionSubmitView.as_view(), name="practice-session-submit"),
    path("sessions/<int:pk>/review/", PracticeSessionReviewView.as_view(), name="practice-session-review"),
]
```

- [ ] **Step 4: Add an enum override for the new practice status so schema generation stays stable**

```python
"PracticeSessionStatusEnum": "apps.practice.models.PracticeSession.Status",
```

- [ ] **Step 5: Re-run the API tests and a focused schema sanity check**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/practice/test_api.py backend/tests/practice/test_services.py -q`
Expected: PASS

Run: `backend\.venv\Scripts\python.exe backend\manage.py check`
Expected: `System check identified no issues`

- [ ] **Step 6: Commit the API slice**

```bash
git add backend/apps/practice backend/config/urls.py backend/config/settings/base.py backend/tests/practice/test_api.py
git commit -m "feat: expose isolated practice api"
```

## Chunk 3: Frontend Practice Hub And Routing

### Task 6: Write failing frontend tests for the new practice routes and landing page

**Files:**
- Modify: `src/app/routes.test.tsx`
- Create: `src/app/pages/PracticeExam.test.tsx`

- [ ] **Step 1: Extend route coverage for the practice session and review routes**

```tsx
expect(matchRoutes(routeConfig, "/candidate/practice/sessions/7")).toBeTruthy();
expect(matchRoutes(routeConfig, "/candidate/practice/sessions/7/review")).toBeTruthy();
```

- [ ] **Step 2: Add a failing landing-page test that only accepts practice endpoints**

```tsx
mockApiRequest.mockImplementation(async (path: string) => {
  if (path === "/api/v1/practice/catalog/") {
    return { results: [{ subject: { id: 1, name: "Mathematics", code: "MATH101", color: "bg-blue-600" }, counts: { easy: 12, medium: 8, hard: 5 } }] };
  }
  if (path === "/api/v1/practice/history/") {
    return { count: 0, next: null, previous: null, results: [] };
  }
  throw new Error(`Unhandled apiRequest path: ${path}`);
});

expect(await screen.findByText("Quick Practice")).toBeInTheDocument();
expect(screen.getByRole("button", { name: /start practice/i })).toBeInTheDocument();
```

- [ ] **Step 3: Add a failing test for resumable practice sessions and recent history rendering**

```tsx
expect(await screen.findByText("Resume session")).toBeInTheDocument();
expect(screen.getByText("Latest practice history")).toBeInTheDocument();
```

- [ ] **Step 4: Run the route and landing tests to verify failure**

Run: `npm.cmd test -- src/app/routes.test.tsx src/app/pages/PracticeExam.test.tsx`
Expected: FAIL because the new routes and landing page data contract do not exist yet.

### Task 7: Rebuild `/candidate/practice` as a real practice hub

**Files:**
- Modify: `src/app/routes.ts`
- Modify: `src/app/components/layouts/CandidateLayout.tsx`
- Modify: `src/app/pages/PracticeExam.tsx`
- Create: `src/app/pages/practiceShared.ts`
- Modify: `src/app/pages/TakeExam.tsx`
- Modify: `src/app/routes.test.tsx`
- Modify: `src/app/pages/PracticeExam.test.tsx`

- [ ] **Step 1: Add shared types and small formatting helpers for catalog, sessions, history, and review**

```ts
export interface PracticeCatalogSubjectRecord { ... }
export interface PracticeSessionRecord { ... }
export const formatPracticeWindow = (startedAt: string, durationMinutes: number) => ...
```

- [ ] **Step 2: Register the new practice routes**

```ts
const PracticeSessionRoute = lazyRoute(() => import("./pages/PracticeSession"), "PracticeSession");
const PracticeReviewRoute = lazyRoute(() => import("./pages/PracticeReview"), "PracticeReview");

{ path: "practice/sessions/:id", Component: PracticeSessionRoute },
{ path: "practice/sessions/:id/review", Component: PracticeReviewRoute },
```

- [ ] **Step 3: Let `CandidateLayout` treat practice sessions as full-focus routes just like live exams**

```tsx
if (
  location.pathname.startsWith("/candidate/exam/") ||
  location.pathname.startsWith("/candidate/practice/sessions/")
) {
  return <Outlet />;
}
```

- [ ] **Step 4: Rebuild `PracticeExam.tsx` so it loads `/api/v1/practice/catalog/` and `/api/v1/practice/history/` instead of `/api/v1/my-exams/`**

```tsx
const catalog = useAsyncList(() => apiRequest<PracticeCatalogResponse>("/api/v1/practice/catalog/"), []);
const history = useAsyncList(() => apiRequest<PaginatedResponse<PracticeHistoryItem>>("/api/v1/practice/history/", { query: { page_size: 10 } }), []);
```

- [ ] **Step 5: Add a quick-practice form with subject, duration, and difficulty counts that posts to `/api/v1/practice/sessions/`**

```tsx
const handleCreateSession = async () => {
  const session = await apiRequest<PracticeSessionRecord>("/api/v1/practice/sessions/", {
    method: "POST",
    body: formState,
  });
  navigate(`/candidate/practice/sessions/${session.id}`);
};
```

- [ ] **Step 6: Render resumable in-progress sessions and recent submitted history on the landing page**

```tsx
const resumableSessions = history.data?.results.filter((item) => item.status === "in_progress") ?? [];
```

- [ ] **Step 7: Fix live-exam back links in `TakeExam.tsx` so real exams return to `/candidate/exams`, not to the new practice area**

```tsx
<Link to="/candidate/exams">Back to My Exams</Link>
```

- [ ] **Step 8: Re-run the route and practice landing tests**

Run: `npm.cmd test -- src/app/routes.test.tsx src/app/pages/PracticeExam.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit the routing and hub slice**

```bash
git add src/app/routes.ts src/app/routes.test.tsx src/app/components/layouts/CandidateLayout.tsx src/app/pages/PracticeExam.tsx src/app/pages/practiceShared.ts src/app/pages/TakeExam.tsx src/app/pages/PracticeExam.test.tsx
git commit -m "feat: rebuild candidate practice hub"
```

## Chunk 4: Frontend Practice Runner And Review

### Task 8: Write failing tests for the practice session runner and review page

**Files:**
- Create: `src/app/pages/PracticeSession.test.tsx`
- Create: `src/app/pages/PracticeReview.test.tsx`

- [ ] **Step 1: Add a failing test for loading and answering a practice session**

```tsx
expect(await screen.findByText("Question 1")).toBeInTheDocument();
await user.click(screen.getByLabelText("Option A"));
expect(mockApiRequest).toHaveBeenCalledWith(
  "/api/v1/practice/sessions/44/answers/301/",
  expect.objectContaining({ method: "PUT" }),
);
```

- [ ] **Step 2: Add a failing autosave test using fake timers**

```tsx
vi.useFakeTimers();
await act(async () => {
  vi.advanceTimersByTime(30000);
});
expect(mockApiRequest).toHaveBeenCalledWith(
  "/api/v1/practice/sessions/44/autosave/",
  expect.objectContaining({ method: "POST" }),
);
```

- [ ] **Step 3: Add a failing review-page test for correct versus incorrect answers**

```tsx
expect(await screen.findByText("Score 50%")).toBeInTheDocument();
expect(screen.getByText(/your answer/i)).toBeInTheDocument();
expect(screen.getByText(/correct answer/i)).toBeInTheDocument();
```

- [ ] **Step 4: Run the new tests to verify failure**

Run: `npm.cmd test -- src/app/pages/PracticeSession.test.tsx src/app/pages/PracticeReview.test.tsx`
Expected: FAIL because neither page exists yet.

### Task 9: Implement the isolated practice runner and review experience

**Files:**
- Create: `src/app/pages/PracticeSession.tsx`
- Create: `src/app/pages/PracticeReview.tsx`
- Create: `src/app/pages/PracticeSession.test.tsx`
- Create: `src/app/pages/PracticeReview.test.tsx`
- Modify: `src/app/routes.ts`
- Modify: `src/app/pages/practiceShared.ts`

- [ ] **Step 1: Build `PracticeSession.tsx` with its own API adapter and no exam/proctoring calls**

```tsx
const loadSession = () => apiRequest<PracticeSessionRecord>(`/api/v1/practice/sessions/${sessionId}/`);
const saveAnswer = (questionId: number, payload: PracticeAnswerPayload) =>
  apiRequest<PracticeAnswerResponse>(`/api/v1/practice/sessions/${sessionId}/answers/${questionId}/`, {
    method: "PUT",
    body: payload,
  });
```

- [ ] **Step 2: Keep the runner objective-only and serialise mutations to avoid autosave and answer races**

```tsx
const enqueueMutation = async <T,>(task: () => Promise<T>) => {
  const previous = requestQueueRef.current;
  let release = () => undefined;
  requestQueueRef.current = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await task();
  } finally {
    release();
  }
};
```

- [ ] **Step 3: Submit practice sessions into the review route instead of showing the live-exam completion card**

```tsx
await apiRequest(`/api/v1/practice/sessions/${session.id}/submit/`, { method: "POST" });
navigate(`/candidate/practice/sessions/${session.id}/review`);
```

- [ ] **Step 4: Build `PracticeReview.tsx` to render summary metrics and per-question comparisons from `/review/`**

```tsx
const review = useAsyncList(
  () => apiRequest<PracticeReviewRecord>(`/api/v1/practice/sessions/${sessionId}/review/`),
  [sessionId],
);
```

- [ ] **Step 5: Display explanation text only when the snapshot carries it, and keep empty-state copy honest when it does not**

```tsx
{question.explanation_text ? <p>{question.explanation_text}</p> : null}
```

- [ ] **Step 6: Re-run the session and review tests**

Run: `npm.cmd test -- src/app/pages/PracticeSession.test.tsx src/app/pages/PracticeReview.test.tsx`
Expected: PASS

- [ ] **Step 7: Run the broader candidate regression pack**

Run: `npm.cmd test -- src/app/routes.test.tsx src/app/pages/StudentShell.test.tsx src/app/pages/MyExams.test.tsx src/app/pages/PracticeExam.test.tsx src/app/pages/PracticeSession.test.tsx src/app/pages/PracticeReview.test.tsx src/app/pages/ResultDetail.test.tsx src/app/pages/StudentNotifications.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit the practice runner slice**

```bash
git add src/app/pages/PracticeSession.tsx src/app/pages/PracticeReview.tsx src/app/pages/practiceShared.ts src/app/pages/PracticeSession.test.tsx src/app/pages/PracticeReview.test.tsx src/app/routes.ts
git commit -m "feat: add isolated practice session flow"
```

## Chunk 5: Same-Origin Deploy Defaults And Final Verification

### Task 10: Document the same-origin production standard and local expectations

**Files:**
- Modify: `backend/.env.example`
- Modify: `README.md`

- [ ] **Step 1: Update `.env.example` so local defaults stay explicit and the secret placeholder stops advertising `change-me`**

```env
SECRET_KEY=replace-with-a-long-random-secret-key
FRONTEND_BASE_URL=http://127.0.0.1:5173
```

- [ ] **Step 2: Add a README section that standardizes production on one public origin**

```md
## Production deploy default

- frontend: `https://exam.example.com/`
- api: `https://exam.example.com/api/...`
- websocket: `wss://exam.example.com/ws/...`

For production, leave `VITE_API_BASE_URL` empty so the browser stays same-origin.
Local development continues to use the Vite proxy in `vite.config.ts`.
```

- [ ] **Step 3: Add one short note that split-origin browser deployments are not the default and should be treated as a special-case follow-up**

```md
If you intentionally separate frontend and backend origins later, add an explicit CORS package/config package instead of treating it as the default exam runtime path.
```

- [ ] **Step 4: Re-read the docs changes in rendered markdown form**

Run: `Get-Content README.md -TotalCount 260`
Expected: the setup flow still reads coherently for Windows and now includes a clear same-origin production section.

### Task 11: Run the final verification matrix

**Files:**
- Modify: `README.md`
- Modify: `backend/.env.example`

- [ ] **Step 1: Run the focused backend practice suite**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/practice/test_api.py backend/tests/practice/test_services.py -q`
Expected: PASS

- [ ] **Step 2: Run candidate and exam-delivery regression tests so the real exam path stays intact**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/exam_delivery/test_candidate_api.py backend/tests/grading/test_candidate_results_api.py backend/tests/notifications/test_api.py -q`
Expected: PASS

- [ ] **Step 3: Run the frontend regression pack and production build**

Run: `npm.cmd test -- src/app/routes.test.tsx src/app/pages/StudentShell.test.tsx src/app/pages/MyExams.test.tsx src/app/pages/PracticeExam.test.tsx src/app/pages/PracticeSession.test.tsx src/app/pages/PracticeReview.test.tsx src/app/pages/ResultDetail.test.tsx src/app/pages/StudentNotifications.test.tsx`
Expected: PASS

Run: `npm.cmd run build`
Expected: Vite build completes without route or type errors.

- [ ] **Step 4: Run a browser smoke test across both flows**

Run manually:
- candidate login
- open `/candidate/practice`
- create a practice session
- answer and submit practice
- open practice review
- open `/candidate/exams`
- start or resume a real exam

Expected:
- practice never hits `/api/v1/exams/:id/start-session/`
- real exams never route through `/api/v1/practice/...`
- same-origin local dev still works via `/api` and `/ws`

- [ ] **Step 5: Commit the docs and verification slice**

```bash
git add backend/.env.example README.md
git commit -m "docs: standardize same-origin deployment guidance"
```
