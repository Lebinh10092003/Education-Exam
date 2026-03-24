import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExamCreationWizard } from "./ExamCreationWizard";

const mockNavigate = vi.fn();
const mockApiRequest = vi.fn();
const mockNotifyError = vi.fn();
const mockNotifySuccess = vi.fn();
let mockExamId = "1";

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: mockExamId }),
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
  mode: "exam" as const,
  subject,
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
let currentExamRecord: typeof examRecord;

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
    mockExamId = "1";
    currentExamRecord = examRecord;
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

      if (path === "/api/v1/exams/1/") {
        return currentExamRecord;
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

      if (path === "/api/v1/exams/1/student-import/") {
        return {
          total_rows: 2,
          created_users: 1,
          updated_users: 0,
          assigned_users: 2,
          skipped_rows: 0,
          failed_rows: 0,
          errors: [],
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

  it("switches to class-specific guidance when editing a class record", async () => {
    const user = userEvent.setup();
    currentExamRecord = {
      ...examRecord,
      mode: "class",
      name: "IMO Learning Class",
    };

    render(
      <MemoryRouter>
        <ExamCreationWizard />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("IMO Learning Class")).toBeInTheDocument();
    expect(screen.getByText("Edit Class")).toBeInTheDocument();

    const nextButtons = screen.getAllByRole("button", { name: /^next$/i });
    const nextButton = nextButtons.find((button) => !button.hasAttribute("disabled")) ?? nextButtons[0];
    await user.click(nextButton);

    expect(await screen.findByText(/Each practice attempt will request up to 30 random objective questions/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^next$/i }));

    expect(await screen.findByText(/Class mode does not require a fixed schedule window or proctoring setup/i)).toBeInTheDocument();
    expect(screen.getByText("Enroll Groups")).toBeInTheDocument();
    expect(screen.getByText("Import Students Directly To This Class")).toBeInTheDocument();

    const fileInput = document.querySelector('#class-student-import-file');
    expect(fileInput).not.toBeNull();

    const file = new File(
      [
        [
          "full_name,date_of_birth,student_class,cccd,email",
          "Le Van Binh,24/08/2003,12,123456789012,binh@example.com",
          "Tran Thi Ha,15/07/2004,11,123456789013,ha@example.com",
        ].join("\n"),
      ],
      "students.csv",
      { type: "text/csv" },
    );

    await user.upload(fileInput as HTMLInputElement, file);
    await user.click(screen.getByRole("button", { name: /^import students$/i }));

    await waitFor(() => {
      expect(
        screen.getAllByText((_, node) => node?.textContent?.includes("Processed 2 row(s) with 0 skipped.") ?? false)
          .length,
      ).toBeGreaterThan(0);
    });

    expect(
      mockApiRequest.mock.calls.some(([path]) => path === "/api/v1/exams/1/student-import/"),
    ).toBe(true);
  });
});
