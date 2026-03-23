import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PracticeSession } from "./PracticeSession";

const mockApiRequest = vi.fn();
const mockNotifyConfirm = vi.fn();
const mockNotifyError = vi.fn();
const mockNotifySuccess = vi.fn();

vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

vi.mock("../lib/notify", () => ({
  notify: {
    success: (...args: unknown[]) => mockNotifySuccess(...args),
    info: vi.fn(),
    warning: vi.fn(),
    error: (...args: unknown[]) => mockNotifyError(...args),
    confirm: (...args: unknown[]) => mockNotifyConfirm(...args),
  },
}));

const sessionPayload = {
  id: 44,
  subject: {
    id: 1,
    name: "Mathematics",
    code: "MATH101",
    color: "bg-blue-600",
  },
  status: "in_progress",
  duration_minutes: 20,
  question_count: 1,
  started_at: "2026-03-23T08:00:00Z",
  expires_at: "2026-03-23T08:20:00Z",
  submitted_at: null,
  remaining_seconds: 900,
  correct_count: 0,
  total_count: 1,
  score_percentage: "0.00",
  answered_count: 0,
  marked_count: 0,
  total_questions: 1,
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
      selected_option_keys: [],
      is_answered: false,
      is_marked_for_review: false,
    },
  ],
};

describe("PracticeSession", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockNotifyConfirm.mockResolvedValue(true);
    mockApiRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/api/v1/practice/sessions/44/") {
        return sessionPayload;
      }
      if (path === "/api/v1/practice/sessions/44/answers/301/" && options?.method === "PUT") {
        return {
          id: 301,
          selected_option_keys: ["A"],
          is_answered: true,
          is_marked_for_review: false,
          updated_at: "2026-03-23T08:05:00Z",
        };
      }
      if (path === "/api/v1/practice/sessions/44/autosave/" && options?.method === "POST") {
        return {
          id: 1,
          answered_count: 1,
          marked_count: 0,
          payload: { current_question_index: 0 },
          created_at: "2026-03-23T08:05:30Z",
        };
      }
      if (path === "/api/v1/practice/sessions/44/submit/" && options?.method === "POST") {
        return {
          id: 44,
          status: "submitted",
          submitted_at: "2026-03-23T08:10:00Z",
          correct_count: 1,
          total_count: 1,
          score_percentage: "100.00",
        };
      }
      throw new Error(`Unhandled apiRequest path: ${path}`);
    });
  });

  it("loads a practice session, saves an answer, and autosaves periodically", async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter initialEntries={["/candidate/practice/sessions/44"]}>
        <Routes>
          <Route path="/candidate/practice/sessions/:id" element={<PracticeSession />} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Practice Session")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText("A. 2"));
      await Promise.resolve();
    });

    expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/v1/practice/sessions/44/answers/301/",
      expect.objectContaining({ method: "PUT" }),
    );

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/v1/practice/sessions/44/autosave/",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("submits the practice session and navigates to review", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/candidate/practice/sessions/44"]}>
        <Routes>
          <Route path="/candidate/practice/sessions/:id" element={<PracticeSession />} />
          <Route path="/candidate/practice/sessions/:id/review" element={<div>Practice Review Route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Practice Session")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /submit practice/i }));

    await waitFor(() => {
      expect(screen.getByText("Practice Review Route")).toBeInTheDocument();
    });
  });
});
