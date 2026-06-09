# Result Publication Workflow Design

## Goal

Build a full result-publication workflow so exam organizers can review, lock, schedule, and publish candidate results, while candidates get clear visibility into submitted exams that are waiting for grading or publication.

## Current State

Results are represented by `grading.Result` with `workflow_status` and `publish_state`.

Important existing behavior:

- Submitting an exam creates or syncs a `Result`.
- Objective-only results finalize immediately.
- Essay/manual results stay `pending_grading` until all manual tasks are graded.
- `show_results_immediately` can auto-publish finalized results when an exam closes.
- Candidates only see `/api/v1/my-results/` records where `publish_state=published`.
- Candidate dashboard only counts published results, so submitted-but-unpublished work can feel invisible.

## Problems

The current logic is functional but too thin for production exam operations:

- `draft/published` does not represent review, lock, scheduled release, or blocked states.
- Admins cannot publish an exam's results in a controlled batch from a single API action.
- Candidates are not told when a submitted result is waiting for grading or publication.
- Notifications are not sent when results become available.
- Auto-publish, manual publish, and future scheduled publish need one shared service so audit and notification behavior stays consistent.

## Proposed Workflow

Keep `Result.workflow_status` for grading readiness and expand publication state on `Result`.

Publication states:

- `draft`: result exists but is not ready for publication workflow.
- `reviewing`: finalized result is awaiting organizer review.
- `locked`: organizer has approved the final score for release.
- `scheduled`: locked result has a future release time.
- `published`: candidate can see the result.

State rules:

- `pending_grading` results cannot be locked, scheduled, or published.
- Finalized results default to `reviewing`, unless immediate publication applies.
- `lock_result()` moves finalized `draft/reviewing` results to `locked`.
- `schedule_result_publication()` moves finalized `locked` results to `scheduled`.
- `publish_result()` publishes any finalized `draft/reviewing/locked/scheduled` result.
- Publishing is idempotent: republishing an already published result returns it without duplicate audit or notification.
- Manual score changes after publication require an explicit unlock/review path later; for this iteration, manual grading updates finalized unpublished results and leaves published results published.

## Auto Publication

`show_results_immediately` remains supported:

- When an exam closes, all finalized unpublished results are published through the central publication service.
- When the final manual task is graded after an already closed exam, the result is published through the same service if `show_results_immediately=true`.
- This preserves the existing exam setting while making audit and notifications consistent.

## Admin API

Extend `ResultViewSet`:

- `POST /api/v1/results/{id}/lock/`
- `POST /api/v1/results/{id}/unlock/`
- `POST /api/v1/results/{id}/schedule-publication/`
- `POST /api/v1/results/{id}/publish/`
- `POST /api/v1/results/publish-exam/`
- `POST /api/v1/results/run-scheduled-publications/`

Enhance summary:

- `pending_grading_count`
- `reviewing_count`
- `locked_count`
- `scheduled_count`
- `published_count`
- existing pass/fail/distribution metrics stay available.

## Candidate API

Keep `/api/v1/my-results/` restricted to published results.

Enhance `/api/v1/my-dashboard/overview/` with:

- `pending_result_count`
- `pending_results`: limited list of submitted results not yet published, with exam name, subject, submitted date, and status label.

This gives candidates a clear post-exam trail without exposing scores early.

## Notifications and Audit

When a result transitions to `published`, create one notification for the candidate:

- category: `result`
- title: result available
- action URL: `/candidate/results/{id}`
- metadata: `result_id`, `exam_id`, `session_id`

All publication actions record audit events:

- `result.locked`
- `result.unlocked`
- `result.scheduled`
- `result.published`
- `result.auto_published`
- `result.exam_bulk_published`
- `result.scheduled_publications_ran`

## Frontend Changes

Admin result screens:

- Add filters and badges for `reviewing`, `locked`, `scheduled`, `published`.
- Add row actions for lock, unlock, schedule, publish.
- Add exam-level bulk publish button.
- Keep review/export links.

Candidate dashboard/results:

- Add pending result count.
- Show pending submitted results on dashboard.
- Results page keeps published-only list but empty state mentions pending results when present.
- Notification link opens the result detail page.

## Data Model

Add fields on `Result`:

- `locked_at`
- `locked_by`
- `scheduled_publish_at`
- `publication_note`

Expand `PublishState` choices as above.

No separate publication table is needed in this iteration because there is exactly one publication record per result, and `Result` already owns publication metadata.

## Testing

Backend:

- result finalization defaults to reviewing.
- finalized results can be locked, scheduled, and published.
- pending grading results cannot be published.
- publish is idempotent and does not duplicate notifications.
- exam close auto-publishes only finalized results when immediate publishing is enabled.
- final manual grading after exam close auto-publishes when immediate publishing is enabled.
- bulk publish publishes finalized results only.
- candidate results endpoint exposes only published results.
- candidate dashboard exposes pending result count/list without scores.

Frontend:

- admin result list renders new states and actions.
- publish actions refresh result list and summary.
- candidate dashboard renders pending results.
- candidate results empty state distinguishes no results from pending unpublished results.

