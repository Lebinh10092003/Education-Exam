import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExamDetail } from "./ExamDetail";

const mockUseAsyncList = vi.fn();
const mockUseMutationState = vi.fn();

vi.mock("../hooks/useAsyncList", () => ({
  useAsyncList: (...args: unknown[]) => mockUseAsyncList(...args),
}));

vi.mock("../hooks/useMutationState", () => ({
  useMutationState: (...args: unknown[]) => mockUseMutationState(...args),
}));

vi.mock("./LiveMonitoring", () => ({
  LiveMonitoring: () => <div>Embedded monitoring workspace</div>,
}));

const examRecord = {
  id: 7,
  name: "Mathematics Final Exam",
  description: "End of term assessment",
  mode: "exam" as const,
  status: "open" as const,
  duration_minutes: 90,
  passing_score: 60,
  max_attempts: 2,
  shuffle_questions: true,
  show_results_immediately: false,
  enable_proctoring: true,
  subject: {
    id: 11,
    name: "Mathematics",
    code: "MATH101",
    color: "#2563eb",
  },
  current_version: {
    id: 41,
    version_number: 3,
    item_count: 1,
    items: [
      {
        id: 51,
        source: "manual" as const,
        sort_order: 1,
        points: "5",
        question: {
          id: 61,
          question_id: 601,
          revision_number: 2,
          question_text: "What is 2 + 2?",
          question_type: "multiple_choice",
          difficulty: "easy",
        },
      },
    ],
    random_rules: [
      {
        id: 71,
        sort_order: 1,
        difficulty: "easy",
        question_type: "multiple_choice",
        tag_ids: [1, 2],
        count: 1,
      },
    ],
  },
  schedule_window: {
    opens_at: "2026-03-23T08:00:00Z",
    closes_at: "2026-03-23T10:00:00Z",
  },
  assignment_summary: {
    group_count: 1,
    user_count: 2,
    total_candidates: 3,
    assigned_group_ids: [1],
    assigned_user_ids: [2, 3],
    assigned_groups: [
      {
        id: 1,
        name: "Grade 10A",
        member_count: 24,
      },
    ],
  },
  delivery_summary: {
    total_sessions: 3,
    in_progress_sessions: 1,
    submitted_sessions: 1,
  },
  created_at: "2026-03-01T08:00:00Z",
  updated_at: "2026-03-23T08:00:00Z",
};

describe("ExamDetail", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockUseAsyncList.mockImplementation(() => ({
      data: examRecord,
      error: null,
      isLoading: false,
      reload: vi.fn(),
      setData: vi.fn(),
    }));
    mockUseMutationState.mockImplementation(() => ({
      isSubmitting: false,
      error: null,
      run: async (mutation: () => Promise<unknown>) => mutation(),
    }));
  });

  it("opens the monitoring tab from the canonical query route and keeps the other tabs available", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/exams/7?tab=monitoring"]}>
        <Routes>
          <Route path="/exams/:id" element={<ExamDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/embedded monitoring workspace/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Live Monitor" })).toHaveAttribute(
      "href",
      "/exams/7?tab=monitoring",
    );
    expect(screen.getByRole("link", { name: "Monitor Delivery" })).toHaveAttribute(
      "href",
      "/exams/7?tab=monitoring",
    );

    await user.click(screen.getByRole("tab", { name: "Questions" }));

    expect(await screen.findByText("What is 2 + 2?")).toBeInTheDocument();
  });

  it("hides the monitoring tab when proctoring is disabled", () => {
    mockUseAsyncList.mockImplementation(() => ({
      data: {
        ...examRecord,
        enable_proctoring: false,
      },
      error: null,
      isLoading: false,
      reload: vi.fn(),
      setData: vi.fn(),
    }));

    render(
      <MemoryRouter initialEntries={["/exams/7"]}>
        <Routes>
          <Route path="/exams/:id" element={<ExamDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Monitoring" })).not.toBeInTheDocument();
  });
});
