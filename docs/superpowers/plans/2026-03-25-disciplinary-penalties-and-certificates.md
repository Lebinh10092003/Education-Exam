# Disciplinary Penalties And Certificates Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated disciplinary workflow with per-case penalty proposals, result score synchronization, and automatic exam certificate assignment based on penalized scores.

**Architecture:** Introduce a new `apps.discipline` domain that sits between `apps.proctoring` and `apps.grading`. `ViolationCase` remains the source of violation events, `Result` keeps both original and penalized score values, and the new discipline services materialize per-exam candidate records plus certificate awards that recompute whenever approved penalties change.

**Tech Stack:** Django 5, Django REST Framework, PostgreSQL-compatible Django models and migrations, openpyxl, React, TypeScript, React Router, Vitest, Testing Library

---

## File Map

- Create: `backend/apps/discipline/__init__.py`
- Create: `backend/apps/discipline/apps.py`
- Create: `backend/apps/discipline/models.py`
- Create: `backend/apps/discipline/services.py`
- Create: `backend/apps/discipline/exporters.py`
- Create: `backend/apps/discipline/admin.py`
- Create: `backend/apps/discipline/api/__init__.py`
- Create: `backend/apps/discipline/api/serializers.py`
- Create: `backend/apps/discipline/api/views.py`
- Create: `backend/apps/discipline/api/urls.py`
- Create: `backend/apps/discipline/migrations/0001_initial.py`
- Modify: `backend/config/settings/base.py`
- Modify: `backend/config/urls.py`
- Modify: `backend/apps/identity/bootstrap.py`
- Modify: `backend/apps/grading/models.py`
- Modify: `backend/apps/grading/services.py`
- Modify: `backend/apps/grading/api/serializers.py`
- Modify: `backend/apps/grading/api/views.py`
- Modify: `backend/apps/platform_core/demo_seed.py`
- Create: `backend/tests/discipline/__init__.py`
- Create: `backend/tests/discipline/test_services.py`
- Create: `backend/tests/discipline/test_api.py`
- Modify: `backend/tests/grading/test_services.py`
- Modify: `backend/tests/grading/test_result_api.py`
- Modify: `backend/tests/grading/test_candidate_results_api.py`
- Create: `src/app/pages/disciplineShared.ts`
- Create: `src/app/pages/DisciplinaryManagement.tsx`
- Create: `src/app/pages/DisciplinaryExamSheet.tsx`
- Create: `src/app/pages/DisciplinaryManagement.test.tsx`
- Create: `src/app/pages/DisciplinaryExamSheet.test.tsx`
- Modify: `src/app/routes.ts`
- Modify: `src/app/components/layouts/AdminLayout.tsx`
- Modify: `src/app/i18n/resources/vi/navigation.ts`
- Modify: `src/app/i18n/resources/en/navigation.ts`
- Modify: `src/app/pages/ResultsReports.tsx`
- Modify: `src/app/pages/CandidateResults.tsx`
- Modify: `src/app/pages/candidateResultsShared.ts`

## Chunk 1: Backend Domain And Result Sync

### Task 1: Add the discipline app, permissions, and core models

**Files:**
- Create: `backend/apps/discipline/__init__.py`
- Create: `backend/apps/discipline/apps.py`
- Create: `backend/apps/discipline/models.py`
- Create: `backend/apps/discipline/admin.py`
- Create: `backend/apps/discipline/migrations/0001_initial.py`
- Modify: `backend/config/settings/base.py`
- Modify: `backend/apps/identity/bootstrap.py`
- Test: `backend/tests/discipline/test_services.py`

- [ ] **Step 1: Write failing model and selection tests**

```python
def test_build_record_selects_highest_scoring_attempt():
    ...

def test_build_record_breaks_score_ties_with_newest_finalized_attempt():
    ...

def test_failed_candidate_receives_participation_award_after_certificate_run():
    ...
```

- [ ] **Step 2: Run the discipline service tests to verify failure**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/discipline/test_services.py -q`
Expected: FAIL because `apps.discipline` and its models do not exist yet.

- [ ] **Step 3: Add the Django app registration**

```python
INSTALLED_APPS = [
    ...,
    "apps.discipline",
]
```

- [ ] **Step 4: Add new permission codes for discipline access**

```python
("discipline.view", "discipline", "view"),
("discipline.manage", "discipline", "manage"),
```

Add them to administrator and examiner roles.

- [ ] **Step 5: Implement core models**

```python
class ViolationPenaltyProposal(TimeStampedModel):
    ...

class ExamDisciplinaryRecord(TimeStampedModel):
    ...

class ExamDisciplinaryActionLog(TimeStampedModel):
    ...

class ExamCertificatePolicy(TimeStampedModel):
    ...

class ExamCertificateAward(TimeStampedModel):
    ...
```

Required enums:
- proposal status: `draft`, `approved`, `rejected`, `no_penalty`
- award level: `gold`, `silver`, `bronze`, `encouragement`, `participation`
- certificate mode: `score_threshold`, `rank_ratio`, `rank_ratio_with_minimum`

- [ ] **Step 6: Create the initial migration**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe manage.py makemigrations discipline`
Expected: creates `backend/apps/discipline/migrations/0001_initial.py`

- [ ] **Step 7: Re-run the focused service tests**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/discipline/test_services.py -q`
Expected: still FAIL on missing services, but imports and migrations are now valid.

### Task 2: Extend `Result` to preserve original and penalized score state

**Files:**
- Modify: `backend/apps/grading/models.py`
- Modify: `backend/apps/grading/services.py`
- Modify: `backend/tests/grading/test_services.py`
- Modify: `backend/tests/grading/test_result_api.py`

- [ ] **Step 1: Write failing grading tests for original/final score separation**

```python
def test_sync_result_state_sets_original_and_final_scores_equal_before_penalty():
    ...

def test_sync_result_state_keeps_total_score_mirrored_to_final_score():
    ...
```

- [ ] **Step 2: Run the grading tests to verify failure**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/grading/test_services.py backend/tests/grading/test_result_api.py -q`
Expected: FAIL because the new result fields do not exist.

- [ ] **Step 3: Add the score-tracking fields to `Result`**

```python
original_total_score = models.DecimalField(...)
original_percentage = models.DecimalField(...)
penalty_percent_applied = models.DecimalField(...)
final_total_score = models.DecimalField(...)
final_percentage = models.DecimalField(...)
```

- [ ] **Step 4: Update `_sync_result_state()` to populate original and final values**

```python
original_total_score = Decimal(session.objective_score) + manual_score
original_percentage = _calculate_percentage(...)
final_total_score = original_total_score
final_percentage = original_percentage
```

Compatibility rule:
- keep `total_score` mirroring `final_total_score`
- keep `percentage` mirroring `final_percentage`

- [ ] **Step 5: Create or update the migration for new result fields**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe manage.py makemigrations grading`
Expected: creates or updates a grading migration with the new fields.

- [ ] **Step 6: Re-run the grading tests**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/grading/test_services.py backend/tests/grading/test_result_api.py -q`
Expected: PASS

### Task 3: Implement disciplinary recomputation and certificate services

**Files:**
- Create: `backend/apps/discipline/services.py`
- Modify: `backend/apps/grading/services.py`
- Modify: `backend/apps/platform_core/demo_seed.py`
- Test: `backend/tests/discipline/test_services.py`
- Test: `backend/tests/grading/test_candidate_results_api.py`

- [ ] **Step 1: Extend the service tests to cover approved-penalty selection and certificate assignment**

```python
def test_recompute_record_uses_highest_approved_penalty_only():
    ...

def test_recompute_record_restores_original_score_when_no_approved_penalty_remains():
    ...

def test_recompute_certificates_for_score_threshold_mode():
    ...

def test_recompute_certificates_for_rank_ratio_mode():
    ...

def test_recompute_certificates_for_rank_ratio_with_minimum_mode():
    ...
```

- [ ] **Step 2: Run the discipline and candidate-result tests to verify failure**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/discipline/test_services.py backend/tests/grading/test_candidate_results_api.py -q`
Expected: FAIL because recomputation services and certificate materialization do not exist yet.

- [ ] **Step 3: Implement record-selection helpers**

```python
def get_selected_session_for_exam_candidate(*, exam, candidate):
    ...

def get_highest_approved_penalty_percent(*, session):
    ...
```

- [ ] **Step 4: Implement disciplinary record recomputation**

```python
def recompute_disciplinary_record(*, exam, candidate):
    ...
```

Required behavior:
- select highest-scoring attempt
- apply highest approved penalty only
- sync `Result.final_*`, `Result.penalty_percent_applied`, `Result.total_score`, and `Result.percentage`
- keep published results published while changing their values

- [ ] **Step 5: Implement certificate policy evaluation and award materialization**

```python
def recompute_exam_certificates(*, exam, triggered_by=None):
    ...

def assign_award_levels(*, records, policy):
    ...
```

Required behavior:
- always rank by penalized score
- give `participation` to failed candidates
- recompute the whole exam when a relevant score changes

- [ ] **Step 6: Hook proposal approval/rejection into recomputation**

```python
def approve_penalty_proposal(*, proposal, approved_by):
    ...

def reject_penalty_proposal(*, proposal, rejected_by):
    ...

def mark_case_no_penalty(*, proposal, actor):
    ...
```

- [ ] **Step 7: Update demo seed or fixtures so the new fields and relations remain valid in dev data**

```python
result = publish_result(...)
ExamCertificatePolicy.objects.get_or_create(...)
```

- [ ] **Step 8: Re-run the focused backend tests**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/discipline/test_services.py backend/tests/grading/test_candidate_results_api.py backend/tests/grading/test_services.py -q`
Expected: PASS

## Chunk 2: Backend APIs, Export, And Permissions

### Task 4: Add discipline serializers, viewsets, URLs, and exports

**Files:**
- Create: `backend/apps/discipline/exporters.py`
- Create: `backend/apps/discipline/api/__init__.py`
- Create: `backend/apps/discipline/api/serializers.py`
- Create: `backend/apps/discipline/api/views.py`
- Create: `backend/apps/discipline/api/urls.py`
- Modify: `backend/config/urls.py`
- Modify: `backend/apps/grading/api/serializers.py`
- Modify: `backend/apps/grading/api/views.py`
- Test: `backend/tests/discipline/test_api.py`
- Test: `backend/tests/grading/test_result_api.py`
- Test: `backend/tests/grading/test_candidate_results_api.py`

- [ ] **Step 1: Write failing API tests for exam summary, record detail, and proposal mutations**

```python
def test_admin_can_list_discipline_exam_summaries():
    ...

def test_admin_can_list_exam_disciplinary_records():
    ...

def test_admin_can_create_or_update_case_penalty_proposal():
    ...

def test_admin_can_approve_case_penalty_proposal_and_result_updates():
    ...
```

- [ ] **Step 2: Add failing export tests**

```python
def test_admin_can_export_exam_disciplinary_summary_to_excel():
    ...

def test_admin_can_export_exam_case_detail_to_excel():
    ...
```

- [ ] **Step 3: Run the API tests to verify failure**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/discipline/test_api.py backend/tests/grading/test_result_api.py backend/tests/grading/test_candidate_results_api.py -q`
Expected: FAIL because the discipline API does not exist yet.

- [ ] **Step 4: Implement API serializers**

```python
class DisciplinaryExamSummarySerializer(serializers.Serializer):
    ...

class ExamDisciplinaryRecordSerializer(serializers.ModelSerializer):
    ...

class ViolationPenaltyProposalMutationSerializer(serializers.Serializer):
    proposed_penalty_percent = serializers.DecimalField(max_digits=5, decimal_places=2)
    notes = serializers.CharField(required=False, allow_blank=True)
```

- [ ] **Step 5: Implement API views and URL routes**

Required endpoints:
- `GET /api/v1/discipline/exams/`
- `GET /api/v1/discipline/exams/{exam_id}/records/`
- `GET /api/v1/discipline/exams/{exam_id}/cases/`
- `POST /api/v1/discipline/cases/{case_id}/proposal/`
- `POST /api/v1/discipline/cases/{case_id}/approve/`
- `POST /api/v1/discipline/cases/{case_id}/reject/`
- `POST /api/v1/discipline/cases/{case_id}/no-penalty/`
- `POST /api/v1/discipline/exams/{exam_id}/bulk-apply/`
- `PUT /api/v1/discipline/exams/{exam_id}/certificate-policy/`
- `POST /api/v1/discipline/exams/{exam_id}/certificate-recompute/`
- `GET /api/v1/discipline/exams/{exam_id}/export/`
- `GET /api/v1/discipline/exams/{exam_id}/cases/export/`

- [ ] **Step 6: Implement workbook exporters using the existing `openpyxl` pattern**

```python
def build_disciplinary_summary_workbook(records):
    ...

def build_disciplinary_case_workbook(cases):
    ...
```

- [ ] **Step 7: Extend grading serializers so admin and candidate result payloads expose both original and final score values**

```python
fields = (
    ...,
    "original_score",
    "penalty_percent_applied",
    "score",
    "original_percentage",
    "percentage",
    "certificate_level",
)
```

- [ ] **Step 8: Re-run the API-focused tests**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/discipline/test_api.py backend/tests/grading/test_result_api.py backend/tests/grading/test_candidate_results_api.py -q`
Expected: PASS

## Chunk 3: Admin UI And Spreadsheet Workflow

### Task 5: Add the discipline routes, navigation, and shared frontend types

**Files:**
- Create: `src/app/pages/disciplineShared.ts`
- Modify: `src/app/routes.ts`
- Modify: `src/app/components/layouts/AdminLayout.tsx`
- Modify: `src/app/i18n/resources/vi/navigation.ts`
- Modify: `src/app/i18n/resources/en/navigation.ts`
- Test: `src/app/pages/DisciplinaryManagement.test.tsx`

- [ ] **Step 1: Write failing frontend smoke tests for the new route and navigation entry**

```tsx
it("shows the disciplinary navigation entry for admin users", () => {
  ...
})

it("renders the disciplinary management route", async () => {
  ...
})
```

- [ ] **Step 2: Run the smoke tests to verify failure**

Run: `npm.cmd test -- src/app/pages/DisciplinaryManagement.test.tsx`
Expected: FAIL because the route and page do not exist yet.

- [ ] **Step 3: Add shared types and helpers**

```ts
export interface DisciplinaryExamSummaryRecord { ... }
export interface DisciplinaryCandidateRecord { ... }
export interface DisciplinaryCaseRecord { ... }
export interface CertificatePolicyRecord { ... }
```

- [ ] **Step 4: Add routes and navigation labels**

Required routes:
- `/discipline`
- `/discipline/exams/:id`

Navigation label:
- Vietnamese: `Kỷ luật và chứng chỉ`
- English: `Discipline & Certificates`

- [ ] **Step 5: Re-run the smoke tests**

Run: `npm.cmd test -- src/app/pages/DisciplinaryManagement.test.tsx`
Expected: still FAIL on missing UI implementation, but routes and nav compile.

### Task 6: Build the exam list page and exam detail spreadsheet page

**Files:**
- Create: `src/app/pages/DisciplinaryManagement.tsx`
- Create: `src/app/pages/DisciplinaryExamSheet.tsx`
- Create: `src/app/pages/DisciplinaryExamSheet.test.tsx`
- Modify: `src/app/pages/DisciplinaryManagement.test.tsx`

- [ ] **Step 1: Add failing page tests for the exam list view**

```tsx
it("renders exam-level disciplinary summary rows", async () => {
  ...
})

it("allows opening the exam sheet from the summary table", async () => {
  ...
})
```

- [ ] **Step 2: Add failing page tests for the candidate spreadsheet**

```tsx
it("renders original score, penalty percent, and penalized score columns", async () => {
  ...
})

it("supports inline editing of draft penalties and single-row approval", async () => {
  ...
})

it("supports row selection and bulk approval actions", async () => {
  ...
})
```

- [ ] **Step 3: Run the discipline page tests to verify failure**

Run: `npm.cmd test -- src/app/pages/DisciplinaryManagement.test.tsx src/app/pages/DisciplinaryExamSheet.test.tsx`
Expected: FAIL because the pages and interactions do not exist yet.

- [ ] **Step 4: Implement the exam summary page**

Required UI:
- dense table rows
- exam summary columns from the spec
- filter bar
- export button
- open-sheet action
- certificate policy entry point

- [ ] **Step 5: Implement the exam sheet page**

Required UI:
- spreadsheet-style table
- sticky header
- inline percentage input
- expand row to show case sub-grid
- bulk-selection toolbar
- approve/reject/no-penalty actions
- export selected or export page action

- [ ] **Step 6: Re-run the page tests**

Run: `npm.cmd test -- src/app/pages/DisciplinaryManagement.test.tsx src/app/pages/DisciplinaryExamSheet.test.tsx`
Expected: PASS

## Chunk 4: Result Surfaces And Final Verification

### Task 7: Update result-reporting pages to show penalized outcome and certificate level

**Files:**
- Modify: `src/app/pages/ResultsReports.tsx`
- Modify: `src/app/pages/CandidateResults.tsx`
- Modify: `src/app/pages/candidateResultsShared.ts`
- Test: `src/app/pages/DisciplinaryExamSheet.test.tsx`
- Test: `backend/tests/grading/test_candidate_results_api.py`

- [ ] **Step 1: Add failing API/UI expectations for penalized score display**

```python
def test_candidate_results_api_returns_original_and_final_scores_plus_certificate():
    ...
```

```tsx
it("shows penalized published score while preserving original score context", async () => {
  ...
})
```

- [ ] **Step 2: Run the focused backend and frontend tests to verify failure**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/grading/test_candidate_results_api.py -q`
Expected: FAIL if certificate and original/final score fields are still missing from candidate result payloads.

Run: `npm.cmd test -- src/app/pages/DisciplinaryExamSheet.test.tsx`
Expected: FAIL if the admin sheet or result views do not yet show the final score fields correctly.

- [ ] **Step 3: Update result pages**

Required behavior:
- admin results view shows original score, applied penalty, penalized score
- candidate results view shows the published penalized score and certificate level
- helper types in `candidateResultsShared.ts` expose the new fields

- [ ] **Step 4: Re-run the focused backend and frontend tests**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/grading/test_candidate_results_api.py backend/tests/grading/test_result_api.py -q`
Expected: PASS

Run: `npm.cmd test -- src/app/pages/DisciplinaryManagement.test.tsx src/app/pages/DisciplinaryExamSheet.test.tsx`
Expected: PASS

### Task 8: Run the full targeted verification set

**Files:**
- No code changes expected

- [ ] **Step 1: Run backend verification**

Run: `c:/Users/Admin/Documents/Fermat/tool/Education-Exam/backend/.venv/Scripts/python.exe -m pytest backend/tests/discipline/test_services.py backend/tests/discipline/test_api.py backend/tests/grading/test_services.py backend/tests/grading/test_result_api.py backend/tests/grading/test_candidate_results_api.py -q`
Expected: PASS

- [ ] **Step 2: Run frontend verification**

Run: `npm.cmd test -- src/app/pages/DisciplinaryManagement.test.tsx src/app/pages/DisciplinaryExamSheet.test.tsx`
Expected: PASS

- [ ] **Step 3: Review the implementation against the approved spec**

Checklist:
- unique violating candidates grouped by exam
- per-case proposal
- highest approved penalty only
- highest-scoring attempt only
- original/final score separation
- published results updated immediately
- automatic certificate recompute
- three certificate modes
- participation for failed candidates

- [ ] **Step 4: Commit the feature**

```bash
git add backend/apps/discipline backend/config/settings/base.py backend/config/urls.py backend/apps/identity/bootstrap.py backend/apps/grading/models.py backend/apps/grading/services.py backend/apps/grading/api/serializers.py backend/apps/grading/api/views.py backend/apps/platform_core/demo_seed.py backend/tests/discipline backend/tests/grading src/app/pages/disciplineShared.ts src/app/pages/DisciplinaryManagement.tsx src/app/pages/DisciplinaryExamSheet.tsx src/app/pages/DisciplinaryManagement.test.tsx src/app/pages/DisciplinaryExamSheet.test.tsx src/app/routes.ts src/app/components/layouts/AdminLayout.tsx src/app/i18n/resources/vi/navigation.ts src/app/i18n/resources/en/navigation.ts src/app/pages/ResultsReports.tsx src/app/pages/CandidateResults.tsx src/app/pages/candidateResultsShared.ts
git commit -m "feat: add disciplinary penalties and certificate workflows"
```

