import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ManualGrading } from "./ManualGrading";

const mockApiRequest = vi.fn();
const mockConfirm = vi.fn();
vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return { ...actual, apiRequest: (...args: unknown[]) => mockApiRequest(...args) };
});
vi.mock("../lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    confirm: (...args: unknown[]) => mockConfirm(...args),
  },
}));

const task = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  status: "pending",
  max_points: "2.00",
  question_text: "Giải thích định lý Pythagore",
  answer_text: "a^2 + b^2 = c^2",
  candidate: { id, email: `hs${id}@x.vn`, full_name: `Học sinh ${id}` },
  exam: { id: 5, name: "Toán 9", subject_name: "Toán" },
  graded_at: null,
  manual_grade: null,
  suggestion: {
    score: "1.50",
    feedback: "Đúng công thức, thiếu ví dụ",
    rationale: "Ý1: 1/1; Ý2: 0.5/1",
    flags: [],
    source: "claude",
    suggested_at: "2026-10-30T03:00:00Z",
  },
  ...overrides,
});

describe("ManualGrading AI suggestions", () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    mockConfirm.mockReset();
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/api/v1/exams/") return { count: 0, next: null, previous: null, results: [] };
      if (path === "/api/v1/grading/tasks/") {
        return {
          count: 2,
          next: null,
          previous: null,
          results: [task(1), task(2, { suggestion: { ...task(2).suggestion, flags: ["prompt_injection"] } })],
        };
      }
      if (path === "/api/v1/grading/tasks/approve-suggestions/") return { graded_count: 1, errors: [] };
      throw new Error(`Unhandled ${path}`);
    });
  });
  afterEach(() => cleanup());

  it("only approves unflagged suggestions after confirmation", async () => {
    const user = userEvent.setup();
    mockConfirm.mockResolvedValue(true);
    render(<MemoryRouter><ManualGrading /></MemoryRouter>);

    const approve = await screen.findByRole("button", { name: /duyệt gợi ý ai \(1\)/i });
    await user.click(approve);

    await waitFor(() =>
      expect(mockApiRequest).toHaveBeenCalledWith("/api/v1/grading/tasks/approve-suggestions/", {
        method: "POST",
        body: { task_ids: [1] },
      }),
    );
  });

  it("fills the grading form from the suggestion and shows flags", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><ManualGrading /></MemoryRouter>);

    const reviewButtons = await screen.findAllByRole("button", { name: /review/i });
    await user.click(reviewButtons[reviewButtons.length - 1]);
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText(/Bài làm chứa câu lệnh/)).toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: /dùng gợi ý/i }));
    expect(within(sheet).getByLabelText(/score awarded/i)).toHaveValue(1.5);
    expect(within(sheet).getByLabelText(/feedback/i)).toHaveValue("Đúng công thức, thiếu ví dụ");
  });
});
