import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResultsReports } from "./ResultsReports";

const mockApiRequest = vi.fn();

vi.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const NullComponent = () => null;

  return {
    ResponsiveContainer: Passthrough,
    BarChart: Passthrough,
    Bar: Passthrough,
    CartesianGrid: NullComponent,
    Cell: Passthrough,
    Pie: Passthrough,
    PieChart: Passthrough,
    Tooltip: NullComponent,
    XAxis: NullComponent,
    YAxis: NullComponent,
  };
});

vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

describe("ResultsReports", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/api/v1/results/") {
        return {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 9,
              candidate: {
                id: 1,
                email: "candidate@example.com",
                full_name: "Candidate User",
              },
              exam: {
                id: 2,
                name: "Mathematics Mock Exam",
                subject_name: "Mathematics",
              },
              workflow_status: "finalized",
              publish_state: "draft",
              score: "0.00",
              total_marks: "3.00",
              percentage: "0.00",
              result_status: "Fail",
              passed: false,
              completed_date: "2026-03-24T11:49:00Z",
              time_taken_minutes: 0,
              published_at: null,
            },
          ],
        };
      }

      if (path === "/api/v1/results/summary/") {
        return {
          pass_count: 0,
          fail_count: 1,
          pending_count: 0,
          average_percentage: "0.00",
          score_distribution: [{ range: "0-40", count: 1 }],
        };
      }

      if (path === "/api/v1/exams/") {
        return {
          count: 1,
          next: null,
          previous: null,
          results: [{ id: 2, name: "Mathematics Mock Exam" }],
        };
      }

      throw new Error(`Unhandled apiRequest path: ${path}`);
    });
  });

  it("renders failed finalized results with a red result badge", async () => {
    render(<ResultsReports />);

    const rowEmail = (await screen.findAllByText("candidate@example.com")).find((node) => node.closest("tr"));
    expect(rowEmail).toBeDefined();

    const row = rowEmail?.closest("tr");
    expect(row).not.toBeNull();

    const failBadge = within(row as HTMLTableRowElement).getByText("Fail");
    expect(failBadge).toHaveClass("bg-red-100");
    expect(failBadge).not.toHaveClass("bg-green-100");
  });
});
