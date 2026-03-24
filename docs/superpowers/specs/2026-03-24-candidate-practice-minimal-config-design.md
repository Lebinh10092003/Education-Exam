# Candidate Practice Minimal Config Design

**Goal:** Simplify candidate practice creation so learners only choose a subject, while the backend remains responsible for generating a random practice set.

## Scope

- Remove manual duration and difficulty-count controls from the candidate practice page.
- Keep subject selection as the only user input before starting practice.
- Update the page copy so it matches the backend behavior: random objective questions, capped at 30, using the maximum available set when the bank is smaller.

## Design

### Practice Creation UX

- The candidate selects a subject and clicks the start button.
- The UI explains that the system will generate a random objective practice set for that subject.
- The UI explains that the question pool is capped at 30 questions and falls back to the maximum available count if the subject bank is smaller.
- The UI explains that timing is handled automatically by the system.

### Frontend Behavior

- `PracticeExam` no longer stores or validates manual difficulty counts or duration values.
- Practice session creation requests only send `subject_id`.
- Validation only blocks when there is no subject with available objective questions.

### Verification

- Update the practice page test to assert that only `subject_id` is sent during session creation.
- Keep the existing session and route tests unchanged because the session flow itself does not change.
