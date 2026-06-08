import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminResultReview } from "./AdminResultReview";

const mockApiRequest = vi.fn();

vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

describe("AdminResultReview", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders candidate answers, correct answers, scores, and math text", async () => {
    mockApiRequest.mockResolvedValue({
      id: 9,
      candidate: {
        id: 1,
        email: "candidate@example.com",
        full_name: "Nguyễn Văn A",
        username: "imo001",
      },
      exam: {
        id: 2,
        name: "IMO Mock",
        subject_name: "Toán",
      },
      session: {
        id: 11,
        status: "submitted",
        attempt_number: 1,
        started_at: "2026-03-24T10:00:00Z",
        submitted_at: "2026-03-24T11:00:00Z",
        objective_score: "1.00",
        max_score: "3.00",
      },
      result: {
        workflow_status: "finalized",
        publish_state: "draft",
        score: "1.00",
        total_marks: "3.00",
        percentage: "33.33",
        result_status: "Fail",
        completed_date: "2026-03-24T11:00:00Z",
      },
      questions: [
        {
          id: 100,
          sort_order: 1,
          points: "1.00",
          awarded_points: "1.00",
          question_text: "Tính $x^2 + y^2$ khi x=3, y=4.",
          question_type: "multiple_choice",
          difficulty: "medium",
          options: [
            { key: "A", text: "25", is_correct: true, is_selected: true },
            { key: "B", text: "12", is_correct: false, is_selected: false },
          ],
          selected_option_keys: ["A"],
          correct_option_keys: ["A"],
          answer_text: "",
          is_answered: true,
          is_correct: true,
          essay_rubric: "",
          sample_answer: "",
          manual_feedback: "Đúng đáp án.",
          manual_score_awarded: null,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/results/9/review"]}>
        <Routes>
          <Route path="/results/:id/review" element={<AdminResultReview />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Rà bài - Nguyễn Văn A")).toBeInTheDocument();
    expect(mockApiRequest).toHaveBeenCalledWith("/api/v1/results/9/review/");
    expect(screen.getByText("x^2 + y^2")).toBeInTheDocument();
    expect(screen.getByText("Đáp án thí sinh")).toBeInTheDocument();
    expect(screen.getAllByText("Đáp án đúng").length).toBeGreaterThan(0);
    expect(screen.getByText(/Điểm đạt:/)).toBeInTheDocument();
    expect(screen.getByText("Đúng đáp án.")).toBeInTheDocument();
  });
});
