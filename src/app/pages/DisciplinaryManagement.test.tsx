import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DisciplinaryManagement } from "./DisciplinaryManagement";

const mockApiRequest = vi.fn();

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
    error: vi.fn(),
    confirm: vi.fn(),
  },
}));

describe("DisciplinaryManagement", () => {
  beforeEach(() => {
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/api/v1/discipline/exams/") {
        return {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 11,
              name: "Mathematics Mock Exam",
              subject_name: "Mathematics",
              unique_violating_candidates: 2,
              total_cases: 5,
              approved_records: 1,
              pending_review_count: 3,
              result_sync_status: "synced",
              certificate_status: "configured",
              last_updated: "2026-03-25T03:00:00Z",
            },
          ],
        };
      }

      throw new Error(`Unhandled apiRequest path: ${path}`);
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders exam-level disciplinary summary rows", async () => {
    render(
      <MemoryRouter>
        <DisciplinaryManagement />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /discipline & certificates/i })).toBeInTheDocument();
    const examName = await screen.findByText("Mathematics Mock Exam");
    const row = examName.closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLTableRowElement).getByText("Mathematics")).toBeInTheDocument();
    expect(within(row as HTMLTableRowElement).getByText("2")).toBeInTheDocument();
    expect(within(row as HTMLTableRowElement).getByText("5")).toBeInTheDocument();
  });

  it("allows opening the exam sheet from the summary table", async () => {
    render(
      <MemoryRouter>
        <DisciplinaryManagement />
      </MemoryRouter>,
    );

    const link = await screen.findByRole("link", { name: /open sheet/i });
    expect(link).toHaveAttribute("href", "/discipline/exams/11");
  });
});
