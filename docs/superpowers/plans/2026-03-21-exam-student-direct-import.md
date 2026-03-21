# Exam Student Direct Import Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add username-based login plus a direct CSV import flow that creates or updates `student` users and assigns them straight to an exam.

**Architecture:** Implement the change backend-first so identity schema, authentication, and exam-scoped import service are stable before the frontend is updated. Keep import synchronous and reuse the current exam assignment and token flows so the change is backward-compatible with the existing app.

**Tech Stack:** Django, Django REST Framework, SimpleJWT, pytest, React, TypeScript, Vite

---

## File Map

- Modify: `backend/apps/identity/models.py`
- Modify: `backend/apps/identity/api/serializers.py`
- Modify: `backend/apps/identity/api/views.py`
- Modify: `backend/apps/identity/api/urls.py`
- Modify: `backend/apps/identity/admin.py`
- Modify: `backend/apps/identity/management/commands/seed_demo_data.py`
- Modify: `backend/apps/exam_authoring/services.py`
- Modify: `backend/apps/exam_authoring/api/serializers.py`
- Modify: `backend/apps/exam_authoring/api/views.py`
- Modify: `backend/tests/conftest.py`
- Create: `backend/tests/identity/test_auth_login.py`
- Create: `backend/tests/exam_authoring/test_student_import_api.py`
- Create: `backend/apps/identity/migrations/0003_user_username_profile_student_fields.py`
- Modify: `src/app/auth/AuthContext.tsx`
- Modify: `src/app/pages/Login.tsx`
- Modify: `src/app/pages/ExamAssignment.tsx`
- Modify: `src/app/lib/importTemplates.ts`
- Create: `docs/superpowers/plans/2026-03-21-exam-student-direct-import.md`

## Chunk 1: Backend Identity Schema And Login

### Task 1: Add failing tests for username login and new identity fields

**Files:**
- Create: `backend/tests/identity/test_auth_login.py`
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Write the failing login tests**

```python
def test_login_accepts_email_identifier(...):
    response = api_client.post("/api/v1/auth/login/", {"email": "admin@example.com", "password": "secret123"})
    assert response.status_code == 200

def test_login_accepts_username_identifier(...):
    response = api_client.post("/api/v1/auth/login/", {"identifier": "admin.user", "password": "secret123"})
    assert response.status_code == 200
```

- [ ] **Step 2: Run the auth tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/identity/test_auth_login.py -q`
Expected: FAIL because `username` does not exist yet and login only resolves email.

- [ ] **Step 3: Implement the identity schema**

```python
class User(...):
    username = models.CharField(max_length=255, unique=True, db_index=True)

class Profile(...):
    cccd = models.CharField(max_length=32, blank=True, null=True, unique=True)
    date_of_birth = models.DateField(null=True, blank=True)
    student_class = models.CharField(max_length=64, blank=True)
```

- [ ] **Step 4: Add migration with safe backfill**

```python
def seed_usernames(apps, schema_editor):
    ...
```

- [ ] **Step 5: Update login serializer or view to resolve `identifier` by username or email**

```python
identifier = attrs.get("identifier") or attrs.get("email")
user = User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier)).first()
```

- [ ] **Step 6: Re-run the auth tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/identity/test_auth_login.py -q`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/apps/identity backend/tests/identity/test_auth_login.py backend/tests/conftest.py
git commit -m "feat: add username login support"
```

## Chunk 2: Exam Student Import Backend

### Task 2: Add failing API tests for direct exam student import

**Files:**
- Create: `backend/tests/exam_authoring/test_student_import_api.py`
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Write failing import tests**

```python
def test_student_import_creates_user_and_assignment(...):
    response = api_client.post(
        f"/api/v1/exams/{exam.id}/student-import/",
        {"file": upload},
    )
    assert response.status_code == 200
    assert response.json()["created_users"] == 1

def test_student_import_matches_existing_user_by_cccd_and_updates_fields(...):
    ...
```

- [ ] **Step 2: Run the import tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_authoring/test_student_import_api.py -q`
Expected: FAIL because the endpoint and service do not exist yet.

- [ ] **Step 3: Implement row parsing and import helpers in `backend/apps/exam_authoring/services.py`**

```python
def import_students_to_exam(*, exam, uploaded_by, uploaded_file):
    ...
```

- [ ] **Step 4: Add exam action endpoint in `backend/apps/exam_authoring/api/views.py`**

```python
@action(detail=True, methods=["post"], url_path="student-import")
def student_import(self, request, pk=None):
    ...
```

- [ ] **Step 5: Add serializers for import response if needed**

```python
class ExamStudentImportSummarySerializer(serializers.Serializer):
    ...
```

- [ ] **Step 6: Re-run the import tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/exam_authoring/test_student_import_api.py -q`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/apps/exam_authoring backend/tests/exam_authoring/test_student_import_api.py
git commit -m "feat: add direct exam student import api"
```

## Chunk 3: Frontend Login And Exam Assignment UI

### Task 3: Wire frontend login to accept username or email

**Files:**
- Modify: `src/app/auth/AuthContext.tsx`
- Modify: `src/app/pages/Login.tsx`

- [ ] **Step 1: Update the auth client payload**

```ts
body: { identifier, password, email: identifier }
```

- [ ] **Step 2: Update the login form labels and placeholder**

```tsx
<Label htmlFor="identifier">Email or Username</Label>
```

- [ ] **Step 3: Run frontend build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/AuthContext.tsx src/app/pages/Login.tsx
git commit -m "feat: support username sign in in frontend"
```

### Task 4: Add direct student import UI to the exam assignment page

**Files:**
- Modify: `src/app/pages/ExamAssignment.tsx`
- Modify: `src/app/lib/importTemplates.ts`

- [ ] **Step 1: Add a student import template definition**

```ts
export const examStudentImportTemplate = { ... }
```

- [ ] **Step 2: Add upload UI and summary state to the exam assignment screen**

```tsx
const [importFile, setImportFile] = useState<File | null>(null);
const [importSummary, setImportSummary] = useState<...>(null);
```

- [ ] **Step 3: Call the new backend endpoint and reload exam details**

```tsx
await apiRequest(`/api/v1/exams/${id}/student-import/`, { method: "POST", body: formData })
```

- [ ] **Step 4: Show inline result summaries and row-level errors**

```tsx
{importSummary?.errors.map(...)}
```

- [ ] **Step 5: Run frontend build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/ExamAssignment.tsx src/app/lib/importTemplates.ts
git commit -m "feat: add direct student import to exam assignment"
```

## Chunk 4: End-to-End Verification

### Task 5: Run targeted backend and frontend verification

**Files:**
- No new files

- [ ] **Step 1: Run the auth and exam import test suites**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/identity/test_auth_login.py backend/tests/exam_authoring/test_student_import_api.py -q`
Expected: PASS

- [ ] **Step 2: Run adjacent exam and identity tests for regression coverage**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/question_bank/test_import_api.py backend/tests/question_bank/test_api.py backend/tests/grading/test_api.py -q`
Expected: PASS

- [ ] **Step 3: Run frontend build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Inspect git diff and summarize risks**

Run: `git status --short` and `git diff --stat`
Expected: only intended files changed

- [ ] **Step 5: Commit final verification or fixups if required**

```bash
git add -A
git commit -m "chore: finalize direct exam student import"
```
