# Exam Results Review Export Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local-only support for clearer exam assignment wording, distinct exam action icons, multi-subject roster labels, math-safe question import/rendering, exam result exports, candidate attendance exports, and admin review of candidate submissions.

**Architecture:** Keep existing models where possible. Extend API serializers/viewsets with read-only review/export endpoints backed by current `ExamSession`, `SessionQuestion`, `SessionAnswer`, `Result`, and assignment data. Add focused frontend pages/actions that call these endpoints without deploying to VPS.

**Tech Stack:** Django REST Framework, openpyxl, React/Vite, lucide-react, Vitest, pytest.

---

### Task 1: Localized roster labels and assignment wording

**Files:**
- Modify: `src/app/pages/GroupMembersPage.tsx`
- Modify: `src/app/lib/importTemplates.ts`
- Modify: `src/app/pages/ExamAssignment.tsx`
- Modify: `src/app/pages/ExamManagement.tsx`
- Modify: `src/app/i18n/resources/vi/navigation.ts`

- [ ] Rename `Môn thi quốc gia` UI label to `Môn thi đăng ký`.
- [ ] Keep backend field name `national_exam_subject` to avoid unnecessary migration.
- [ ] Rename exam assignment UI to `Gán nhóm thí sinh` for exams and `Gán học viên vào lớp` for classes.
- [ ] Replace duplicate monitor icon in `/exams`.
- [ ] Fix mojibake in Vietnamese navigation resources.

### Task 2: Math-safe imports and rendering

**Files:**
- Modify: `backend/apps/question_bank/models.py`
- Modify: `backend/apps/question_bank/services.py`
- Modify: `backend/apps/question_bank/api/serializers.py`
- Modify: `src/app/lib/importTemplates.ts`
- Modify: `src/app/pages/QuestionBank.tsx`
- Modify: `src/app/pages/TakeExam.tsx`
- Create: `src/app/components/MathText.tsx`
- Test: `backend/tests/question_bank/test_import_api.py`
- Test: `src/app/lib/questionImportValidation.test.ts`

- [ ] Add `xlsx` as a question import source format.
- [ ] Parse `.xlsx` using existing backend `openpyxl`.
- [ ] Add tests proving CSV, JSON, and XLSX preserve Unicode math symbols and LaTeX text.
- [ ] Add a lightweight `MathText` component that renders plain text safely and visually separates inline LaTeX segments without unsafe HTML.
- [ ] Use `MathText` in question display/review surfaces touched by this task.

### Task 3: Result roster exports and submission review API

**Files:**
- Modify: `backend/apps/grading/api/serializers.py`
- Modify: `backend/apps/grading/api/views.py`
- Test: `backend/tests/grading/test_result_api.py`

- [ ] Add admin detail serializer for result submission review: candidate, exam, session, result, and every question/answer.
- [ ] Add `GET /api/v1/results/{id}/review/`.
- [ ] Add `GET /api/v1/results/{id}/review-export/` for one-candidate XLSX review.
- [ ] Add `GET /api/v1/results/export-xlsx/` for result summary XLSX.
- [ ] Add `GET /api/v1/results/exam-roster-export/?exam=<id>` with sheets `Kết quả`, `Đã thi`, and `Chưa thi`.
- [ ] Include full candidate roster fields in export sheets.

### Task 4: Frontend result exports and review UI

**Files:**
- Modify: `src/app/pages/ResultsReports.tsx`
- Create: `src/app/pages/AdminResultReview.tsx`
- Modify: `src/app/routes.ts`
- Test: `src/app/pages/ResultsReports.test.tsx`
- Test: `src/app/routes.test.tsx`

- [ ] Add export buttons for CSV, XLSX, and exam roster XLSX.
- [ ] Add `Rà bài` action for each result.
- [ ] Add admin route `/results/:id/review`.
- [ ] Render question-by-question review with candidate answer, correct answer, score, and manual feedback.
- [ ] Add one-candidate review XLSX download.

### Task 5: Verification

- [ ] Run focused backend tests.
- [ ] Run focused frontend tests.
- [ ] Run Django check.
- [ ] Run frontend build.
- [ ] Confirm git status shows local-only changes and no VPS deploy was run.
