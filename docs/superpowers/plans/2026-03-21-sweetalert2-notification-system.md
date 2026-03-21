# SweetAlert2 Notification System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `sonner` with a shared `SweetAlert2` notification wrapper and migrate all existing frontend notifications to the new system.

**Architecture:** Add a single `notify` utility in the frontend that owns all notification and confirmation behavior. Remove the app-level `Toaster`, migrate all existing `toast.*` calls to `notify.*`, and upgrade destructive flows to `confirm` modals where appropriate so the codebase stops depending on `sonner` entirely.

**Tech Stack:** React, TypeScript, Vite, SweetAlert2

---

## File Map

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/app/App.tsx`
- Delete: `src/app/components/ui/sonner.tsx`
- Create: `src/app/lib/notify.ts`
- Modify: `src/app/pages/ExamAssignment.tsx`
- Modify: `src/app/pages/ExamCreationWizard.tsx`
- Modify: `src/app/pages/ExamManagement.tsx`
- Modify: `src/app/pages/ForgotPassword.tsx`
- Modify: `src/app/pages/GroupManagement.tsx`
- Modify: `src/app/pages/LiveMonitoring.tsx`
- Modify: `src/app/pages/Login.tsx`
- Modify: `src/app/pages/MaterialsLibrary.tsx`
- Modify: `src/app/pages/Profile.tsx`
- Modify: `src/app/pages/QuestionBank.tsx`
- Modify: `src/app/pages/ResultsReports.tsx`
- Modify: `src/app/pages/SubjectManagement.tsx`
- Modify: `src/app/pages/TakeExam.tsx`
- Modify: `src/app/pages/UserManagement.tsx`

## Chunk 1: Shared Notification Wrapper

### Task 1: Add `sweetalert2` and the shared `notify` utility

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/app/lib/notify.ts`

- [ ] **Step 1: Add the new dependency**

Run: `npm.cmd install sweetalert2`
Expected: dependency added to `package.json` and `package-lock.json`

- [ ] **Step 2: Create the shared wrapper**

```ts
import Swal from "sweetalert2";

const toast = Swal.mixin({
  toast: true,
  position: "center",
  showConfirmButton: false,
  timer: 2200,
  timerProgressBar: true,
});

export const notify = {
  success: (message: string) => toast.fire({ icon: "success", title: message }),
  info: (message: string) => toast.fire({ icon: "info", title: message }),
  warning: (message: string) => toast.fire({ icon: "warning", title: message, timer: 2800 }),
  error: (message: string) => Swal.fire({ icon: "error", title: "Error", text: message, confirmButtonText: "OK" }),
  confirm: async (...) => { ... },
};
```

- [ ] **Step 3: Run a quick build to verify the wrapper compiles**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/app/lib/notify.ts
git commit -m "feat: add shared SweetAlert2 notification wrapper"
```

## Chunk 2: App Shell Migration

### Task 2: Remove `sonner` from the app shell

**Files:**
- Modify: `src/app/App.tsx`
- Delete: `src/app/components/ui/sonner.tsx`

- [ ] **Step 1: Remove `Toaster` from the app shell**

```tsx
export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Delete the unused `sonner` wrapper component**

Delete: `src/app/components/ui/sonner.tsx`

- [ ] **Step 3: Run build to catch any remaining shell-level references**

Run: `npm.cmd run build`
Expected: PASS or fail only if page imports still point to `sonner`

- [ ] **Step 4: Commit**

```bash
git add src/app/App.tsx src/app/components/ui/sonner.tsx
git commit -m "refactor: remove sonner app shell integration"
```

## Chunk 3: Direct Notification Migration

### Task 3: Replace `toast.*` usage with `notify.*` in all pages

**Files:**
- Modify: `src/app/pages/ExamAssignment.tsx`
- Modify: `src/app/pages/ExamCreationWizard.tsx`
- Modify: `src/app/pages/ExamManagement.tsx`
- Modify: `src/app/pages/ForgotPassword.tsx`
- Modify: `src/app/pages/GroupManagement.tsx`
- Modify: `src/app/pages/LiveMonitoring.tsx`
- Modify: `src/app/pages/Login.tsx`
- Modify: `src/app/pages/MaterialsLibrary.tsx`
- Modify: `src/app/pages/Profile.tsx`
- Modify: `src/app/pages/QuestionBank.tsx`
- Modify: `src/app/pages/ResultsReports.tsx`
- Modify: `src/app/pages/SubjectManagement.tsx`
- Modify: `src/app/pages/TakeExam.tsx`
- Modify: `src/app/pages/UserManagement.tsx`

- [ ] **Step 1: Replace imports**

```ts
import { notify } from "../lib/notify";
```

- [ ] **Step 2: Replace direct calls**

```ts
notify.success("Saved.");
notify.error(message);
notify.info("Imported with warnings.");
```

- [ ] **Step 3: Keep existing business text unchanged**

Goal: migrate display mechanism only, without rewriting notification copy in this pass.

- [ ] **Step 4: Run build**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 5: Verify zero remaining `sonner` imports**

Run: `Get-ChildItem -Recurse src\app -Include *.ts,*.tsx | Select-String -Pattern 'from "sonner"|from ''sonner'''`
Expected: no matches

- [ ] **Step 6: Commit**

```bash
git add src/app/pages
git commit -m "refactor: migrate page notifications to SweetAlert2"
```

## Chunk 4: Confirmation Upgrades

### Task 4: Add confirmation dialogs to destructive and irreversible actions

**Files:**
- Modify: `src/app/pages/ExamManagement.tsx`
- Modify: `src/app/pages/GroupManagement.tsx`
- Modify: `src/app/pages/MaterialsLibrary.tsx`
- Modify: `src/app/pages/QuestionBank.tsx`
- Modify: `src/app/pages/ResultsReports.tsx`
- Modify: `src/app/pages/SubjectManagement.tsx`
- Modify: `src/app/pages/TakeExam.tsx`
- Modify: `src/app/pages/UserManagement.tsx`

- [ ] **Step 1: Identify destructive actions and guard them with `notify.confirm`**

Target actions:
- delete exam
- delete group
- delete material
- delete question
- delete subject
- delete user
- publish result
- submit exam

- [ ] **Step 2: Apply the confirm flow**

```ts
const confirmed = await notify.confirm({
  title: "Delete user?",
  text: "This action cannot be undone.",
  confirmText: "Delete",
  cancelText: "Cancel",
});

if (!confirmed) {
  return;
}
```

- [ ] **Step 3: Keep post-action success and failure notifications routed through `notify`**

- [ ] **Step 4: Run build**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/pages
git commit -m "feat: add SweetAlert2 confirmations for destructive actions"
```

## Chunk 5: Verification

### Task 5: Verify migration completeness and smoke test key flows

**Files:**
- No new files

- [ ] **Step 1: Verify no `sonner` references remain**

Run: `Get-ChildItem -Recurse src -Include *.ts,*.tsx | Select-String -Pattern 'sonner'`
Expected: no matches

- [ ] **Step 2: Run frontend build**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 3: Spot-check key flows manually**

Check:
- login success and login failure
- create or update success in one admin screen
- import success or warning in one import flow
- destructive action cancel path
- destructive action confirm path
- submit exam confirm path

- [ ] **Step 4: Inspect git diff**

Run: `git status --short` and `git diff --stat`
Expected: only intended frontend notification files changed

- [ ] **Step 5: Commit final cleanup if needed**

```bash
git add -A
git commit -m "chore: finalize SweetAlert2 notification migration"
```
