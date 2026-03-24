import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../i18n";
import { PracticeReview } from "./PracticeReview";

const mockApiRequest = vi.fn();

vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

describe("PracticeReview", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/api/v1/practice/sessions/44/review/") {
        return {
          id: 44,
          subject: {
            id: 1,
            name: "Mathematics",
            code: "MATH101",
            color: "bg-blue-600",
          },
          status: "submitted",
          started_at: "2026-03-23T08:00:00Z",
          submitted_at: "2026-03-23T08:10:00Z",
          duration_minutes: 20,
          summary: {
            correct_count: 1,
            incorrect_count: 1,
            total_count: 2,
            score_percentage: "50.00",
          },
          questions: [
            {
              id: 301,
              sort_order: 1,
              difficulty: "easy",
              question_type: "multiple_choice",
              question_text: "What is 1 + 1?",
              options: [
                { key: "A", text: "2", sort_order: 1 },
                { key: "B", text: "3", sort_order: 2 },
              ],
              selected_option_keys: ["B"],
              correct_option_keys: ["A"],
              is_answered: true,
              is_marked_for_review: false,
              is_correct: false,
              explanation_text: "Addition basics.",
            },
          ],
        };
      }
      throw new Error(`Unhandled apiRequest path: ${path}`);
    });
  });

  it("renders submitted practice review data with candidate and correct answers", async () => {
    render(
      <MemoryRouter initialEntries={["/candidate/practice/sessions/44/review"]}>
        <Routes>
          <Route path="/candidate/practice/sessions/:id/review" element={<PracticeReview />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Score 50%")).toBeInTheDocument();
    expect(screen.getByText(/your answer/i)).toBeInTheDocument();
    expect(screen.getByText(/correct answer/i)).toBeInTheDocument();
    expect(screen.getByText("Addition basics.")).toBeInTheDocument();
  });
});
