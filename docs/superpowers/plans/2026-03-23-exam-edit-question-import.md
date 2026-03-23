# Exam Edit Question Import Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline CSV/JSON question import to the exam create/edit wizard, validate subject compatibility before upload, and auto-select successfully imported questions into the exam.

**Architecture:** Implement backend support first by extending question import batches with persistent `created_question_ids` and exposing them through the existing import API. Then add a focused frontend import flow inside `ExamCreationWizard`, with a small client-side validation helper for CSV/JSON subject checks and a page-level test that proves imported IDs are merged into `manual_question_ids`.

**Tech Stack:** Django, Django REST Framework, migrations, pytest, React, TypeScript, Vitest, Testing Library, Vite

---

## File Map

- Modify: `backend/apps/question_bank/models.py`
- Create: `backend/apps/question_bank/migrations/0002_questionimportbatch_created_question_ids.py`
- Modify: `backend/apps/question_bank/services.py`
- Modify: `backend/apps/question_bank/api/serializers.py`
- Modify: `backend/tests/question_bank/test_import_api.py`
- Create: `src/app/lib/questionImportValidation.ts`
- Create: `src/app/lib/questionImportValidation.test.ts`
- Modify: `src/app/pages/ExamCreationWizard.tsx`
- Create: `src/app/pages/ExamCreationWizard.test.tsx`
- Modify: `docs/superpowers/plans/2026-03-23-exam-edit-question-import.md`

## Chunk 1: Backend Import Batch Response

### Task 1: Add failing API coverage for created question IDs

**Files:**
- Modify: `backend/tests/question_bank/test_import_api.py`

- [ ] **Step 1: Extend the JSON import test to assert returned created IDs**

```python
assert data["created_question_ids"]
assert len(data["created_question_ids"]) == 1
```

- [ ] **Step 2: Extend the mixed CSV import test to assert only successful rows appear in `created_question_ids`**

```python
assert len(data["created_question_ids"]) == 1
```

- [ ] **Step 3: Run the targeted import API tests to verify failure**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/question_bank/test_import_api.py -q`
Expected: FAIL because the serializer does not expose `created_question_ids` yet.

### Task 2: Persist and expose created question IDs

**Files:**
- Modify: `backend/apps/question_bank/models.py`
- Create: `backend/apps/question_bank/migrations/0002_questionimportbatch_created_question_ids.py`
- Modify: `backend/apps/question_bank/services.py`
- Modify: `backend/apps/question_bank/api/serializers.py`

- [ ] **Step 1: Add `created_question_ids` to `QuestionImportBatch`**

```python
created_question_ids = models.JSONField(default=list, blank=True)
```

- [ ] **Step 2: Create the migration**

Run: `cd backend; .\.venv\Scripts\python.exe manage.py makemigrations question_bank`
Expected: creates `0002_questionimportbatch_created_question_ids.py`

- [ ] **Step 3: Update the import service to collect successful question IDs**

```python
question = create_question(...)
batch.created_question_ids.append(question.id)
```

- [ ] **Step 4: Save `created_question_ids` when the batch completes**

```python
batch.save(update_fields=["success_count", "error_count", "status", "created_question_ids"])
```

- [ ] **Step 5: Expose `created_question_ids` in `QuestionImportBatchSerializer`**

```python
fields = (..., "created_question_ids", ...)
```

- [ ] **Step 6: Re-run the targeted import API tests**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/question_bank/test_import_api.py -q`
Expected: PASS

## Chunk 2: Frontend Subject Validation Helper

### Task 3: Add failing tests for client-side question import validation

**Files:**
- Create: `src/app/lib/questionImportValidation.ts`
- Create: `src/app/lib/questionImportValidation.test.ts`

- [ ] **Step 1: Write tests for CSV and JSON subject extraction**

```ts
it("accepts csv rows that all match the exam subject", async () => ...)
it("rejects csv rows with mismatched subject codes", async () => ...)
it("rejects malformed json payloads", async () => ...)
```

- [ ] **Step 2: Run the new validation test file to verify failure**

Run: `npm.cmd test -- src/app/lib/questionImportValidation.test.ts`
Expected: FAIL because the helper does not exist yet.

### Task 4: Implement minimal file validation helper

**Files:**
- Create: `src/app/lib/questionImportValidation.ts`

- [ ] **Step 1: Implement a browser-safe file reader helper**

```ts
const readFileText = async (file: File) => await file.text();
```

- [ ] **Step 2: Implement CSV `subject_code` extraction using header parsing**

```ts
const headers = firstLine.split(",");
const subjectCodeIndex = headers.findIndex(...)
```

- [ ] **Step 3: Implement JSON array parsing and `subject_code` extraction**

```ts
const rows = JSON.parse(content) as Array<Record<string, unknown>>;
```

- [ ] **Step 4: Return a normalized validation result**

```ts
type QuestionImportValidationResult = {
  ok: boolean;
  mismatchedSubjectCodes: string[];
  missingSubjectRows: number[];
  error?: string;
};
```

- [ ] **Step 5: Re-run the validation tests**

Run: `npm.cmd test -- src/app/lib/questionImportValidation.test.ts`
Expected: PASS

## Chunk 3: Exam Wizard Import UI

### Task 5: Add failing page-level test for import and auto-selection

**Files:**
- Create: `src/app/pages/ExamCreationWizard.test.tsx`

- [ ] **Step 1: Write a test that renders step 2 with a selected subject and imports a matching file**

```tsx
expect(screen.getByRole("button", { name: /import questions/i })).toBeEnabled()
```

- [ ] **Step 2: Mock `/api/v1/question-imports/` to return `created_question_ids` and assert the selected count increases**

```tsx
expect(await screen.findByText(/2 selected/i)).toBeInTheDocument()
```

- [ ] **Step 3: Add a test that blocks upload when subject codes mismatch**

```tsx
expect(mockedApiRequest).not.toHaveBeenCalledWith("/api/v1/question-imports/", expect.anything())
```

- [ ] **Step 4: Run the new wizard test file to verify failure**

Run: `npm.cmd test -- src/app/pages/ExamCreationWizard.test.tsx`
Expected: FAIL because the wizard has no import flow yet.

### Task 6: Implement inline import flow in `ExamCreationWizard`

**Files:**
- Modify: `src/app/pages/ExamCreationWizard.tsx`

- [ ] **Step 1: Add import dialog state and response types**

```ts
const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
const [importFormat, setImportFormat] = useState<"csv" | "json">("csv");
const [importFile, setImportFile] = useState<File | null>(null);
```

- [ ] **Step 2: Import and reuse `questionImportTemplate` plus `ImportTemplateActions`**

```ts
import { ImportTemplateActions } from "../components/imports/ImportTemplateActions";
import { questionImportTemplate } from "../lib/importTemplates";
```

- [ ] **Step 3: Disable import when no subject is selected and show the current subject code in the dialog**

```tsx
<Button disabled={!formState.subject_id}>Import Questions</Button>
```

- [ ] **Step 4: Validate the selected file against the current subject before upload**

```ts
const validation = await validateQuestionImportFile({ file: importFile, sourceFormat: importFormat, expectedSubjectCode });
```

- [ ] **Step 5: Submit the existing import API request and merge `created_question_ids` into `manual_question_ids`**

```ts
setFormState((previous) => ({
  ...previous,
  manual_question_ids: Array.from(new Set([...previous.manual_question_ids, ...data.created_question_ids])),
}));
```

- [ ] **Step 6: Reload the question list after a successful import**

```ts
await questionsList.reload();
```

- [ ] **Step 7: Surface partial success and row-level errors clearly**

```tsx
{importResult?.errors?.map((error) => ...)}
```

- [ ] **Step 8: Re-run the wizard test file**

Run: `npm.cmd test -- src/app/pages/ExamCreationWizard.test.tsx`
Expected: PASS

## Chunk 4: Verification

### Task 7: Run focused backend and frontend verification

**Files:**
- No new files

- [ ] **Step 1: Run the question bank backend tests**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/question_bank/test_import_api.py backend/tests/question_bank/test_api.py backend/tests/question_bank/test_services.py -q`
Expected: PASS

- [ ] **Step 2: Run the focused frontend tests**

Run: `npm.cmd test -- src/app/lib/questionImportValidation.test.ts src/app/pages/ExamCreationWizard.test.tsx`
Expected: PASS

- [ ] **Step 3: Run the frontend build**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 4: Inspect the final file set**

Run: `git status --short`
Expected: only intended feature files plus any pre-existing unrelated user changes
