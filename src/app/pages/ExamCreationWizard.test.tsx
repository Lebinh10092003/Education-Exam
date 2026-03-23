import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExamCreationWizard } from "./ExamCreationWizard";

const mockNavigate = vi.fn();
const mockApiRequest = vi.fn();
const mockNotifyError = vi.fn();
const mockNotifySuccess = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "1" }),
  };
});

vi.mock("../lib/http", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

vi.mock("../lib/notify", () => ({
  notify: {
    success: (...args: unknown[]) => mockNotifySuccess(...args),
    error: (...args: unknown[]) => mockNotifyError(...args),
    confirm: vi.fn(),
  },
}));

const subject = {
  id: 1,
  name: "Mathematics",
  code: "MATH101",
  color: "#2563eb",
};

const examRecord = {
  id: 1,
  name: "Algebra Midterm",
  subject,
  period: null,
  room: null,
  description: "Quarterly algebra exam",
  status: "draft" as const,
  duration_minutes: 60,
  passing_score: 60,
  max_attempts: 1,
  shuffle_questions: false,
  show_results_immediately: false,
  enable_proctoring: true,
  current_version: {
    items: [
      {
        source: "manual" as const,
        question: {
          question_id: 50,
          difficulty: "easy" as const,
        },
      },
    ],
    random_rules: [],
  },
  schedule_window: {
    opens_at: null,
    closes_at: null,
  },
  assignment_summary: {
    assigned_group_ids: [],
  },
};

const buildQuestionRecord = (id: number, questionText: string) => ({
  id,
  difficulty: "easy" as const,
  question_type: "multiple_choice" as const,
  subject,
  current_revision: {
    question_text: questionText,
  },
});

const buildPaginated = <T,>(results: T[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

describe("ExamCreationWizard question import", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockNavigate.mockReset();
    mockApiRequest.mockReset();
    mockNotifyError.mockReset();
    mockNotifySuccess.mockReset();

    mockApiRequest.mockImplementation(async (path: string, options?: { query?: Record<string, unknown> }) => {
      if (path === "/api/v1/subjects/") {
        return buildPaginated([subject]);
      }

      if (path === "/api/v1/groups/") {
        return buildPaginated([]);
      }

      if (path === "/api/v1/exam-periods/") {
        return buildPaginated([]);
      }

      if (path === "/api/v1/exam-rooms/") {
        return buildPaginated([]);
      }

      if (path === "/api/v1/exams/1/") {
        return examRecord;
      }

      if (path === "/api/v1/questions/") {
        const questionIds = options?.query?.subject === "1" || options?.query?.subject === 1
          ? [50, 101, 102]
          : [50];
        return buildPaginated(
          questionIds.map((id) => buildQuestionRecord(id, `Question ${id}`)),
        );
      }

      if (path === "/api/v1/question-imports/") {
        return {
          id: 5,
          source_format: "csv",
          file_name: "questions.csv",
          status: "completed",
          total_records: 2,
          success_count: 2,
          error_count: 0,
          created_question_ids: [101, 102],
          errors: [],
          created_at: "2026-03-23T08:30:00Z",
        };
      }

      throw new Error(`Unhandled apiRequest path: ${path}`);
    });
  });

  it("imports matching questions and adds them to the selected count", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ExamCreationWizard />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("Algebra Midterm")).toBeInTheDocument();

    const nextButtons = screen.getAllByRole("button", { name: /^next$/i });
    const nextButton = nextButtons.find((button) => !button.hasAttribute("disabled")) ?? nextButtons[0];
    await user.click(nextButton);

    expect(await screen.findByRole("button", { name: /import questions/i })).toBeEnabled();
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /import questions/i }));

    const dialog = await screen.findByRole("dialog");
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();

    const file = new File(
      [
        [
          "subject_code,difficulty,question_type,question_text,option_A,option_B,correct_option_keys",
          "MATH101,easy,multiple_choice,What is 2 + 2?,3,4,B",
          "MATH101,easy,multiple_choice,What is 5 + 5?,9,10,B",
        ].join("\n"),
      ],
      "questions.csv",
      { type: "text/csv" },
    );

    await user.upload(fileInput as HTMLInputElement, file);
    await user.click(within(dialog).getByRole("button", { name: /^import questions$/i }));

    await waitFor(() => {
      expect(screen.getByText("3 selected")).toBeInTheDocument();
    });

    expect(mockNotifySuccess).toHaveBeenCalled();
    expect(
      mockApiRequest.mock.calls.some(([path]) => path === "/api/v1/question-imports/"),
    ).toBe(true);
  });

  it("blocks upload when imported rows do not match the exam subject", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ExamCreationWizard />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("Algebra Midterm")).toBeInTheDocument();
    const nextButtons = screen.getAllByRole("button", { name: /^next$/i });
    const nextButton = nextButtons.find((button) => !button.hasAttribute("disabled")) ?? nextButtons[0];
    await user.click(nextButton);
    await user.click(await screen.findByRole("button", { name: /import questions/i }));

    const dialog = await screen.findByRole("dialog");
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();

    const file = new File(
      [
        [
          "subject_code,difficulty,question_type,question_text,option_A,option_B,correct_option_keys",
          "PHYS101,easy,multiple_choice,What is force?,Mass x Acceleration,Velocity,A",
        ].join("\n"),
      ],
      "questions.csv",
      { type: "text/csv" },
    );

    await user.upload(fileInput as HTMLInputElement, file);
    await user.click(within(dialog).getByRole("button", { name: /^import questions$/i }));

    await waitFor(() => {
      expect(mockNotifyError).toHaveBeenCalled();
    });

    expect(mockNotifyError.mock.calls[0][0]).toContain("MATH101");
    expect(
      mockApiRequest.mock.calls.some(([path]) => path === "/api/v1/question-imports/"),
    ).toBe(false);
  });
});
