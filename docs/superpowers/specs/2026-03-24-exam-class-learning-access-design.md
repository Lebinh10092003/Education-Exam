# Exam/Class Learning Access Design

## Summary

The current system only models `Exam` as a real assessment. Candidate-facing practice and materials are not scoped to the subjects a user actually has access to, and there is no first-class way to assign users to a subject for learning before a real exam exists.

The chosen design adds a new `Exam.mode` field with two values:

- `exam`: a real assessment that appears in candidate exam lists and continues to drive sessions, grading, results, and proctoring.
- `class`: a learning container tied to a subject that reuses the existing assignment/import flows for bulk roster management, but does not appear as a real exam to candidates.

This avoids abusing `draft` as a fake classroom state and keeps bulk import/remove-by-period operations centered on the existing exam assignment domain.

## Goals

- Reuse existing assignment and CSV import flows for both real exams and learning access.
- Scope candidate/student materials and practice subjects to the union of:
  - subjects from assigned `exam` records
  - subjects from assigned `class` records
- Keep `/candidate/exams` limited to real exams only.
- Allow admins to manage learning access in bulk by creating `class` records per subject.
- Simplify candidate practice creation to subject-only random generation with temporary details retention.

## Non-Goals

- Introduce a separate classroom module unrelated to exams.
- Show `class` records as real exams in the candidate exam list.
- Preserve detailed per-question review forever for practice sessions.

## Data Model

### Exam

Add `mode` to `Exam`:

- `exam` (default): existing behavior
- `class`: learning-only assignment container

Constraints and semantics:

- `class` keeps `subject`, `assignments`, `description`, and optional period for bulk lifecycle management.
- `class` does not participate in candidate exam start flows, sessions, grading, results, or proctoring.
- Existing rows default to `exam`.

### PracticeSession

Keep `PracticeSession` as the durable summary record and add retention metadata:

- `details_retention_until`
- `details_purged_at`

`PracticeSessionQuestion` and `PracticeAutosaveSnapshot` remain temporary detail storage.

## Access Resolution

Introduce a shared access rule for learning subjects:

- learning subjects for a user = distinct subjects from assigned `Exam` rows where `mode in {"exam", "class"}`.
- candidate exam list = assigned `Exam` rows where `mode == "exam"` only.

This applies to both `candidate` and `student` users because the `/candidate/*` shell is shared for learner-facing functionality.

## Candidate Experience

### Practice

- `/candidate/practice` shows only accessible subjects.
- Each subject card creates or resumes one practice session for that subject.
- Session generation is backend-driven:
  - objective questions only
  - random selection
  - target size `min(30, available objective question count for subject)`
- difficulty mix is whatever the random bank provides; the user no longer configures difficulty counts or duration manually.
- duration is derived from question count and fixed by backend.
- after submission, the user sees a summary-only completion screen.
- detailed practice question data is retained for 15 days, then purged automatically.
- practice history keeps the summary after purge.

### Materials

- `/candidate/materials` shows active materials only for accessible subjects.

### Exams

- `/candidate/exams` continues to show real exams only.
- `class` rows are invisible there.

## Admin Experience

### Exam Management

Reuse the existing exam management surface and add `mode`:

- admins can create `exam` or `class`
- `class` uses the same subject and assignment model
- assignment and CSV import screens remain available for both modes
- labels and helper text distinguish real exams from learning classes

### Subject Management

`/subjects` remains metadata management for subjects, not roster management.

Subject rows may surface counts that reflect linked `exam` and `class` usage, but user membership is managed through the `class`/assignment workflow rather than directly on the subject page.

## Cleanup / Retention

Follow the existing retention pattern already used by proctoring:

- add `apps.practice.retention`
- add a management command for cleanup
- add a Celery task and beat schedule

Cleanup behavior:

- find submitted practice sessions whose `details_retention_until` has passed
- delete `PracticeSessionQuestion` rows
- delete `PracticeAutosaveSnapshot` rows
- keep `PracticeSession` summary
- set `details_purged_at`

## Testing Strategy

Backend:

- migration/defaults for `Exam.mode`
- learning subject access derived from assigned `exam` and `class`
- candidate exam list excludes `class`
- materials/practice catalog include only accessible subjects
- practice generation creates up to 30 questions, falling back to maximum available
- practice submit stores summary and cleanup purges only details after 15 days

Frontend:

- candidate practice page uses the standard learner shell width/layout
- candidate practice no longer renders manual difficulty/duration configuration
- only accessible subjects are shown
- `class` records do not appear in candidate exam list
- candidate materials only show accessible subject materials
- admin exam forms/lists surface `mode`
