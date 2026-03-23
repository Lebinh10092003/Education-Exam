# Exam Edit Question Import Design

Date: 2026-03-23

## Goal

Add an inline question import flow to the exam edit experience at `/exams/:id/edit` so admins can upload CSV or JSON question files without leaving the exam authoring screen. Imported questions should be created in the question bank, validated against the current exam subject, and automatically selected into the exam's manual question list.

## Current Context

- The exam creation and edit flow lives in `src/app/pages/ExamCreationWizard.tsx`.
- Step 2 of the wizard currently supports two composition modes:
  - manual question selection from `/api/v1/questions/`
  - random question rules by difficulty
- The manual question list already filters by the exam subject.
- The question bank page already has a working synchronous import dialog that posts to `POST /api/v1/question-imports/`.
- The backend import endpoint currently returns batch metadata and row-level errors, but it does not expose which question records were created successfully.

## Scope

This design covers:

- adding an `Import Questions` entry point to step 2 of the exam edit/create wizard
- reusing the existing CSV/JSON import pattern from the question bank
- validating that imported rows belong to the current exam subject
- returning created question IDs from the backend import response
- auto-selecting imported questions into `manual_question_ids`
- surfacing partial success and row-level import errors inline

This design does not cover:

- asynchronous or background import jobs
- changing the core exam save API
- cross-subject import into a single exam
- a generic reusable import modal abstraction across all pages
- changes to random-rule behavior

## Product Decision

### Subject Constraint

The import flow should accept only rows whose `subject_code` matches the subject currently selected for the exam.

Why:

- the exam edit flow already treats subject as the top-level filter for question selection
- auto-selecting imported questions is only safe when subject alignment is guaranteed
- silently importing off-subject rows would create confusing behavior
- auto-changing the exam subject based on the file would be a high-risk side effect

### Post-Import Selection

All successfully created questions from the imported file should be added automatically to the exam's `manual_question_ids`.

Behavior:

- existing manual selections remain selected
- newly imported IDs are unioned into the current selection
- failed rows are not selected

## Backend Design

### Existing Endpoint

Keep using:

- `POST /api/v1/question-imports/`

Do not add a second import endpoint for the exam wizard.

### Response Extension

Extend the import batch response to include:

- `created_question_ids`: list of integer IDs for successfully created questions in this batch

This keeps the question bank flow backward-compatible while giving the exam wizard a deterministic way to auto-select imported questions.

### Service Changes

Update `apps.question_bank.services.import_questions_from_upload` so it:

- tracks every `Question` returned by `create_question(...)`
- stores or carries the created IDs through the import lifecycle
- exposes them through the serializer used by the create response

Implementation direction:

- add a storage mechanism on `QuestionImportBatch` for created IDs, or
- attach the IDs on the in-memory batch object returned by the service and serialize them explicitly

Recommendation:

- persist `created_question_ids` on the model as a JSON list field so the response is stable for both immediate POST responses and later GET detail/list calls

This is the most durable and least surprising option, especially if admins later need to inspect import history.

### Validation Rules

The backend import contract remains the same for file parsing and row-level validation.

The new subject-match guard for the exam wizard should happen in the frontend before upload so users get immediate feedback. The backend question import endpoint should remain reusable and subject-agnostic for the standalone question bank.

## Frontend Design

### Location

Add the import UI inside step 2 of `ExamCreationWizard.tsx`, within the `Manual Selection` card.

Recommended placement:

- near the `selected` badge and search area
- clearly labeled as an import action for the current exam subject

### Dialog Content

The dialog should mirror the existing question bank import UX:

- format selector: `CSV` or `JSON`
- file picker
- template preview/download actions using `ImportTemplateActions`
- short note listing required fields

Additional exam-specific content:

- a visible summary of the current exam subject
- a note that all rows must match this subject

### Client-Side Subject Validation

Before upload:

- parse the selected file in the browser
- extract every row's `subject_code`
- reject the upload if any row has a missing or mismatched subject code

Rules:

- for CSV, parse headers and rows client-side
- for JSON, parse the array and inspect each object
- trim whitespace before comparing
- compare against the selected exam subject's `code`

Failure UX:

- block the upload
- show a clear error explaining the expected subject code
- if practical, include a short summary of mismatched codes found

### Success Flow

After a successful upload:

1. call `POST /api/v1/question-imports/`
2. read `created_question_ids` from the response
3. reload the existing questions list for the selected subject
4. merge the returned IDs into `manual_question_ids`
5. close the dialog
6. show a success or mixed-result toast

If some rows fail but some succeed:

- still auto-select the successfully created questions
- show the success count and error count
- surface row-level messages in the dialog or an inline summary after close

### Error Display

Show row-level import errors using the existing batch response fields:

- `row_number`
- `message`
- optional raw payload context only if it improves readability and does not overwhelm the dialog

The dialog should handle:

- no file selected
- unsupported JSON structure
- malformed CSV/JSON
- subject mismatch before upload
- backend partial success
- backend full failure

## Data Flow

### Create Or Edit Exam

The import flow should work in both create and edit modes as long as the exam subject is already chosen.

Rules:

- if no subject is selected yet, disable the import action
- if the subject changes after previous manual selections, keep the existing subject-change reset behavior already present in the page

### Selection State

`manual_question_ids` remains the single source of truth for manual inclusion in the exam payload.

Imported questions are not saved separately. They simply become selected questions in the same state slice used by the current wizard.

## Testing Strategy

### Backend Tests

Add or update tests to verify:

- question import create response includes `created_question_ids`
- the IDs correspond to actual created records
- failed rows are excluded from `created_question_ids`
- existing question bank list/create flows remain unaffected

### Frontend Tests

Add tests to verify:

- import action is disabled until a subject is selected
- CSV subject validation blocks upload when subject codes mismatch
- JSON subject validation blocks upload when subject codes mismatch
- successful import merges returned IDs into `manual_question_ids`
- partial success still selects successful rows and shows error feedback

### Verification

Minimum verification for rollout:

- targeted backend pytest coverage for question import API/service
- frontend build
- targeted frontend tests around the exam wizard import flow if the repo has coverage in that area

## Implementation Notes

- Prefer copying only the necessary import-dialog logic from `QuestionBank.tsx` into the exam wizard rather than creating a broad shared abstraction during this change.
- Keep the change focused on question import plus selection. Do not refactor the entire exam wizard.
- Preserve current behavior for users who continue to select questions manually without importing.
