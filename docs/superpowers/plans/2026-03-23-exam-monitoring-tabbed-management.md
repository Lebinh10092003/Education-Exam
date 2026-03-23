# Exam Monitoring Tabbed Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move proctoring into `Exam Detail` as a structured monitoring tab with sub-tabs, stable query-driven deep links, practical filters/search/pagination, and Excel export of filtered violation history.

**Architecture:** Keep `/exams/:id` as the only canonical management route for a single exam and host monitoring inside it via `tab=monitoring` plus monitoring-specific query params. Reuse the existing snapshot websocket/media logic for live views, keep case history on the paginated backend cases API, add a focused Excel export endpoint, and preserve old `/exams/:id/monitor` links through a redirect during migration so existing bookmarks stop causing route errors immediately.

**Tech Stack:** React, TypeScript, React Router, Vite, Vitest, Testing Library, Django 5, Django REST Framework, openpyxl, websocket snapshot updates, existing proctoring APIs

---

## File Map

- Create: `backend/apps/proctoring/api/querysets.py`
- Create: `backend/apps/proctoring/exporters.py`
- Modify: `backend/apps/proctoring/api/views.py`
- Modify: `backend/apps/proctoring/api/urls.py`
- Modify: `backend/pyproject.toml`
- Modify: `backend/tests/proctoring/test_admin_api.py`
- Create: `src/app/pages/liveMonitoringShared.ts`
- Create: `src/app/pages/liveMonitoringExport.ts`
- Create: `src/app/pages/ExamDetail.test.tsx`
- Modify: `src/app/pages/ExamDetail.tsx`
- Modify: `src/app/pages/LiveMonitoring.tsx`
- Modify: `src/app/pages/LiveMonitoring.test.tsx`
- Modify: `src/app/pages/ExamManagement.tsx`
- Modify: `src/app/pages/Dashboard.tsx`
- Modify: `src/app/routes.ts`
- Modify: `src/app/routes.test.tsx`

## Scope Guard

This plan only covers the approved monitoring package:

- exam-detail-hosted monitoring tab
- sub-tabs for overview, live alerts, candidate status, and violation history
- query-param deep linking
- Excel export for filtered violation history
- graceful handling of old monitoring links and invalid case selection

This plan does not cover:

- candidate exam runner changes
- proctoring media transport changes
- new violation rules or moderation workflows
- analytics dashboards beyond the agreed monitoring workspace

## Chunk 1: Backend Querysets And Excel Export

### Task 1: Write failing backend tests for filtered violation history and Excel export

**Files:**
- Modify: `backend/tests/proctoring/test_admin_api.py`

- [ ] **Step 1: Add a failing test that case listing respects exam, severity, status, and search together**

```python
@pytest.mark.django_db
def test_admin_can_filter_violation_cases_by_exam_status_severity_and_search(
    api_client,
    admin_token,
    subject,
    admin_user,
    candidate_user,
):
    from apps.proctoring.services import record_proctor_event
    from .utils import build_active_session

    exam, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    record_proctor_event(
        session=session,
        event_type="fullscreen_exit",
        severity="critical",
        metadata={"count": 1},
        reported_by=candidate_user,
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get(
        "/api/v1/proctoring/cases/",
        {
            "exam": exam.id,
            "status": "open",
            "severity": "critical",
            "search": candidate_user.full_name,
        },
    )

    assert response.status_code == 200
    assert response.json()["count"] == 1
```

- [ ] **Step 2: Add a failing test for Excel export with current filters applied**

```python
@pytest.mark.django_db
def test_admin_can_export_filtered_violation_cases_to_excel(
    api_client,
    admin_token,
    subject,
    admin_user,
    candidate_user,
):
    from apps.proctoring.services import record_proctor_event
    from .utils import build_active_session
    from openpyxl import load_workbook
    import io

    exam, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    record_proctor_event(
        session=session,
        event_type="fullscreen_exit",
        severity="critical",
        metadata={"count": 1},
        reported_by=candidate_user,
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get(
        "/api/v1/proctoring/cases/export/",
        {"exam": exam.id, "status": "open", "severity": "critical"},
    )

    assert response.status_code == 200
    assert response["Content-Type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    workbook = load_workbook(io.BytesIO(response.content))
    sheet = workbook.active
    assert sheet["A2"].value
```

- [ ] **Step 3: Add a failing test that export requires an exam id and rejects missing scope**

```python
@pytest.mark.django_db
def test_violation_export_requires_exam_scope(api_client, admin_token):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.get("/api/v1/proctoring/cases/export/")
    assert response.status_code == 400
```

- [ ] **Step 4: Run the focused backend tests to verify failure**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/proctoring/test_admin_api.py -q`
Expected: FAIL because the export endpoint and shared filtering do not exist yet.

### Task 2: Add shared violation-case filtering and Excel workbook generation

**Files:**
- Create: `backend/apps/proctoring/api/querysets.py`
- Create: `backend/apps/proctoring/exporters.py`
- Modify: `backend/pyproject.toml`
- Modify: `backend/apps/proctoring/api/views.py`
- Modify: `backend/apps/proctoring/api/urls.py`

- [ ] **Step 1: Add `openpyxl` to backend dependencies**

```toml
dependencies = [
  ...
  "openpyxl>=3.1,<3.2",
]
```

- [ ] **Step 2: Create one shared queryset helper for violation-case filters**

```python
def build_violation_case_queryset(request):
    queryset = (
        ViolationCase.objects.select_related(
            "session",
            "session__candidate",
            "session__exam",
            "session__exam__subject",
        )
        .prefetch_related("events", "evidences", "reviews", "reviews__reviewer")
        .order_by("status", "-created_at")
    )

    status_filter = request.query_params.get("status")
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    severity_filter = request.query_params.get("severity")
    if severity_filter:
        queryset = queryset.filter(severity=severity_filter)

    exam_id = request.query_params.get("exam")
    if exam_id:
        queryset = queryset.filter(session__exam_id=exam_id)

    search = request.query_params.get("search")
    if search:
        queryset = queryset.filter(
            Q(session__candidate__email__icontains=search)
            | Q(session__candidate__full_name__icontains=search)
            | Q(session__exam__name__icontains=search)
            | Q(title__icontains=search)
            | Q(summary__icontains=search)
        )
    return queryset
```

- [ ] **Step 3: Use the shared queryset helper inside `ViolationCaseViewSet` instead of duplicating filters in `get_queryset`**

```python
def get_queryset(self):
    return build_violation_case_queryset(self.request)
```

- [ ] **Step 4: Add a focused workbook exporter that writes metadata-only rows**

```python
def build_violation_cases_workbook(cases):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Violation History"
    sheet.append([
        "Case ID",
        "Exam",
        "Subject",
        "Candidate",
        "Candidate Email",
        "Session ID",
        "Severity",
        "Status",
        "Title",
        "Summary",
        "Event Count",
        "Evidence Count",
        "Resolved At",
        "Resolution Notes",
    ])
    for case in cases:
        sheet.append([...])
    return workbook
```

- [ ] **Step 5: Add the export API view and route**

```python
class ViolationCaseExportView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "proctoring.view"

    def get(self, request):
        if not request.query_params.get("exam"):
            return Response({"detail": "exam is required."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = build_violation_case_queryset(request)
        workbook = build_violation_cases_workbook(queryset)
        ...
```

```python
path("proctoring/cases/export/", ViolationCaseExportView.as_view(), name="proctoring-cases-export"),
```

- [ ] **Step 6: Keep current serializers unchanged unless one small export-specific summary serializer clearly reduces duplication**

Expected: no extra broad serializer hierarchy; keep export logic focused in the exporter.

- [ ] **Step 7: Install the new dependency and rerun backend tests**

Run: `cd backend; .\.venv\Scripts\python.exe -m pip install -e .`
Expected: `openpyxl` installs into the current venv.

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/proctoring/test_admin_api.py -q`
Expected: PASS

- [ ] **Step 8: Commit the backend export slice**

```bash
git add backend/pyproject.toml backend/apps/proctoring/api/querysets.py backend/apps/proctoring/exporters.py backend/apps/proctoring/api/views.py backend/apps/proctoring/api/urls.py backend/tests/proctoring/test_admin_api.py
git commit -m "feat: add violation export and shared monitoring filters"
```

## Chunk 2: Route Migration And Exam Detail Host

### Task 3: Write failing frontend tests for monitoring-in-exam-detail and legacy redirect behavior

**Files:**
- Create: `src/app/pages/ExamDetail.test.tsx`
- Modify: `src/app/routes.test.tsx`

- [ ] **Step 1: Add a failing test that proctored exams show a `Monitoring` tab in exam detail**

```tsx
it("shows the monitoring tab when exam proctoring is enabled", async () => {
  render(
    <MemoryRouter initialEntries={["/exams/1?tab=monitoring"]}>
      <Routes>
        <Route path="/exams/:id" element={<ExamDetail />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByRole("tab", { name: /monitoring/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Add a failing test that non-proctored exams do not show the monitoring tab**

```tsx
expect(screen.queryByRole("tab", { name: /monitoring/i })).not.toBeInTheDocument();
```

- [ ] **Step 3: Add a failing route test for the legacy monitoring path redirect**

```tsx
expect(matchRoutes(routeConfig, "/exams/42/monitor")).toBeTruthy();
```

- [ ] **Step 4: Run the route and exam-detail tests to verify failure**

Run: `npm.cmd test -- src/app/routes.test.tsx src/app/pages/ExamDetail.test.tsx`
Expected: FAIL because exam detail does not host monitoring and no redirect behavior exists yet.

### Task 4: Make exam detail the canonical monitoring host and keep legacy route compatibility

**Files:**
- Modify: `src/app/pages/ExamDetail.tsx`
- Modify: `src/app/routes.ts`
- Modify: `src/app/routes.test.tsx`
- Create: `src/app/pages/ExamDetail.test.tsx`

- [ ] **Step 1: Add query-param-driven top-level tab state to `ExamDetail`**

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const activeTab = searchParams.get("tab") ?? "details";
```

- [ ] **Step 2: Render a `Monitoring` tab only when `exam.enable_proctoring` is true**

```tsx
{exam.enable_proctoring ? <TabsTrigger value="monitoring">Monitoring</TabsTrigger> : null}
```

- [ ] **Step 3: Mount the monitoring workspace inside exam detail instead of linking out to a standalone page**

```tsx
<TabsContent value="monitoring">
  <LiveMonitoring examId={exam.id} examStatus={exam.status} embedded />
</TabsContent>
```

- [ ] **Step 4: Add a tiny legacy redirect route so old `/exams/:id/monitor` links become `/exams/:id?tab=monitoring`**

```tsx
function LegacyExamMonitoringRedirect() {
  const { id } = useParams();
  return <Navigate replace to={`/exams/${id}?tab=monitoring`} />;
}
```

- [ ] **Step 5: Keep the redirect route in `routes.ts` during migration**

```tsx
{ path: "exams/:id/monitor", Component: LegacyExamMonitoringRedirect },
```

- [ ] **Step 6: Re-run the route and exam-detail tests**

Run: `npm.cmd test -- src/app/routes.test.tsx src/app/pages/ExamDetail.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit the route-hosting slice**

```bash
git add src/app/pages/ExamDetail.tsx src/app/pages/ExamDetail.test.tsx src/app/routes.ts src/app/routes.test.tsx
git commit -m "feat: host monitoring inside exam detail"
```

## Chunk 3: Monitoring Workspace Refactor

### Task 5: Write failing workspace tests for tabs, filters, pagination, and safe case selection

**Files:**
- Modify: `src/app/pages/LiveMonitoring.test.tsx`

- [ ] **Step 1: Add a failing test for query-driven monitoring sub-tabs**

```tsx
render(
  <MemoryRouter initialEntries={["/exams/1?tab=monitoring&monitorTab=live-alerts"]}>
    <LiveMonitoring examId={1} embedded />
  </MemoryRouter>,
);

expect(await screen.findByRole("tab", { name: /live alerts/i })).toBeInTheDocument();
```

- [ ] **Step 2: Add a failing test for live-alert search and pagination**

```tsx
await user.type(screen.getByPlaceholderText(/search live alerts/i), "Candidate One");
expect(screen.getByText("Candidate One")).toBeInTheDocument();
expect(screen.queryByText("Candidate Two")).not.toBeInTheDocument();
```

- [ ] **Step 3: Add a failing test for candidate-status filters**

```tsx
await user.selectOptions(screen.getByLabelText(/connection/i), "offline");
expect(screen.getByText("Offline Candidate")).toBeInTheDocument();
expect(screen.queryByText("Stable Candidate")).not.toBeInTheDocument();
```

- [ ] **Step 4: Add a failing test for invalid `case` query params showing a soft state instead of crashing**

```tsx
render(
  <MemoryRouter initialEntries={["/exams/1?tab=monitoring&monitorTab=violation-history&case=999"]}>
    <LiveMonitoring examId={1} embedded />
  </MemoryRouter>,
);

expect(await screen.findByText(/selected violation is unavailable/i)).toBeInTheDocument();
```

- [ ] **Step 5: Add a failing test for export using the active history filters**

```tsx
await user.click(screen.getByRole("button", { name: /export excel/i }));
expect(fetch).toHaveBeenCalledWith(
  expect.stringContaining("/api/v1/proctoring/cases/export/?exam=1"),
  expect.anything(),
);
```

- [ ] **Step 6: Run the workspace tests to verify failure**

Run: `npm.cmd test -- src/app/pages/LiveMonitoring.test.tsx`
Expected: FAIL because the workspace is still a single-page view without sub-tabs or export.

### Task 6: Refactor `LiveMonitoring` into an embeddable workspace with focused helpers

**Files:**
- Create: `src/app/pages/liveMonitoringShared.ts`
- Create: `src/app/pages/liveMonitoringExport.ts`
- Modify: `src/app/pages/LiveMonitoring.tsx`
- Modify: `src/app/pages/LiveMonitoring.test.tsx`

- [ ] **Step 1: Move pure formatting, filtering, and client-side pagination helpers into `liveMonitoringShared.ts`**

```ts
export function filterLiveAlerts(alerts, filters) { ... }
export function filterCandidateStatuses(statuses, filters) { ... }
export function paginateItems(items, page, pageSize) { ... }
export function getLatestCaseBySession(cases) { ... }
```

- [ ] **Step 2: Add a focused Excel download helper in `liveMonitoringExport.ts` rather than overloading `http.ts`**

```ts
export async function exportViolationCasesExcel(params: Record<string, string>) {
  const tokens = getStoredTokens();
  const url = new URL(buildApiUrl("/api/v1/proctoring/cases/export/"), window.location.origin);
  Object.entries(params).forEach(([key, value]) => value && url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${tokens?.access}` } });
  ...
}
```

- [ ] **Step 3: Change `LiveMonitoring` to accept host props and operate as an embedded workspace**

```tsx
interface LiveMonitoringProps {
  examId?: number;
  embedded?: boolean;
  examStatusOverride?: string;
}
```

- [ ] **Step 4: Split the workspace into sub-tabs inside `LiveMonitoring`**

```tsx
<Tabs value={monitorTab} onValueChange={setMonitorTab}>
  <TabsTrigger value="overview">Overview</TabsTrigger>
  <TabsTrigger value="live-alerts">Live Alerts</TabsTrigger>
  <TabsTrigger value="candidate-status">Candidate Status</TabsTrigger>
  <TabsTrigger value="violation-history">Violation History</TabsTrigger>
</Tabs>
```

- [ ] **Step 5: Keep `Overview` small and move the long feeds into their own tabs**

Expected:
- `Overview` contains KPIs, selected webcam, selected violation, and short live-risk summary
- no full alert feed
- no full candidate roster
- no full case history list

- [ ] **Step 6: Add client-side search/filter/pagination for `Live Alerts` and `Candidate Status`**

```tsx
const visibleAlerts = paginateItems(filterLiveAlerts(data?.alerts ?? [], liveAlertFilters), liveAlertPage, 10);
const visibleCandidates = paginateItems(filterCandidateStatuses(data?.candidate_statuses ?? [], candidateFilters), candidatePage, 10);
```

- [ ] **Step 7: Keep `Violation History` on the backend cases API with page, status, severity, and search query params**

```tsx
const cases = useAsyncList(
  () => apiRequest<PaginatedResponse<ViolationCaseRecord>>("/api/v1/proctoring/cases/", {
    query: {
      exam: examId,
      status: historyStatus !== "all" ? historyStatus : undefined,
      severity: historySeverity !== "all" ? historySeverity : undefined,
      search: debouncedHistorySearch || undefined,
      page: historyPage,
      page_size: 10,
    },
  }),
  [examId, historyStatus, historySeverity, debouncedHistorySearch, historyPage],
);
```

- [ ] **Step 8: Drive selected violation detail via query params and never navigate to a case route**

```tsx
const selectedCaseId = Number(searchParams.get("case") || "");
const setSelectedCaseId = (value: number | null) => { ...searchParams.set("case", String(value))... };
```

- [ ] **Step 9: Render a soft unavailable-state for missing or filtered-out selected cases**

```tsx
if (selectedCaseId && !selectedCase) {
  return <div>Selected violation is unavailable for the current view.</div>;
}
```

- [ ] **Step 10: Reuse the current live webcam logic unchanged where possible**

Expected:
- no regression to `Open Webcam`
- no regression to selected webcam stage
- no regression to websocket + polling refresh behavior

- [ ] **Step 11: Re-run the workspace tests**

Run: `npm.cmd test -- src/app/pages/LiveMonitoring.test.tsx`
Expected: PASS

- [ ] **Step 12: Commit the workspace refactor**

```bash
git add src/app/pages/LiveMonitoring.tsx src/app/pages/LiveMonitoring.test.tsx src/app/pages/liveMonitoringShared.ts src/app/pages/liveMonitoringExport.ts
git commit -m "feat: redesign monitoring workspace with tabs and filters"
```

## Chunk 4: Link Migration And Final Verification

### Task 7: Update all admin-entry monitoring links to the canonical query-based exam-detail route

**Files:**
- Modify: `src/app/pages/ExamManagement.tsx`
- Modify: `src/app/pages/ExamDetail.tsx`
- Modify: `src/app/pages/Dashboard.tsx`

- [ ] **Step 1: Replace exam-management monitor links with exam-detail monitoring links**

```tsx
<Link to={`/exams/${exam.id}?tab=monitoring`}>
```

- [ ] **Step 2: Replace dashboard alert shortcuts with the same canonical link**

```tsx
to={`/exams/${alert.exam_id}?tab=monitoring&monitorTab=live-alerts`}
```

- [ ] **Step 3: Replace quick actions inside exam detail with in-page monitoring links**

```tsx
<Link to={`/exams/${exam.id}?tab=monitoring`}>
```

- [ ] **Step 4: Verify no first-party link still points directly to `/exams/:id/monitor`**

Run: `rg -n '/exams/.*/monitor|/exams/:id/monitor' src/app -g '*.tsx' -g '*.ts'`
Expected: no app links remain except the legacy redirect route definition and its tests.

### Task 8: Run the final verification matrix

**Files:**
- Modify: `src/app/pages/ExamManagement.tsx`
- Modify: `src/app/pages/Dashboard.tsx`
- Modify: `src/app/pages/ExamDetail.tsx`
- Modify: `src/app/pages/LiveMonitoring.tsx`
- Modify: `src/app/routes.ts`
- Modify: `backend/apps/proctoring/api/views.py`
- Modify: `backend/apps/proctoring/api/urls.py`

- [ ] **Step 1: Run focused frontend tests**

Run: `npm.cmd test -- src/app/routes.test.tsx src/app/pages/ExamDetail.test.tsx src/app/pages/LiveMonitoring.test.tsx`
Expected: PASS

- [ ] **Step 2: Run existing monitoring and exam-management regressions**

Run: `npm.cmd test -- src/app/pages/TakeExam.test.tsx src/app/pages/StudentShell.test.tsx src/app/pages/MyExams.test.tsx`
Expected: PASS

- [ ] **Step 3: Run focused backend tests**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/proctoring/test_admin_api.py backend/tests/proctoring/test_services.py backend/tests/proctoring/test_websocket.py -q`
Expected: PASS

- [ ] **Step 4: Run Django checks and frontend production build**

Run: `backend\.venv\Scripts\python.exe backend\manage.py check`
Expected: `System check identified no issues`

Run: `npm.cmd run build`
Expected: Vite build succeeds without route or type failures.

- [ ] **Step 5: Run a browser smoke test for the reported failures**

Manual smoke path:
- open a proctored exam detail
- switch to `Monitoring`
- open `Live Alerts`
- open one violation detail
- refresh the page
- confirm no React Router 404 screen
- open `Candidate Status`
- open webcam for one candidate
- open `Violation History`
- apply filters
- export Excel

Expected:
- violation detail stays in-page
- old `/exams/:id/monitor` URL redirects to the same exam detail monitoring tab
- long live-alert lists are paginated
- history filters and export respect the current exam scope

- [ ] **Step 6: Commit the link-migration and verification slice**

```bash
git add src/app/pages/ExamManagement.tsx src/app/pages/Dashboard.tsx src/app/pages/ExamDetail.tsx src/app/pages/LiveMonitoring.tsx src/app/routes.ts src/app/routes.test.tsx src/app/pages/ExamDetail.test.tsx src/app/pages/LiveMonitoring.test.tsx backend/apps/proctoring/api/views.py backend/apps/proctoring/api/urls.py backend/apps/proctoring/api/querysets.py backend/apps/proctoring/exporters.py backend/tests/proctoring/test_admin_api.py backend/pyproject.toml
git commit -m "feat: move exam monitoring into tabbed exam detail"
```
