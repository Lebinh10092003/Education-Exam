# SweetAlert2 Notification System Design

Date: 2026-03-21

## Goal

Replace the current `sonner` notification usage with a single `SweetAlert2`-based notification system across the frontend, while preserving appropriate UX differences between lightweight notices, blocking errors, and destructive-action confirmations.

## Current Context

- The frontend currently mounts a global `Toaster` in `src/app/App.tsx`.
- Notification calls are spread across many pages and currently use `toast.success`, `toast.error`, and `toast.info` from `sonner`.
- The existing codebase does not yet use `SweetAlert2`.
- Some actions currently show success or error notices only, even when the action is destructive and should ideally ask for confirmation first.

## Scope

This design covers:

- removing `sonner` as the active notification mechanism
- introducing a shared `SweetAlert2` wrapper for all notifications
- replacing all existing `toast.*` calls with the shared wrapper
- adding confirmation dialogs for destructive or irreversible actions

This design does not cover:

- backend API changes
- a new design system beyond notifications
- custom animation packages or additional modal frameworks

## UX Strategy

Use one notification library, but with two display modes:

- `toast` mode for lightweight feedback
- `modal` mode for blocking errors and confirmations

### Toast Mode

Used for:

- success messages
- informational messages
- non-blocking warnings

Behavior:

- `SweetAlert2` toast style
- centered on screen, per approved direction
- auto-dismiss after a short timer
- no background interaction lock

Examples:

- login success
- save success
- import completed with warnings
- local preference saved

### Modal Error Mode

Used for:

- important errors that users must notice
- validation failures that should not disappear too quickly
- server failures with actionable text

Behavior:

- centered modal
- explicit close button or confirm button
- stronger visual emphasis than toast mode

Examples:

- login failure
- submit failure
- import rejected because the file is invalid
- action failure from API response

### Confirmation Mode

Used for:

- destructive actions
- state-changing actions that should be confirmed explicitly

Behavior:

- centered modal with confirm and cancel buttons
- returns a boolean or equivalent promise result
- the caller only proceeds when confirmed

Examples:

- delete user
- delete subject
- delete material
- delete question
- publish result
- submit exam
- lock or unlock user, if product wants confirmation there

## Shared Notification Wrapper

Add a single frontend utility:

- `src/app/lib/notify.ts`

It should expose a narrow API:

- `notify.success(message, options?)`
- `notify.info(message, options?)`
- `notify.warning(message, options?)`
- `notify.error(message, options?)`
- `notify.confirm(options)`

### Wrapper Responsibilities

- centralize `SweetAlert2` configuration
- keep icon, timing, placement, and button style consistent
- prevent direct `Swal.fire(...)` calls from spreading across the codebase
- provide a stable interface for future styling changes

### Default Behavior

- `success`: centered toast, short timer
- `info`: centered toast, short timer
- `warning`: centered toast, medium timer
- `error`: centered modal
- `confirm`: centered modal with explicit confirm/cancel buttons

## File-Level Design

### Remove Old Shell Integration

Modify:

- `src/app/App.tsx`

Changes:

- remove the `Toaster` mount
- keep the rest of the app shell unchanged

The file:

- `src/app/components/ui/sonner.tsx`

should either be deleted or left unused during the transition. Preferred end state is deletion once all references are removed.

### Add New Utility

Create:

- `src/app/lib/notify.ts`

This utility becomes the only allowed notification entry point for app code.

### Replace Page Usage

Update pages currently using `sonner`, including:

- `src/app/pages/ExamAssignment.tsx`
- `src/app/pages/ExamCreationWizard.tsx`
- `src/app/pages/ExamManagement.tsx`
- `src/app/pages/ForgotPassword.tsx`
- `src/app/pages/GroupManagement.tsx`
- `src/app/pages/LiveMonitoring.tsx`
- `src/app/pages/Login.tsx`
- `src/app/pages/MaterialsLibrary.tsx`
- `src/app/pages/Profile.tsx`
- `src/app/pages/QuestionBank.tsx`
- `src/app/pages/ResultsReports.tsx`
- `src/app/pages/SubjectManagement.tsx`
- `src/app/pages/TakeExam.tsx`
- `src/app/pages/UserManagement.tsx`

## Mapping Rules

### Direct Replacements

Straight mapping for most current notifications:

- `toast.success(...)` -> `notify.success(...)`
- `toast.info(...)` -> `notify.info(...)`
- `toast.warning(...)` -> `notify.warning(...)`
- `toast.error(...)` -> `notify.error(...)`

### Upgraded Confirm Flows

Some actions should not remain a simple message-only flow.

Recommended upgrade:

- destructive actions show `notify.confirm(...)` before the API call
- after confirm:
  - success -> `notify.success(...)`
  - failure -> `notify.error(...)`

The first pass should prioritize clearly destructive actions:

- delete actions
- submit exam action
- publish result action

Secondary candidates may include:

- user lock or unlock
- monitoring case resolution

## Styling Direction

Keep the visual language consistent with the existing app:

- centered presentation as approved
- clean, readable buttons
- no heavy custom theming in this round
- rely on `SweetAlert2` defaults with light customization for colors and spacing if needed

This change should improve consistency, not introduce a brand-new visual system.

## Dependency Plan

Frontend dependency:

- add `sweetalert2`

Remove or stop using:

- `sonner`

If the package remains installed briefly during transition, the code should still end with zero runtime references to it.

## Error Handling Principles

- API-derived error messages should continue surfacing meaningful text to users
- modal errors should not hide important context
- lightweight status notices should stay brief and non-blocking
- confirmation dialogs must not execute the action unless the user confirms

## Testing Strategy

### Build Verification

- run frontend build after replacing imports and removing `Toaster`

### Manual Verification

Check representative flows:

- login success
- login failure
- create/update success in admin screens
- import success and import failure in question bank or exam assignment
- delete action confirmation and success
- delete action cancellation
- submit exam confirmation and success or failure

### Regression Focus

Ensure:

- no component still imports `sonner`
- no runtime crash from removing `Toaster`
- confirm dialogs do not execute actions when canceled

## Risks

Primary risk:

- replacing many notification calls at once may miss one or two pages

Mitigation:

- use a single search-and-replace pass for imports
- verify zero remaining `sonner` imports after implementation
- run a frontend build and spot-check the key flows

Secondary risk:

- centered toast mode may feel more intrusive than top-corner toast

Mitigation:

- keep timers short for success and info messages
- reserve modal behavior for errors and confirmations only

## Recommended Implementation Order

1. Add `sweetalert2` and create `notify.ts`
2. Remove `Toaster` from the app shell
3. Replace direct `sonner` imports and calls
4. Upgrade destructive actions to `notify.confirm(...)`
5. Run build and manual checks
