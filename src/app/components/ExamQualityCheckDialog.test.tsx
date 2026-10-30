import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExamQualityCheckDialog, type ExamQualityReport } from "./ExamQualityCheckDialog";

const mockApiRequest = vi.fn();
vi.mock("../lib/http", () => ({ apiRequest: (...args: unknown[]) => mockApiRequest(...args) }));

const report = (overrides: Partial<ExamQualityReport> = {}): ExamQualityReport => ({
  exam: { id: 12, name: "Toán 9", status: "scheduled", subject: "Toán" },
  ready: false,
  summary: { errors: 1, warnings: 1, info: 0 },
  issues: [
    { level: "error", code: "random_pool_too_small", message: "Luật #1: ngân hàng chỉ có 1 câu phù hợp." },
    { level: "warning", code: "no_candidates", message: "Chưa phân công thí sinh nào vào đề." },
  ],
  stats: {
    question_count: 10,
    total_points: "10.00",
    assigned_candidates: 0,
    duration_minutes: 45,
    by_type: { multiple_choice: 8, essay: 2 },
    by_difficulty: { easy: 5, hard: 5 },
    random_rules: [{ sort_order: 1, required: 3, available: 1 }],
  },
  ...overrides,
});

describe("ExamQualityCheckDialog", () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
  });
  afterEach(() => cleanup());

  it("loads the report when opened and lists issues and stats", async () => {
    mockApiRequest.mockResolvedValue(report());

    render(<ExamQualityCheckDialog examId={12} open onOpenChange={() => undefined} />);

    expect(await screen.findByText("Đề chưa sẵn sàng")).toBeInTheDocument();
    expect(mockApiRequest).toHaveBeenCalledWith("/api/v1/exams/12/quality-check/");
    expect(screen.getByText(/ngân hàng chỉ có 1 câu phù hợp/)).toBeInTheDocument();
    expect(screen.getByText(/Chưa phân công thí sinh/)).toBeInTheDocument();
    expect(screen.getByText(/Trắc nghiệm: 8 · Tự luận: 2/)).toBeInTheDocument();
    expect(screen.getByText("ngân hàng có 1")).toBeInTheDocument();
  });

  it("re-runs the check on demand", async () => {
    const user = userEvent.setup();
    mockApiRequest
      .mockResolvedValueOnce(report())
      .mockResolvedValueOnce(report({ ready: true, summary: { errors: 0, warnings: 0, info: 0 }, issues: [] }));

    render(<ExamQualityCheckDialog examId={12} open onOpenChange={() => undefined} />);
    await screen.findByText("Đề chưa sẵn sàng");
    await user.click(screen.getByRole("button", { name: /kiểm tra lại/i }));

    expect(await screen.findByText("Đề sẵn sàng để thi")).toBeInTheDocument();
    expect(screen.getByText("Không phát hiện vấn đề nào.")).toBeInTheDocument();
  });

  it("does not call the API while closed", () => {
    render(<ExamQualityCheckDialog examId={12} open={false} onOpenChange={() => undefined} />);
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("shows API errors", async () => {
    mockApiRequest.mockImplementation(async () => {
      throw new Error("403 Forbidden");
    });

    render(<ExamQualityCheckDialog examId={12} open onOpenChange={() => undefined} />);

    expect(await screen.findByText("403 Forbidden")).toBeInTheDocument();
  });
});
