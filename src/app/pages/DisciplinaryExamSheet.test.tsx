import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DisciplinaryExamSheet } from "./DisciplinaryExamSheet";

const mockApiRequest = vi.fn();
const mockNotifySuccess = vi.fn();
const mockNotifyInfo = vi.fn();
const mockNotifyError = vi.fn();

type MockRecord = {
  id: number;
  exam: {
    id: number;
    name: string;
    subject_name: string;
  };
  candidate: {
    id: number;
    email: string;
    full_name: string;
  };
  selected_session: number | null;
  unique_case_count: number;
  open_case_count: number;
  approved_case_count: number;
  original_total_score: string;
  original_percentage: string;
  applied_penalty_percent: string;
  final_total_score: string;
  final_percentage: string;
  certificate_level_snapshot: string;
  review_status: string;
  published_score_synced_at: string | null;
  updated_at: string;
};

type MockCase = {
  id: number;
  session_id: number;
  candidate: {
    id: number;
    email: string;
    full_name: string;
  };
  exam: {
    id: number;
    name: string;
    subject_name: string;
  };
  severity: string;
  status: string;
  title: string;
  summary: string;
  created_at: string;
  evidence_count: number;
  proposal: {
    proposed_penalty_percent: string;
    status: string;
    notes: string;
    proposed_by: null;
    proposed_at: string | null;
    approved_by: null;
    approved_at: string | null;
  } | null;
};

const createState = () => {
  const record: MockRecord = {
    id: 201,
    exam: {
      id: 11,
      name: "Mathematics Mock Exam",
      subject_name: "Mathematics",
    },
    candidate: {
      id: 7,
      email: "candidate05@example.com",
      full_name: "Nguyen Ngoc Em",
    },
    selected_session: 77,
    unique_case_count: 1,
    open_case_count: 1,
    approved_case_count: 0,
    original_total_score: "80.00",
    original_percentage: "80.00",
    applied_penalty_percent: "0.00",
    final_total_score: "80.00",
    final_percentage: "80.00",
    certificate_level_snapshot: "silver",
    review_status: "pending_review",
    published_score_synced_at: "2026-03-25T03:00:00Z",
    updated_at: "2026-03-25T03:00:00Z",
  };

  const caseRecord: MockCase = {
    id: 51,
    session_id: 77,
    candidate: record.candidate,
    exam: record.exam,
    severity: "warning",
    status: "open",
    title: "Tab Switch",
    summary: "Candidate switched away from the exam tab.",
    created_at: "2026-03-25T03:00:00Z",
    evidence_count: 2,
    proposal: null,
  };

  return {
    record,
    caseRecord,
    policy: {
      mode: "score_threshold",
      gold_config: { threshold: 90 },
      silver_config: { threshold: 80 },
      bronze_config: { threshold: 70 },
      encouragement_config: { threshold: 60 },
    },
  };
};

const wrapPaginated = <T,>(value: T) => ({
  count: Array.isArray(value) ? value.length : 1,
  next: null,
  previous: null,
  results: Array.isArray(value) ? value : [value],
});

const applyPenalty = (record: MockRecord, caseRecord: MockCase, penaltyPercent: string, status: string) => {
  const penaltyValue = Number(penaltyPercent || "0");
  const originalScore = Number(record.original_total_score);
  const finalScore = (originalScore * (100 - penaltyValue)) / 100;
  const normalizedPenalty = penaltyValue.toFixed(2);
  const normalizedFinal = finalScore.toFixed(2);

  record.applied_penalty_percent = normalizedPenalty;
  record.final_total_score = normalizedFinal;
  record.final_percentage = normalizedFinal;
  record.approved_case_count = status === "approved" ? 1 : 0;
  record.review_status = status === "approved" ? "penalty_applied" : "reviewed";
  record.updated_at = "2026-03-25T04:00:00Z";

  caseRecord.proposal = {
    proposed_penalty_percent: normalizedPenalty,
    status,
    notes: "",
    proposed_by: null,
    proposed_at: "2026-03-25T04:00:00Z",
    approved_by: null,
    approved_at: status === "approved" ? "2026-03-25T04:00:00Z" : null,
  };
};

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
    info: (...args: unknown[]) => mockNotifyInfo(...args),
    warning: vi.fn(),
    error: (...args: unknown[]) => mockNotifyError(...args),
    confirm: vi.fn(),
  },
}));

describe("DisciplinaryExamSheet", () => {
  beforeEach(() => {
    const state = createState();

    mockApiRequest.mockImplementation(async (path: string, options?: { method?: string; body?: Record<string, unknown> }) => {
      if (path === "/api/v1/discipline/exams/11/records/") {
        return wrapPaginated(state.record);
      }

      if (path === "/api/v1/discipline/exams/11/cases/") {
        return wrapPaginated(state.caseRecord);
      }

      if (path === "/api/v1/discipline/exams/11/certificate-policy/") {
        if (options?.method === "PUT") {
          state.policy = options.body as typeof state.policy;
          return state.policy;
        }
        return state.policy;
      }

      if (path === "/api/v1/discipline/exams/11/certificate-recompute/" && options?.method === "POST") {
        return { award_count: 1 };
      }

      if (path === "/api/v1/discipline/cases/51/proposal/" && options?.method === "POST") {
        const penalty = String(options?.body?.proposed_penalty_percent ?? "0");
        applyPenalty(state.record, state.caseRecord, penalty, "draft");
        return { id: 88, status: "draft" };
      }

      if (path === "/api/v1/discipline/cases/51/approve/" && options?.method === "POST") {
        const penalty = String(options?.body?.proposed_penalty_percent ?? "0");
        applyPenalty(state.record, state.caseRecord, penalty, "approved");
        return { status: "approved" };
      }

      if (path === "/api/v1/discipline/cases/51/reject/" && options?.method === "POST") {
        applyPenalty(state.record, state.caseRecord, "0", "rejected");
        return { status: "rejected" };
      }

      if (path === "/api/v1/discipline/cases/51/no-penalty/" && options?.method === "POST") {
        applyPenalty(state.record, state.caseRecord, "0", "no_penalty");
        return { status: "no_penalty" };
      }

      if (path === "/api/v1/discipline/exams/11/bulk-apply/" && options?.method === "POST") {
        const penalty = String(options?.body?.proposed_penalty_percent ?? "0");
        applyPenalty(state.record, state.caseRecord, penalty, "approved");
        return { processed_count: 1 };
      }

      throw new Error(`Unhandled apiRequest path: ${path}`);
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/discipline/exams/11"]}>
        <Routes>
          <Route path="/discipline/exams/:id" element={<DisciplinaryExamSheet />} />
        </Routes>
      </MemoryRouter>,
    );

  it("renders original score, penalty percent, and penalized score columns", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: /mathematics mock exam discipline sheet/i })).toBeInTheDocument();
    expect(screen.getByText("Original Score")).toBeInTheDocument();
    expect(screen.getByText("Penalty %")).toBeInTheDocument();
    expect(screen.getByText("Penalized Score")).toBeInTheDocument();
    const candidateCell = screen.getByText("Nguyen Ngoc Em");
    const row = candidateCell.closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLTableRowElement).getAllByText("80.00 (80.00%)").length).toBe(2);
    expect(within(row as HTMLTableRowElement).getByText("0.00%")).toBeInTheDocument();
    expect(within(row as HTMLTableRowElement).getByText("Silver")).toBeInTheDocument();
  });

  it("supports inline editing of draft penalties and single-row approval", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole("button", { name: /toggle cases for nguyen ngoc em/i }));
    const input = await screen.findByLabelText(/penalty percent for case 51/i);
    await user.clear(input);
    await user.type(input, "25");
    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/api/v1/discipline/cases/51/approve/",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            proposed_penalty_percent: "25",
          }),
        }),
      );
    });

    expect(await screen.findByText("25.00%")).toBeInTheDocument();
    expect(screen.getByText("60.00 (60.00%)")).toBeInTheDocument();
  });

  it("supports row selection and bulk approval actions", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole("button", { name: /toggle cases for nguyen ngoc em/i }));
    await user.click(await screen.findByLabelText(/select case 51/i));

    const bulkInput = screen.getByLabelText(/bulk penalty percent/i);
    await user.clear(bulkInput);
    await user.type(bulkInput, "40");
    await user.click(screen.getByRole("button", { name: /approve selected/i }));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/api/v1/discipline/exams/11/bulk-apply/",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            action: "approve",
            proposed_penalty_percent: "40",
            case_ids: [51],
          }),
        }),
      );
    });

    expect(await screen.findByText("40.00%")).toBeInTheDocument();
    expect(screen.getByText("48.00 (48.00%)")).toBeInTheDocument();
  });
});
