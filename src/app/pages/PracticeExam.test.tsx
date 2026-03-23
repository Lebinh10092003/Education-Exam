import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PracticeExam } from "./PracticeExam";

const mockApiRequest = vi.fn();
const mockNotifyError = vi.fn();

vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

vi.mock("../lib/notify", () => ({
  notify: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: (...args: unknown[]) => mockNotifyError(...args),
    confirm: vi.fn(),
  },
}));

const buildPaginated = <T,>(results: T[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

describe("PracticeExam", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockApiRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/api/v1/practice/catalog/") {
        return {
          results: [
            {
              subject: {
                id: 1,
                name: "Mathematics",
                code: "MATH101",
                color: "bg-blue-600",
              },
              counts: { easy: 12, medium: 8, hard: 5, total: 25 },
            },
          ],
        };
      }

      if (path === "/api/v1/practice/history/") {
        return buildPaginated([
          {
            id: 44,
            subject: {
              id: 1,
              name: "Mathematics",
              code: "MATH101",
              color: "bg-blue-600",
            },
            status: "in_progress",
            duration_minutes: 20,
            question_count: 5,
            started_at: "2026-03-23T08:00:00Z",
            expires_at: "2026-03-23T08:20:00Z",
            submitted_at: null,
            remaining_seconds: 600,
            correct_count: 0,
            total_count: 5,
            score_percentage: "0.00",
            answered_count: 2,
            marked_count: 1,
            total_questions: 5,
          },
        ]);
      }

      if (path === "/api/v1/practice/sessions/" && options?.method === "POST") {
        return {
          id: 99,
          subject: {
            id: 1,
            name: "Mathematics",
            code: "MATH101",
            color: "bg-blue-600",
          },
          status: "in_progress",
          duration_minutes: 20,
          question_count: 4,
          started_at: "2026-03-23T09:00:00Z",
          expires_at: "2026-03-23T09:20:00Z",
          submitted_at: null,
          remaining_seconds: 1200,
          correct_count: 0,
          total_count: 4,
          score_percentage: "0.00",
          answered_count: 0,
          marked_count: 0,
          total_questions: 4,
          questions: [],
        };
      }

      throw new Error(`Unhandled apiRequest path: ${path}`);
    });
  });

  it("renders the quick practice hub from the practice catalog and history endpoints", async () => {
    render(
      <MemoryRouter>
        <PracticeExam />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Quick Practice" })).toBeInTheDocument();
    expect(screen.getAllByText("Mathematics")[0]).toBeInTheDocument();
    expect(screen.getByText("Resume session")).toBeInTheDocument();
    expect(screen.getByText("Latest practice history")).toBeInTheDocument();
  });

  it("creates a practice session and navigates to the practice runner", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/candidate/practice"]}>
        <Routes>
          <Route path="/candidate/practice" element={<PracticeExam />} />
          <Route path="/candidate/practice/sessions/:id" element={<div>Practice Session Route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Quick Practice" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Easy questions"));
    await user.type(screen.getByLabelText("Easy questions"), "4");
    await user.click(screen.getByRole("button", { name: /start practice/i }));

    await waitFor(() => {
      expect(screen.getByText("Practice Session Route")).toBeInTheDocument();
    });

    expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/v1/practice/sessions/",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          subject_id: 1,
          duration_minutes: 20,
          difficulty_counts: { easy: 4, medium: 0, hard: 0 },
        }),
      }),
    );
  });
});
