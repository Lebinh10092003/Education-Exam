import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExamMonitoringHub } from "./ExamMonitoringHub";

const mockApiRequest = vi.fn();

vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

describe("ExamMonitoringHub", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  beforeEach(() => {
    mockApiRequest.mockImplementation(async (path: string, options?: { query?: Record<string, unknown> }) => {
      if (path === "/api/v1/subjects/") {
        return {
          count: 2,
          next: null,
          previous: null,
          results: [
            { id: 1, name: "Mathematics", code: "MATH101", color: "#2563eb" },
            { id: 2, name: "Physics", code: "PHYS101", color: "#16a34a" },
          ],
        };
      }

      if (path === "/api/v1/proctoring/exams/monitoring/") {
        const search = String(options?.query?.search ?? "").toLowerCase();
        const allResults = [
          {
            id: 7,
            name: "Mathematics Final Exam",
            subject_name: "Mathematics",
            status: "open",
            total_candidates: 30,
            total_sessions: 18,
            in_progress_sessions: 12,
            submitted_sessions: 6,
            alert_count: 4,
            critical_alert_count: 1,
            latest_alert_at: "2026-03-24T08:05:00Z",
            highest_alert_severity: "critical",
          },
          {
            id: 8,
            name: "Physics Practice Midterm",
            subject_name: "Physics",
            status: "paused",
            total_candidates: 20,
            total_sessions: 9,
            in_progress_sessions: 3,
            submitted_sessions: 6,
            alert_count: 1,
            critical_alert_count: 0,
            latest_alert_at: "2026-03-24T07:55:00Z",
            highest_alert_severity: "warning",
          },
        ];
        const results = search
          ? allResults.filter(
              (exam) =>
                exam.name.toLowerCase().includes(search) ||
                exam.subject_name.toLowerCase().includes(search),
            )
          : allResults;

        return {
          count: results.length,
          next: null,
          previous: null,
          results,
          summary: {
            exam_count: results.length,
            total_candidates: results.reduce((sum, exam) => sum + exam.total_candidates, 0),
            in_progress_sessions: results.reduce((sum, exam) => sum + exam.in_progress_sessions, 0),
            alert_count: results.reduce((sum, exam) => sum + exam.alert_count, 0),
            critical_exam_count: results.filter((exam) => exam.critical_alert_count > 0).length,
          },
        };
      }

      throw new Error(`Unhandled apiRequest path: ${path}`);
    });
  });

  it("renders the aggregate monitoring table and links to drill-down pages", async () => {
    render(
      <MemoryRouter initialEntries={["/exams/monitoring"]}>
        <Routes>
          <Route path="/exams/monitoring" element={<ExamMonitoringHub />} />
        </Routes>
      </MemoryRouter>,
    );

    expect((await screen.findAllByText("Mathematics Final Exam")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Physics Practice Midterm").length).toBeGreaterThan(0);
    expect(screen.getByText("Monitored exams")).toBeInTheDocument();
    expect(screen.getByText("50 assigned candidates across the current result set.")).toBeInTheDocument();

    const monitoringLinks = screen.getAllByRole("link", { name: /open monitoring/i });
    expect(monitoringLinks[0]).toHaveAttribute("href", "/exams/7?tab=monitoring");

    const examLinks = screen.getAllByRole("link", { name: /open exam/i });
    expect(examLinks[0]).toHaveAttribute("href", "/exams/7");
  });

  it("debounces search requests and refreshes the hub on polling", async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter initialEntries={["/exams/monitoring"]}>
        <Routes>
          <Route path="/exams/monitoring" element={<ExamMonitoringHub />} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getAllByText("Mathematics Final Exam").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("Search proctored exams..."), {
      target: { value: "physics" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/v1/proctoring/exams/monitoring/",
      expect.objectContaining({
        query: expect.objectContaining({ search: "physics" }),
      }),
    );

    expect(screen.getAllByText("Physics Practice Midterm").length).toBeGreaterThan(0);
    expect(screen.queryByText("Mathematics Final Exam")).not.toBeInTheDocument();

    const monitoringCallsBeforePolling = mockApiRequest.mock.calls.filter(
      ([path]) => path === "/api/v1/proctoring/exams/monitoring/",
    ).length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    const monitoringCallsAfterPolling = mockApiRequest.mock.calls.filter(
      ([path]) => path === "/api/v1/proctoring/exams/monitoring/",
    ).length;
    expect(monitoringCallsAfterPolling).toBeGreaterThan(monitoringCallsBeforePolling);
  });
});
