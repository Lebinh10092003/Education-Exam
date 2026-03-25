# Disciplinary Penalties And Certificates Design

Date: 2026-03-25

## Goal

Add an admin-managed disciplinary workflow and exam certificate system that:

- groups disciplinary review by exam
- shows a dedicated spreadsheet-style admin page instead of mixing the workflow into live monitoring
- allows per-case penalty proposals and approval
- applies the approved penalty to the candidate's highest-scoring attempt for that exam
- computes the effective penalty as the highest approved penalty among that candidate's cases for the selected attempt
- preserves original score, applied penalty, and penalized score side by side
- immediately updates already published results when a penalty is approved or removed
- recalculates certificates automatically after score changes
- supports export for both summary and case-level detail

The user additionally requires:

- exam-level grouping by unique violating candidates
- each violation case has its own penalty proposal
- certificate ranking uses penalized score, not original score
- if a candidate has multiple attempts for the same exam, the system uses the highest-scoring attempt
- failed candidates receive the `Participation` certificate level

## Current Context

The repository already has the pieces needed to anchor this design:

- `apps.proctoring` stores `ViolationCase`, evidence, and review state
- `apps.grading` stores `Result`
- `Result` currently exposes only one score path:
  - `total_score`
  - `percentage`
  - `passed`
  - `publish_state`
- result publishing is already implemented, and candidate/admin pages read published result data
- the admin navigation already has dedicated areas for monitoring, grading, and results reporting
- violation export already exists for monitoring history

What is missing:

- no disciplinary screen grouped by exam
- no penalty proposal model
- no bulk penalty workflow
- no connection between approved violations and result score
- no certificate policy or certificate award model
- no auto-recompute path from disciplinary decision to certificate update

## Product Decision

### Chosen Approach

Use a dedicated disciplinary domain on top of the existing proctoring and grading modules.

That means:

- `ViolationCase` remains the source of violation events
- a new `discipline` app manages penalty proposals, aggregated disciplinary state, certificate policy, and certificate awards
- `Result` is extended so original score and penalized score can coexist
- the admin gets a new spreadsheet-style page for reviewing, editing, approving, and exporting disciplinary decisions

### Why This Approach

This keeps responsibilities clean:

- proctoring detects and stores violations
- grading owns exam results
- discipline owns penalty decisions and certificate assignment

That separation is more durable than trying to bolt penalty logic straight into `ViolationCase` or `Result` with ad hoc fields.

### Rejected Alternatives

#### Compute everything dynamically from `ViolationCase` and `Result`

Rejected because the queries become hard to audit, bulk workflows become awkward, and the system has no stable record of proposal and approval decisions.

#### Store only one final score and overwrite the original value

Rejected because it destroys traceability and makes disputes difficult to resolve.

#### Build certificate ranking as a one-off export instead of a first-class model

Rejected because the user requires automatic updates when disciplinary outcomes change.

## Scope

This design covers:

- new disciplinary models and services
- result field extensions for original versus penalized score
- admin page for disciplinary review
- bulk actions
- exports
- certificate policy management
- automatic certificate recalculation
- testing and rollout boundaries

This design does not cover:

- PDF certificate rendering templates
- email delivery of certificates
- cross-exam award programs
- multi-level approval chains
- appeal workflow

## Success Criteria

The design is successful when:

- admins can open a dedicated page grouped by exam and see unique violating candidates
- each violation case can carry its own penalty proposal
- admins can approve or reject proposals individually or in bulk
- the system applies only the highest approved penalty for the candidate's highest-scoring attempt in that exam
- original score, penalty percent, and penalized score are visible together
- published results update automatically after penalty changes
- certificates update automatically after penalty-driven score changes
- exports are available for exam summary and detailed case review

## Architecture Overview

### Existing Modules Kept In Place

- `apps.proctoring`
  - keeps violation events, cases, evidence, and operator review data
- `apps.grading`
  - keeps result lifecycle, publishing, and candidate-visible result APIs

### New Module

Add `apps.discipline` for:

- penalty proposal state
- per-exam per-candidate disciplinary aggregation
- disciplinary audit logs
- certificate policies
- certificate awards
- recomputation services

This keeps disciplinary business rules isolated from monitoring and from raw grading calculations.

## Data Model

### `ViolationPenaltyProposal`

One active proposal per violation case.

Fields:

- `violation_case`
- `proposed_penalty_percent`
- `status`
  - `draft`
  - `approved`
  - `rejected`
  - `no_penalty`
- `notes`
- `proposed_by`
- `proposed_at`
- `approved_by`
- `approved_at`

Rules:

- every case may have its own proposal
- editing a draft updates the same record instead of creating many parallel proposals in V1
- approval and rejection are explicit state transitions

### `ExamDisciplinaryRecord`

Aggregated row for `exam + candidate`, tied to the candidate attempt selected by policy.

Fields:

- `exam`
- `candidate`
- `selected_session`
- `unique_case_count`
- `open_case_count`
- `approved_case_count`
- `highest_approved_penalty_percent`
- `original_total_score`
- `original_percentage`
- `final_total_score`
- `final_percentage`
- `result_publish_state_snapshot`
- `published_score_synced_at`
- `certificate_level_snapshot`
- `updated_at`

Rules:

- `selected_session` is always the highest-scoring attempt for that candidate in the exam
- the applied penalty is the highest approved penalty among cases attached to that session
- if no approved penalty remains, `final_*` values revert to `original_*`

### `ExamDisciplinaryActionLog`

Append-only audit log for:

- proposal created
- proposal edited
- proposal approved
- proposal rejected
- proposal marked as no-penalty
- result synchronized
- certificate recomputed

This log is for audit and dispute resolution, not for driving live UI state.

### `ExamCertificatePolicy`

One active policy per exam.

Fields:

- `exam`
- `mode`
  - `score_threshold`
  - `rank_ratio`
  - `rank_ratio_with_minimum`
- `gold_config`
- `silver_config`
- `bronze_config`
- `encouragement_config`
- `updated_by`
- `updated_at`

Policy meaning:

- `score_threshold`
  - each award level is granted by minimum penalized percentage
- `rank_ratio`
  - awards are assigned by candidate rank distribution
- `rank_ratio_with_minimum`
  - ranks still matter, but each award also requires a minimum penalized percentage

`participation` is always assigned to failed candidates in V1 and is not a toggleable policy setting.

### `ExamCertificateAward`

Materialized award output for `exam + candidate`.

Fields:

- `exam`
- `candidate`
- `selected_session`
- `award_level`
  - `gold`
  - `silver`
  - `bronze`
  - `encouragement`
  - `participation`
- `basis_total_score`
- `basis_percentage`
- `policy_snapshot`
- `awarded_at`
- `recomputed_at`

Rules:

- award calculation always uses penalized score
- failed candidates receive `participation`
- if the selected attempt changes because a better attempt appears later, the record is recomputed using that attempt

## Result Model Changes

Extend `Result` so the system keeps both original and penalized values.

New or repurposed fields:

- `original_total_score`
- `original_percentage`
- `penalty_percent_applied`
- `final_total_score`
- `final_percentage`

Behavior:

- internal grading continues to compute the original score first
- candidate-facing and admin-facing published result views use `final_*`
- original values remain visible to disciplinary admins and for audit

To reduce migration risk in V1:

- existing `total_score` and `percentage` may remain as compatibility fields
- they should mirror `final_total_score` and `final_percentage`
- new APIs can expose both original and final values explicitly

## Disciplinary Workflow

### Record Selection

For each `exam + candidate` pair:

1. gather all attempts for that exam
2. choose the highest-scoring attempt
3. build the disciplinary record around that attempt only

If two attempts tie, V1 should break ties by newest finalized attempt.

### Case Proposal

Admin can:

- enter a penalty percent from `0` to `100`
- save as draft
- mark a case as `no_penalty`

Each case keeps its own proposal record.

### Approval

When a proposal is approved:

1. mark the proposal as `approved`
2. recompute the candidate's `ExamDisciplinaryRecord`
3. determine the highest approved penalty for the selected attempt
4. recompute final score
5. synchronize the related `Result`
6. trigger certificate recomputation for the exam

### Rejection Or No Penalty

When an approved proposal is later rejected or changed to `no_penalty`:

1. recompute from all remaining approved proposals
2. reapply the highest surviving approved penalty
3. if none remain, restore the original score
4. rerun certificate assignment

## Score Calculation Rules

### Penalty Basis

Penalty percent is applied to the student's achieved score, not to exam max score.

Formula:

- `final_total_score = original_total_score * (1 - penalty_percent / 100)`
- `final_percentage = final_total_score / max_score * 100`

### Multiple Cases

If multiple cases are approved for the selected attempt:

- use the highest approved penalty
- do not sum penalties

This rule was explicitly chosen by the user.

### Published Results

If the result is already published:

- the visible published score changes immediately after approval or removal of the effective penalty

The publish state remains published. The system only updates the values behind the published result.

## Certificate Assignment

### Award Levels

Supported levels:

- `gold`
- `silver`
- `bronze`
- `encouragement`
- `participation`

`participation` is reserved for failed candidates.

### Method 1: Score Threshold

Awards depend on minimum penalized percentage per level.

Example:

- gold: `>= 90%`
- silver: `>= 80%`
- bronze: `>= 70%`
- encouragement: `>= 60%`

### Method 2: Rank Ratio

Awards depend on candidate ordering by penalized percentage.

Example:

- top 10%: gold
- next 20%: silver
- next 30%: bronze
- remaining passed candidates: encouragement

### Method 3: Rank Ratio With Minimum Score

Same as method 2, but each level also requires a minimum penalized percentage.

If a candidate falls into a rank bucket but misses the minimum score for that bucket, they cascade to the next eligible level. Failed candidates still receive `participation`.

### Recompute Strategy

Certificate assignment must be treated as exam-wide derived state.

When a disciplinary outcome changes a final score:

1. mark the exam certificate state dirty
2. trigger recomputation for the exam
3. regenerate all award rows for that exam based on current penalized scores

V1 should recompute the entire exam award set, not patch single rows in place.

## Admin Experience

### New Pages

Add:

- `/discipline`
- `/discipline/exams/:id`

Navigation placement:

- admin sidebar
- near `Live Monitoring` and `Results`

### Exam List Page

Spreadsheet-style table where each row is an exam.

Columns:

- exam
- subject
- unique violating candidates
- total cases
- approved records
- pending review count
- result sync status
- certificate status
- last updated

Actions:

- open disciplinary sheet
- export exam summary
- edit certificate policy
- rerun certificate computation

### Exam Detail Page

Spreadsheet-style review table where each row is one candidate record.

Columns:

- select
- candidate
- email or candidate code
- selected attempt
- case count
- highest case severity
- original score
- applied penalty percent
- penalized score
- pass or fail after penalty
- certificate level
- review status
- last updated

Each row can expand to show case-level detail.

### Case Sub-Grid

Each case row shows:

- violation type
- timestamp
- evidence count
- proposed penalty percent
- proposal status
- proposed by
- approved by
- actions

Inline actions:

- save draft penalty
- mark no penalty
- approve
- reject
- open detail or evidence

### Bulk Actions

For selected candidate rows or selected cases:

- set draft penalty percent
- mark no penalty
- approve selected proposals
- reject selected proposals
- export selected rows

Bulk approval still respects the highest-penalty-only rule during recomputation.

## API Design

### Read APIs

- `GET /api/v1/discipline/exams/`
  - paginated exam summary list
- `GET /api/v1/discipline/exams/{exam_id}/records/`
  - disciplinary rows for spreadsheet view
- `GET /api/v1/discipline/exams/{exam_id}/cases/`
  - detailed case rows for expansion or secondary table
- `GET /api/v1/discipline/exams/{exam_id}/export/`
  - Excel export for aggregate disciplinary sheet
- `GET /api/v1/discipline/exams/{exam_id}/cases/export/`
  - Excel export for case-level detail

### Mutation APIs

- `POST /api/v1/discipline/cases/{case_id}/proposal/`
  - create or edit draft proposal
- `POST /api/v1/discipline/cases/{case_id}/approve/`
  - approve proposal
- `POST /api/v1/discipline/cases/{case_id}/reject/`
  - reject proposal
- `POST /api/v1/discipline/cases/{case_id}/no-penalty/`
  - explicitly mark case as no-penalty
- `POST /api/v1/discipline/exams/{exam_id}/bulk-apply/`
  - bulk proposal or approval action
- `PUT /api/v1/discipline/exams/{exam_id}/certificate-policy/`
  - save award policy
- `POST /api/v1/discipline/exams/{exam_id}/certificate-recompute/`
  - manual recompute trigger

## Error Handling

### Validation

Reject:

- penalty percent outside `0-100`
- approval without an existing proposal
- disciplinary sync when the selected result does not exist yet
- certificate policy with overlapping or impossible thresholds
- rank-ratio totals that exceed `100%`

### Concurrency

Use optimistic concurrency on editable rows.

If a proposal or disciplinary record changed since the table loaded:

- mutation fails with a reload-required response
- UI shows a refresh prompt

### Partial Failure

Penalty approval and result synchronization must be in the same transaction boundary.

Certificate recomputation can run immediately after that transaction. If certificate recomputation fails:

- the approved penalty still stands
- the result remains updated
- the exam certificate state is marked failed or dirty
- admin can rerun recomputation manually

## Export Design

### Exam Summary Export

One row per candidate disciplinary record.

Columns include:

- exam
- candidate
- selected attempt
- original score
- applied penalty percent
- penalized score
- pass or fail
- current certificate
- case count
- approval summary

### Case Detail Export

One row per violation case.

Columns include:

- exam
- candidate
- selected attempt
- case type
- occurred at
- evidence count
- proposed penalty percent
- proposal status
- proposed by
- approved by
- effective applied penalty on record

This export complements the existing monitoring export rather than replacing it.

## Frontend Structure

Add:

- `src/app/pages/DisciplinaryManagement.tsx`
- `src/app/pages/DisciplinaryExamSheet.tsx`
- shared helpers for table columns, status mapping, and certificate labels

Update:

- `src/app/routes.ts`
- `src/app/components/layouts/AdminLayout.tsx`
- result and candidate result pages to display original versus final fields where appropriate

The disciplinary UI should feel closer to a spreadsheet than to the monitoring card layout:

- dense rows
- inline editing
- sticky header
- bulk-selection toolbar
- expandable detail rows

## Testing Strategy

### Backend

Service tests for:

- selecting the highest-scoring attempt
- breaking attempt ties by newest finalized attempt
- applying highest approved penalty only
- restoring original score when no approved penalty remains
- syncing published result updates
- recomputing certificate awards for each policy mode
- assigning `participation` to failed candidates

API tests for:

- exam summary list
- disciplinary record list
- proposal create or update
- approve or reject or no-penalty actions
- bulk action behavior
- export endpoints
- permission enforcement

### Frontend

Component and page tests for:

- exam list rendering
- spreadsheet row rendering
- inline penalty editing
- bulk selection and bulk action toolbar
- row expansion into case detail
- certificate policy editor
- updated score display

### Regression

Verify:

- `LiveMonitoring` still resolves cases as before
- `ResultsReports` stays usable with new score fields
- candidate result pages show penalized published score
- existing violation export remains intact

## Rollout Plan

Recommended order:

1. extend result model for original and final values
2. add discipline models and recomputation services
3. expose read APIs and exports
4. expose mutation APIs
5. add admin exam list page
6. add spreadsheet exam detail page
7. add certificate policy editor and recompute triggers
8. update result views

This order keeps the domain model stable before UI bulk-edit behavior is introduced.

## Open Decisions Closed By User

The following decisions are fixed by user input:

- certificate uses penalized score
- multiple approved cases use the highest penalty, not cumulative penalties
- exam-level grouping counts unique violating candidates
- each case has its own penalty proposal
- keep original score, penalty, and penalized score side by side
- published results update immediately
- certificate recalculates automatically
- the selected attempt is the highest-scoring attempt
