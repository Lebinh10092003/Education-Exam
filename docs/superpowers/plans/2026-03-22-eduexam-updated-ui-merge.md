# EduExam Updated UI Merge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the updated admin and candidate UI into the current EduExam application, preserve the existing auth/session/self-lock behavior, wire approved screens into live backend APIs, and add only the missing backend domains required by the approved design.

**Architecture:** Keep the current React/Vite SPA structure and Django REST backend structure intact. Extend the existing route guards, data-loading hooks, and page patterns instead of replacing them. Reuse existing backend domains for exams, grading, results, materials, and identity; add focused support for group member import, candidate-scoped views, notifications, audit events, exam periods, and exam rooms.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, Django, Django REST Framework, SimpleJWT, pytest, Vitest, Testing Library

---

**Preconditions**

- The approved design spec is `docs/superpowers/specs/2026-03-22-eduexam-updated-ui-merge-design.md`.
- The current branch already contains the auth/session/self-lock and SweetAlert2 work and must not regress those behaviors.
- The backend virtual environment is expected at `backend/.venv`.
- The frontend currently does not expose a test runner script, so this plan adds a minimal Vitest + Testing Library setup first.
- `ImportJobs` is intentionally out of scope and must not be recreated as a standalone screen.

## Chunk 1: Frontend Test Baseline and Route Shell Merge

### Task 1: Add a minimal frontend test harness for route and layout regression coverage

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/app/routes.test.tsx`

- [ ] **Step 1: Write the failing route protection and default-route tests**

```tsx
it("keeps candidate default routing on practice after login", () => {
  expect(getDefaultRouteForProfile(candidateProfile)).toBe("/candidate/practice");
});
```

```tsx
it("renders protected admin shell for admin users", async () => {
  renderWithRouter("/");
  expect(await screen.findByText(/dashboard/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Add the test toolchain and test script**

Run:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Then update `package.json`:

```json
"scripts": {
  "build": "vite build",
  "dev": "vite",
  "test": "vitest run"
}
```

- [ ] **Step 3: Configure Vitest and shared test setup**

Add a browser-like test environment through `vite.config.ts` or an equivalent Vitest config:

```ts
test: {
  environment: "jsdom",
  setupFiles: ["./src/test/setup.ts"],
}
```

And in `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 4: Run the frontend route tests and verify they pass**

Run:

```bash
npm run test -- src/app/routes.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/test/setup.ts src/app/routes.test.tsx
git commit -m "test: add frontend route regression harness"
```

### Task 2: Expand routing and layout shells without breaking current auth/session behavior

**Files:**
- Modify: `src/app/routes.ts`
- Modify: `src/app/components/layouts/AdminLayout.tsx`
- Modify: `src/app/components/layouts/CandidateLayout.tsx`
- Modify: `src/app/components/auth/ProtectedRoute.tsx`
- Test: `src/app/routes.test.tsx`

- [ ] **Step 1: Write the failing shell and route coverage tests**

```tsx
it("registers the new admin routes under ProtectedAdminLayout", () => {
  expect(findRoute("/manual-grading")).toBeTruthy();
  expect(findRoute("/notifications")).toBeTruthy();
});
```

```tsx
it("registers candidate dashboard, results, and materials routes without changing the default candidate landing route", () => {
  expect(findRoute("/candidate/dashboard")).toBeTruthy();
  expect(getDefaultRouteForProfile(candidateProfile)).toBe("/candidate/practice");
});
```

- [ ] **Step 2: Add the approved route entries**

Update `src/app/routes.ts` to add:

```ts
{ path: "exams/:id", Component: ExamDetail }
{ path: "manual-grading", Component: ManualGrading }
{ path: "roles-permissions", Component: RolesPermissions }
{ path: "notifications", Component: NotificationCenter }
{ path: "audit", Component: AuditCenter }
{ path: "exam-periods", Component: ExamPeriods }
{ path: "exam-rooms", Component: ExamRooms }
```

and:

```ts
{ index: true, Component: CandidateDashboard }
{ path: "dashboard", Component: CandidateDashboard }
{ path: "results", Component: CandidateResults }
{ path: "materials", Component: CandidateMaterials }
```

- [ ] **Step 3: Upgrade `AdminLayout` and `CandidateLayout` shells**

Keep the current `AdminLayout` responsive behavior and auth-backed profile menu, then add the approved navigation items.

Turn `CandidateLayout` into a shared shell:

```tsx
export function CandidateLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <CandidateHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
```

Use `useAuth().logout()` instead of `Link`-only logout behavior.

- [ ] **Step 4: Re-run the frontend route tests**

Run:

```bash
npm run test -- src/app/routes.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/routes.ts src/app/components/layouts/AdminLayout.tsx src/app/components/layouts/CandidateLayout.tsx src/app/components/auth/ProtectedRoute.tsx src/app/routes.test.tsx
git commit -m "feat: expand protected route shells for updated UI"
```

## Chunk 2: Existing-Domain Screens Over Live APIs

### Task 3: Implement `ExamDetail` over the existing exam API instead of keeping it mock-only

**Files:**
- Create: `src/app/pages/ExamDetail.tsx`
- Modify: `src/app/pages/ExamManagement.tsx`
- Modify: `src/app/routes.ts`
- Test: `src/app/routes.test.tsx`

- [ ] **Step 1: Write the failing `ExamDetail` page test or route smoke test**

```tsx
it("renders the exam detail route", async () => {
  renderWithRouter("/exams/1");
  expect(await screen.findByText(/exam overview/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Build the detail page around the current exam shape**

Use:

```ts
const exam = await apiRequest<ExamRecord>(`/api/v1/exams/${id}/`);
```

Render:

- overview card
- assignment summary
- delivery summary
- current version questions
- links to assign and monitor

- [ ] **Step 3: Link the list page to the detail page**

Replace any placeholder "view" action in `src/app/pages/ExamManagement.tsx` with a link to:

```tsx
<Link to={`/exams/${exam.id}`}>View Detail</Link>
```

- [ ] **Step 4: Verify build and route tests**

Run:

```bash
npm run test -- src/app/routes.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/ExamDetail.tsx src/app/pages/ExamManagement.tsx src/app/routes.ts src/app/routes.test.tsx
git commit -m "feat: add exam detail page"
```

### Task 4: Implement `ManualGrading` as the live UI for grading tasks

**Files:**
- Create: `src/app/pages/ManualGrading.tsx`
- Modify: `src/app/routes.ts`
- Test: `backend/tests/grading/test_api.py`

- [ ] **Step 1: Write the failing backend API coverage for any missing filter or detail needed by the page**

```python
def test_grading_task_list_supports_status_exam_and_search_filters(...):
    response = api_client.get("/api/v1/grading/tasks/?status=pending&search=alice")
    assert response.status_code == 200
```

If current API already satisfies the needed query shape, keep this step as a confirmation-only update.

- [ ] **Step 2: Run the grading API tests to confirm the current contract**

Run:

```bash
backend\.venv\Scripts\python -m pytest backend/tests/grading/test_api.py -q
```

Expected: PASS, or FAIL only for newly added filter assertions.

- [ ] **Step 3: Build the page over `/api/v1/grading/tasks/`**

Use the current serializer shape:

```ts
type ManualGradingTask = {
  id: number;
  status: string;
  max_points: string;
  question_text: string;
  answer_text: string;
  candidate: { id: number; email: string; full_name: string };
  exam: { id: number; name: string; subject_name: string };
  manual_grade?: { score_awarded: string; feedback: string };
};
```

Submit grades via:

```ts
apiRequest(`/api/v1/grading/tasks/${task.id}/grade/`, {
  method: "POST",
  body: { score_awarded, feedback },
});
```

- [ ] **Step 4: Re-run backend grading tests and frontend build**

Run:

```bash
backend\.venv\Scripts\python -m pytest backend/tests/grading/test_api.py -q
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/ManualGrading.tsx src/app/routes.ts backend/tests/grading/test_api.py
git commit -m "feat: wire manual grading screen to grading api"
```

### Task 5: Implement `RolesPermissions` over real role and permission data

**Files:**
- Create: `src/app/pages/RolesPermissions.tsx`
- Modify: `backend/tests/identity/test_role_api.py`
- Modify: `backend/apps/identity/bootstrap.py`
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Write the failing role API tests for the fields needed by the page**

```python
def test_role_list_endpoint_returns_permissions_and_active_state(api_client, admin_token):
    response = api_client.get("/api/v1/roles/")
    assert response.status_code == 200
    payload = response.json()
    assert "permissions" in payload["results"][0]
```

```python
def test_admin_seed_has_new_permission_modules_for_updated_ui(...):
    assert Permission.objects.filter(code="notifications.view").exists()
```

- [ ] **Step 2: Extend bootstrap permission definitions for the new modules**

Add permission codes such as:

```python
("notifications.view", "notifications", "view")
("notifications.manage", "notifications", "manage")
("audit.view", "audit", "view")
("audit.manage", "audit", "manage")
("exam_periods.view", "exam_periods", "view")
("exam_periods.manage", "exam_periods", "manage")
("exam_rooms.view", "exam_rooms", "view")
("exam_rooms.manage", "exam_rooms", "manage")
```

- [ ] **Step 3: Build the page from `/api/v1/roles/` and `/api/v1/permissions/`**

Do not keep the zip's hard-coded catalog. Use:

```ts
const roles = await apiRequest<PaginatedResponse<RoleRecord>>("/api/v1/roles/");
const permissions = await apiRequest<PaginatedResponse<PermissionRecord>>("/api/v1/permissions/");
```

Then create and edit roles with `POST` and `PATCH` on `/api/v1/roles/`.

- [ ] **Step 4: Re-run the role API tests and frontend build**

Run:

```bash
backend\.venv\Scripts\python -m pytest backend/tests/identity/test_role_api.py -q
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/RolesPermissions.tsx backend/apps/identity/bootstrap.py backend/tests/identity/test_role_api.py backend/tests/conftest.py
git commit -m "feat: add live roles and permissions screen"
```

## Chunk 3: Candidate Pages and Group Import Merge

### Task 6: Add candidate-scoped APIs for dashboard, results, and materials

**Files:**
- Modify: `backend/apps/exam_delivery/api/urls.py`
- Modify: `backend/apps/exam_delivery/api/views.py`
- Modify: `backend/apps/materials/api/views.py`
- Create: `backend/tests/exam_delivery/test_candidate_dashboard_api.py`
- Create: `backend/tests/grading/test_candidate_results_api.py`
- Create: `backend/tests/materials/test_candidate_api.py`

- [ ] **Step 1: Write the failing candidate-scoped API tests**

```python
def test_candidate_can_list_only_published_results(api_client, candidate_token, ...):
    response = api_client.get("/api/v1/my-results/")
    assert response.status_code == 200
```

```python
def test_candidate_can_load_dashboard_overview(api_client, candidate_token, ...):
    response = api_client.get("/api/v1/my-dashboard/overview/")
    assert response.status_code == 200
```

```python
def test_candidate_can_list_active_materials(api_client, candidate_token, ...):
    response = api_client.get("/api/v1/my-materials/")
    assert response.status_code == 200
```

- [ ] **Step 2: Run the backend tests to verify failure**

Run:

```bash
backend\.venv\Scripts\python -m pytest backend/tests/exam_delivery/test_candidate_dashboard_api.py backend/tests/grading/test_candidate_results_api.py backend/tests/materials/test_candidate_api.py -q
```

Expected: FAIL because the endpoints do not exist yet.

- [ ] **Step 3: Implement the candidate-scoped endpoints**

Add paths:

```python
path("my-dashboard/overview/", CandidateDashboardOverviewView.as_view())
path("my-results/", CandidateResultListView.as_view())
path("my-materials/", CandidateMaterialListView.as_view())
```

Keep these endpoints read-only and filtered to `request.user`.

- [ ] **Step 4: Re-run the candidate API tests**

Run:

```bash
backend\.venv\Scripts\python -m pytest backend/tests/exam_delivery/test_candidate_dashboard_api.py backend/tests/grading/test_candidate_results_api.py backend/tests/materials/test_candidate_api.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/exam_delivery/api/urls.py backend/apps/exam_delivery/api/views.py backend/apps/materials/api/views.py backend/tests/exam_delivery/test_candidate_dashboard_api.py backend/tests/grading/test_candidate_results_api.py backend/tests/materials/test_candidate_api.py
git commit -m "feat: add candidate dashboard results and materials apis"
```

### Task 7: Build the candidate shell pages over the new candidate-scoped APIs

**Files:**
- Create: `src/app/pages/CandidateDashboard.tsx`
- Create: `src/app/pages/CandidateResults.tsx`
- Create: `src/app/pages/CandidateMaterials.tsx`
- Modify: `src/app/components/layouts/CandidateLayout.tsx`
- Modify: `src/app/routes.ts`
- Test: `src/app/routes.test.tsx`

- [ ] **Step 1: Write the failing route or shell tests for the candidate pages**

```tsx
it("renders candidate dashboard inside the shared candidate layout", async () => {
  renderWithRouter("/candidate/dashboard");
  expect(await screen.findByText(/student portal/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Build the pages with the candidate-scoped APIs**

Use:

```ts
apiRequest("/api/v1/my-dashboard/overview/")
apiRequest("/api/v1/my-results/")
apiRequest("/api/v1/my-materials/")
```

Keep the approved behavior:

- candidate login landing stays on `/candidate/practice`
- dashboard is reachable through navigation
- logout uses the auth context

- [ ] **Step 3: Remove duplicated page-local candidate headers**

Keep page components content-focused so the shell owns:

- branding
- navigation
- logout
- page chrome

- [ ] **Step 4: Re-run route tests and frontend build**

Run:

```bash
npm run test -- src/app/routes.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/CandidateDashboard.tsx src/app/pages/CandidateResults.tsx src/app/pages/CandidateMaterials.tsx src/app/components/layouts/CandidateLayout.tsx src/app/routes.ts src/app/routes.test.tsx
git commit -m "feat: add candidate dashboard results and materials pages"
```

### Task 8: Add group membership CSV import directly to the existing group workflow

**Files:**
- Modify: `backend/apps/institutions/api/views.py`
- Modify: `backend/apps/institutions/api/serializers.py`
- Create: `backend/apps/institutions/services.py`
- Create: `backend/tests/institutions/test_group_import_api.py`
- Modify: `src/app/pages/GroupManagement.tsx`

- [ ] **Step 1: Write the failing backend group import tests**

```python
def test_group_membership_import_creates_candidate_and_membership(api_client, admin_token, ...):
    response = api_client.post(f"/api/v1/groups/{group.id}/memberships/import/", {"file": upload})
    assert response.status_code == 200
```

```python
def test_group_membership_import_returns_row_errors_without_aborting_the_batch(...):
    response = api_client.post(...)
    assert response.json()["failed_rows"] == 1
```

- [ ] **Step 2: Run the group import tests to verify failure**

Run:

```bash
backend\.venv\Scripts\python -m pytest backend/tests/institutions/test_group_import_api.py -q
```

Expected: FAIL because the import action and service do not exist yet.

- [ ] **Step 3: Implement a group-focused import service by adapting the current exam student import style**

Expose:

```python
@action(detail=True, methods=["post"], url_path="memberships/import", parser_classes=[MultiPartParser, FormParser])
def import_memberships(self, request, pk=None):
    ...
```

and return a summary shaped like:

```python
{
    "total_rows": 10,
    "created_users": 3,
    "updated_users": 2,
    "assigned_users": 8,
    "skipped_rows": 1,
    "failed_rows": 1,
    "errors": [...],
}
```

- [ ] **Step 4: Merge the import UI into `GroupManagement`**

Add a file input and import action inside the existing `Add Members` dialog and refresh:

- memberships list
- group cards
- summary message area

Do not create a new page or standalone import center.

- [ ] **Step 5: Re-run backend import tests and frontend build**

Run:

```bash
backend\.venv\Scripts\python -m pytest backend/tests/institutions/test_group_import_api.py -q
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/institutions/api/views.py backend/apps/institutions/api/serializers.py backend/apps/institutions/services.py backend/tests/institutions/test_group_import_api.py src/app/pages/GroupManagement.tsx
git commit -m "feat: merge candidate import into group membership flow"
```

## Chunk 4: Scheduling, Notifications, Audit, and Final Verification

### Task 9: Add exam periods and exam rooms to the exam authoring domain

**Files:**
- Modify: `backend/apps/exam_authoring/models.py`
- Modify: `backend/apps/exam_authoring/admin.py`
- Modify: `backend/apps/exam_authoring/services.py`
- Modify: `backend/apps/exam_authoring/api/serializers.py`
- Modify: `backend/apps/exam_authoring/api/views.py`
- Modify: `backend/apps/exam_authoring/api/urls.py`
- Create: `backend/tests/exam_authoring/test_period_room_api.py`
- Modify: `backend/apps/identity/bootstrap.py`
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Write the failing model and API tests**

```python
def test_admin_can_create_exam_period(api_client, admin_token):
    response = api_client.post("/api/v1/exam-periods/", {"name": "Spring Finals", ...})
    assert response.status_code == 201
```

```python
def test_admin_can_create_exam_room(api_client, admin_token):
    response = api_client.post("/api/v1/exam-rooms/", {"name": "Main Hall A", ...})
    assert response.status_code == 201
```

```python
def test_exam_create_can_reference_period_and_room(api_client, admin_token, subject):
    response = api_client.post("/api/v1/exams/", {..., "period_id": period.id, "room_id": room.id})
    assert response.status_code == 201
```

- [ ] **Step 2: Run the period and room tests to verify failure**

Run:

```bash
backend\.venv\Scripts\python -m pytest backend/tests/exam_authoring/test_period_room_api.py -q
```

Expected: FAIL because the models and routes do not exist yet.

- [ ] **Step 3: Add the scheduling models and wire them into exams**

Suggested additions:

```python
class ExamPeriod(TimeStampedModel):
    name = models.CharField(max_length=255)
    start_date = models.DateField()
    end_date = models.DateField()
```

```python
class ExamRoom(TimeStampedModel):
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True)
    capacity = models.PositiveIntegerField(default=0)
    features = models.JSONField(default=list, blank=True)
```

and on `Exam`:

```python
period = models.ForeignKey("exam_authoring.ExamPeriod", null=True, blank=True, ...)
room = models.ForeignKey("exam_authoring.ExamRoom", null=True, blank=True, ...)
```

- [ ] **Step 4: Re-run the period and room tests**

Run:

```bash
backend\.venv\Scripts\python -m pytest backend/tests/exam_authoring/test_period_room_api.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/exam_authoring/models.py backend/apps/exam_authoring/admin.py backend/apps/exam_authoring/services.py backend/apps/exam_authoring/api/serializers.py backend/apps/exam_authoring/api/views.py backend/apps/exam_authoring/api/urls.py backend/tests/exam_authoring/test_period_room_api.py backend/apps/identity/bootstrap.py backend/tests/conftest.py
git commit -m "feat: add exam periods and rooms to exam authoring"
```

### Task 10: Build the `ExamPeriods` and `ExamRooms` screens and connect them back to exam flows

**Files:**
- Create: `src/app/pages/ExamPeriods.tsx`
- Create: `src/app/pages/ExamRooms.tsx`
- Modify: `src/app/pages/ExamCreationWizard.tsx`
- Modify: `src/app/pages/ExamDetail.tsx`
- Modify: `src/app/routes.ts`

- [ ] **Step 1: Write the failing UI smoke coverage or route tests**

```tsx
it("renders exam periods route", async () => {
  renderWithRouter("/exam-periods");
  expect(await screen.findByText(/exam periods/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Build the CRUD pages over the new authoring endpoints**

Use:

```ts
apiRequest("/api/v1/exam-periods/")
apiRequest("/api/v1/exam-rooms/")
```

Support:

- list
- create
- edit
- delete
- filter and search

- [ ] **Step 3: Expose period and room data in the exam creation and detail flows**

Extend the exam form payload:

```ts
{
  ...payload,
  period_id,
  room_id,
}
```

and render the chosen period and room in `ExamDetail`.

- [ ] **Step 4: Run build and route tests**

Run:

```bash
npm run test -- src/app/routes.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/ExamPeriods.tsx src/app/pages/ExamRooms.tsx src/app/pages/ExamCreationWizard.tsx src/app/pages/ExamDetail.tsx src/app/routes.ts
git commit -m "feat: add exam periods and rooms screens"
```

### Task 11: Add the notifications inbox backend and `NotificationCenter` integration

**Files:**
- Create: `backend/apps/notifications/__init__.py`
- Create: `backend/apps/notifications/apps.py`
- Create: `backend/apps/notifications/models.py`
- Create: `backend/apps/notifications/admin.py`
- Create: `backend/apps/notifications/services.py`
- Create: `backend/apps/notifications/api/__init__.py`
- Create: `backend/apps/notifications/api/serializers.py`
- Create: `backend/apps/notifications/api/views.py`
- Create: `backend/apps/notifications/api/urls.py`
- Create: `backend/apps/notifications/migrations/__init__.py`
- Modify: `backend/config/settings/base.py`
- Modify: `backend/config/urls.py`
- Modify: `backend/apps/identity/bootstrap.py`
- Modify: `backend/tests/conftest.py`
- Create: `backend/tests/notifications/test_api.py`
- Create: `src/app/pages/NotificationCenter.tsx`
- Modify: `src/app/components/layouts/AdminLayout.tsx`

- [ ] **Step 1: Write the failing notifications API tests**

```python
def test_admin_can_list_notifications(api_client, admin_token):
    response = api_client.get("/api/v1/notifications/")
    assert response.status_code == 200
```

```python
def test_admin_can_mark_notification_as_read(api_client, admin_token, notification):
    response = api_client.post(f"/api/v1/notifications/{notification.id}/mark-read/")
    assert response.status_code == 200
```

```python
def test_notification_unread_count_endpoint_returns_total(api_client, admin_token):
    response = api_client.get("/api/v1/notifications/unread-count/")
    assert response.status_code == 200
```

- [ ] **Step 2: Run the notifications tests to verify failure**

Run:

```bash
backend\.venv\Scripts\python -m pytest backend/tests/notifications/test_api.py -q
```

Expected: FAIL because the app and routes do not exist yet.

- [ ] **Step 3: Implement the inbox domain and admin UI**

Suggested model shape:

```python
class Notification(TimeStampedModel):
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True)
    category = models.CharField(max_length=64, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
```

Expose:

- list
- unread count
- mark one as read
- mark all as read

Then wire the topbar bell and `NotificationCenter` page to those endpoints.

- [ ] **Step 4: Re-run notifications tests and frontend build**

Run:

```bash
backend\.venv\Scripts\python -m pytest backend/tests/notifications/test_api.py -q
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/notifications backend/config/settings/base.py backend/config/urls.py backend/apps/identity/bootstrap.py backend/tests/conftest.py backend/tests/notifications/test_api.py src/app/pages/NotificationCenter.tsx src/app/components/layouts/AdminLayout.tsx
git commit -m "feat: add notification center and unread header state"
```

### Task 12: Add platform audit events and the `AuditCenter` screen

**Files:**
- Modify: `backend/apps/platform_core/models.py`
- Create: `backend/apps/platform_core/audit.py`
- Modify: `backend/apps/platform_core/api/serializers.py`
- Modify: `backend/apps/platform_core/api/views.py`
- Modify: `backend/apps/platform_core/api/urls.py`
- Modify: `backend/config/urls.py`
- Modify: `backend/apps/identity/api/views.py`
- Modify: `backend/apps/grading/services.py`
- Modify: `backend/apps/exam_authoring/services.py`
- Modify: `backend/apps/proctoring/services.py`
- Modify: `backend/apps/identity/bootstrap.py`
- Modify: `backend/tests/conftest.py`
- Create: `backend/tests/platform_core/test_audit_api.py`
- Create: `src/app/pages/AuditCenter.tsx`

- [ ] **Step 1: Write the failing audit storage and list API tests**

```python
def test_audit_list_endpoint_returns_events(api_client, admin_token):
    response = api_client.get("/api/v1/audit/events/")
    assert response.status_code == 200
```

```python
def test_lock_user_action_creates_audit_event(api_client, admin_token, user):
    response = api_client.post(f"/api/v1/users/{user.id}/lock/")
    assert response.status_code == 200
    assert AuditEvent.objects.filter(action="user.locked").exists()
```

- [ ] **Step 2: Run the audit tests to verify failure**

Run:

```bash
backend\.venv\Scripts\python -m pytest backend/tests/platform_core/test_audit_api.py -q
```

Expected: FAIL because the model, helper, and endpoint do not exist yet.

- [ ] **Step 3: Add the audit model, helper, and integration points**

Suggested model:

```python
class AuditEvent(TimeStampedModel):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=128)
    category = models.CharField(max_length=64)
    severity = models.CharField(max_length=32, default="info")
    description = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    request_id = models.CharField(max_length=64, blank=True)
```

Add a helper:

```python
def record_audit_event(*, actor=None, action, category, severity="info", description="", metadata=None, request=None):
    ...
```

Use it in:

- user lock and unlock actions
- role changes
- exam assignment sync
- result publish
- grading updates
- violation review actions

- [ ] **Step 4: Build the `AuditCenter` page over the new API**

Use:

```ts
apiRequest("/api/v1/audit/events/", { query: { search, category, severity } })
```

Render:

- summary cards
- filtered list or table
- detail sheet for event metadata

- [ ] **Step 5: Re-run audit tests and frontend build**

Run:

```bash
backend\.venv\Scripts\python -m pytest backend/tests/platform_core/test_audit_api.py -q
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/platform_core/models.py backend/apps/platform_core/audit.py backend/apps/platform_core/api/serializers.py backend/apps/platform_core/api/views.py backend/apps/platform_core/api/urls.py backend/config/urls.py backend/apps/identity/api/views.py backend/apps/grading/services.py backend/apps/exam_authoring/services.py backend/apps/proctoring/services.py backend/apps/identity/bootstrap.py backend/tests/conftest.py backend/tests/platform_core/test_audit_api.py src/app/pages/AuditCenter.tsx
git commit -m "feat: add audit center and backend audit events"
```

### Task 13: Final verification, schema refresh, and docs touch-up

**Files:**
- Modify: `backend/openapi.yaml`
- Modify: `README.md`

- [ ] **Step 1: Run the focused backend test suite for the new slices**

Run:

```bash
backend\.venv\Scripts\python -m pytest backend/tests/grading/test_api.py backend/tests/identity/test_role_api.py backend/tests/institutions/test_group_import_api.py backend/tests/exam_authoring/test_period_room_api.py backend/tests/exam_delivery/test_candidate_dashboard_api.py backend/tests/grading/test_candidate_results_api.py backend/tests/materials/test_candidate_api.py backend/tests/notifications/test_api.py backend/tests/platform_core/test_audit_api.py -q
```

Expected: PASS.

- [ ] **Step 2: Regenerate the API schema**

Run:

```bash
backend\.venv\Scripts\python backend\manage.py spectacular --file backend\openapi.yaml
```

Expected: PASS.

- [ ] **Step 3: Run frontend verification**

Run:

```bash
npm run test -- src/app/routes.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 4: Update the root docs for the new routes and domains**

Add short notes in `README.md` covering:

- candidate dashboard/results/materials routes
- manual grading route
- notifications and audit routes
- group member import location

- [ ] **Step 5: Commit**

```bash
git add backend/openapi.yaml README.md
git commit -m "chore: verify updated ui merge and refresh docs"
```
