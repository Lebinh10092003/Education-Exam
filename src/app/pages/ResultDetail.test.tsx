import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CandidateResults } from "./CandidateResults";
import { ResultDetail } from "./ResultDetail";

const mockApiRequest = vi.fn();

vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

const resultRecord = {
  id: 7,
  workflow_status: "published",
  publish_state: "published",
  score: "85",
  total_marks: "100",
  percentage: "85",
  result_status: "passed",
  passed: true,
  completed_date: "2026-03-22T10:30:00Z",
  published_at: "2026-03-23T08:15:00Z",
  time_taken_minutes: 78,
  exam: {
    id: 1,
    name: "Mathematics Final Exam",
    subject_name: "Mathematics",
  },
  candidate: {
    id: 2,
    email: "candidate@example.com",
    full_name: "Candidate User",
  },
};

const buildPaginated = <T,>(results: T[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

describe("candidate result detail flow", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/api/v1/my-results/") {
        return buildPaginated([resultRecord]);
      }

      throw new Error(`Unhandled apiRequest path: ${path}`);
    });
  });

  it("links each result row to the dedicated detail route", async () => {
    render(
      <MemoryRouter>
        <CandidateResults />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Mathematics Final Exam")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view/i })).toHaveAttribute("href", "/candidate/results/7");
  });

  it("loads the detail page from the fallback results list when opened directly", async () => {
    render(
      <MemoryRouter initialEntries={["/candidate/results/7"]}>
        <Routes>
          <Route path="/candidate/results/:id" element={<ResultDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Detailed summary for this published candidate result.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mathematics Final Exam" })).toBeInTheDocument();
    expect(screen.getByText("Candidate User")).toBeInTheDocument();
    expect(screen.getAllByText("85%").length).toBeGreaterThan(0);
  });
});
