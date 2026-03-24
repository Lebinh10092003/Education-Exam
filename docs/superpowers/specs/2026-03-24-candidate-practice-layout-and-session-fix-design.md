# Candidate Practice Layout And Session Fix Design

**Goal:** Remove the unnecessary card shell from the candidate practice catalog configuration area and fix the hook-order crash that happens when navigating from candidate pages into a practice session.

## Scope

- Flatten the main configuration block on `/candidate/practice` so it no longer uses the default card wrapper.
- Fix the root cause of `Rendered fewer hooks than expected` when entering `/candidate/practice/sessions/:id`.
- Add a regression test that covers candidate-shell navigation into a practice session route.

## Root Cause

`CandidateLayout` conditionally returns early for fullscreen exam and practice session routes. A `useMemo` hook is declared after that early-return branch. When the user navigates from a normal candidate page to a practice session page, the component renders a different number of hooks and React throws a hook-order error.

## Design

### Candidate Shell

- Remove the unnecessary `useMemo` hook in `CandidateLayout`.
- Compute the active section label without hooks so the early-return path and the standard layout path share the same hook order.

### Practice Catalog

- Replace the large configuration `Card` on `/candidate/practice` with a plain section container.
- Keep the content, controls, and validation behavior unchanged.
- Preserve the rest of the page structure unless required by the visual cleanup.

### Verification

- Extend route-level candidate-shell coverage with a navigation test from `/candidate/practice` to `/candidate/practice/sessions/:id`.
- Run the practice page/session tests and a frontend build.
