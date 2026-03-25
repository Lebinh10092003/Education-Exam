import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveMonitoring } from "./LiveMonitoring";
import { CANDIDATE_CONNECTION_FILTER_OPTIONS } from "./liveMonitoringShared";

const mockApiRequest = vi.fn();
const mockNotifyError = vi.fn();
const mockNotifySuccess = vi.fn();
const mockConnectViewerRoom = vi.fn();
const mockDisconnectRoom = vi.fn();
const websocketInstances: Array<{
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close: ReturnType<typeof vi.fn>;
}> = [];
const attachedVideoElement = document.createElement("video");
attachedVideoElement.setAttribute("data-testid", "live-webcam-track");

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
    confirm: vi.fn(),
  },
}));

vi.mock("../lib/storage", async () => {
  const actual = await vi.importActual<typeof import("../lib/storage")>("../lib/storage");
  return {
    ...actual,
    getStoredTokens: () => ({ access: "access-token", refresh: "refresh-token" }),
  };
});

vi.mock("../lib/proctoringMedia", async () => {
  const actual = await vi.importActual<typeof import("../lib/proctoringMedia")>("../lib/proctoringMedia");
  return {
    ...actual,
    connectViewerRoom: (...args: unknown[]) => mockConnectViewerRoom(...args),
    disconnectRoom: (...args: unknown[]) => mockDisconnectRoom(...args),
  };
});

describe("LiveMonitoring", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    class WebSocketMock {
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: (() => void) | null = null;

      close = vi.fn();

      constructor(_url: string) {
        websocketInstances.push(this);
        queueMicrotask(() => {
          this.onopen?.();
        });
      }
    }

    Object.defineProperty(window, "WebSocket", {
      writable: true,
      value: WebSocketMock,
    });
    websocketInstances.length = 0;

    mockConnectViewerRoom.mockResolvedValue({ disconnect: mockDisconnectRoom });
    mockApiRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/api/v1/proctoring/exams/1/monitoring/") {
        return {
          exam: { id: 1, name: "Mathematics Final Exam", subject_name: "Mathematics" },
          total_candidates: 1,
          in_progress: 1,
          completed: 0,
          not_started: 0,
          average_progress: 50,
          candidate_statuses: [
            {
              candidate: {
                id: 2,
                email: "candidate@example.com",
                full_name: "Candidate One",
              },
              session_id: 77,
              status: "in_progress",
              progress_percentage: 50,
              questions_answered: 1,
              total_questions: 2,
              time_elapsed_minutes: 10,
              connection_status: "stable",
              last_activity_at: "2026-03-23T08:05:00Z",
              media: {
                webcam_publish_status: "idle",
                screen_capture_status: "ready",
                last_publish_at: "2026-03-23T08:00:00Z",
                live_request_enabled: false,
                live_slot_active: false,
              },
            },
          ],
          alerts: [
            {
              id: 99,
              session_id: 77,
              candidate: {
                id: 2,
                email: "candidate@example.com",
                full_name: "Candidate One",
              },
              event_type: "fullscreen_exit",
              severity: "warning",
              message: "Candidate exited fullscreen mode.",
              metadata: {},
              occurred_at: "2026-03-23T08:05:00Z",
              case_id: 5,
            },
          ],
        };
      }
      if (path === "/api/v1/exams/1/") {
        return { id: 1, status: "open" };
      }
      if (path === "/api/v1/proctoring/cases/") {
        return {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 5,
              session: 77,
              candidate: {
                id: 2,
                email: "candidate@example.com",
                full_name: "Candidate One",
              },
              exam: {
                id: 1,
                name: "Mathematics Final Exam",
                subject_name: "Mathematics",
              },
              severity: "warning",
              status: "open",
              title: "Fullscreen Exit",
              summary: "Candidate exited fullscreen mode.",
              event_ids: [19],
              evidence_ids: [31, 32],
              evidence_items: [
                {
                  id: 31,
                  evidence_type: "webcam_snapshot",
                  file_url: "https://example.com/webcam.png",
                  captured_at: "2026-03-23T08:05:00Z",
                  deleted_at: null,
                },
                {
                  id: 32,
                  evidence_type: "screen_capture",
                  file_url: "https://example.com/screen.png",
                  captured_at: "2026-03-23T08:05:00Z",
                  deleted_at: null,
                },
              ],
              resolved_at: null,
              resolution_notes: "",
            },
          ],
        };
      }
      if (path === "/api/v1/proctoring/sessions/77/media/view-token/" && options?.method === "POST") {
        return {
          provider: "livekit",
          server_url: "wss://127.0.0.1:7880",
          room_name: "eduexam-exam-1-session-77",
          participant_name: "proctor-1-session-77",
          access_token: "token",
          expires_at: "2026-03-23T08:15:00Z",
        };
      }
      if (path === "/api/v1/proctoring/sessions/77/media/view-token/" && options?.method === "DELETE") {
        return null;
      }
      throw new Error(`Unhandled apiRequest path: ${path}`);
    });
  });

  it("shows local-only webcam readiness and opens live view on demand", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/exams/1/monitor"]}>
        <Routes>
          <Route path="/exams/:id/monitor" element={<LiveMonitoring />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("tab", { name: /candidate status/i }));

    expect((await screen.findAllByText(/webcam local only/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/screen evidence ready/i).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: /open webcam/i })[0]);

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/api/v1/proctoring/sessions/77/media/view-token/",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("attaches a live webcam track even when it is delivered before the stage mounts", async () => {
    const user = userEvent.setup();
    let deliveredTrack = false;

    mockConnectViewerRoom.mockResolvedValueOnce({
      disconnect: mockDisconnectRoom,
      on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
        if (!deliveredTrack && String(event).toLowerCase().includes("tracksubscribed")) {
          deliveredTrack = true;
          callback({
            kind: "video",
            attach: () => attachedVideoElement,
          });
        }
      }),
    });

    render(
      <MemoryRouter initialEntries={["/exams/1/monitor"]}>
        <Routes>
          <Route path="/exams/:id/monitor" element={<LiveMonitoring />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("tab", { name: /candidate status/i }));
    await user.click((await screen.findAllByRole("button", { name: /open webcam/i }))[0]);

    expect(await screen.findByTestId("live-webcam-track")).toBeInTheDocument();
  });

  it("renders linked evidence previews for a violation case", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/exams/1/monitor"]}>
        <Routes>
          <Route path="/exams/:id/monitor" element={<LiveMonitoring />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("tab", { name: /live alerts/i }));
    await user.click((await screen.findAllByRole("button", { name: /view violation/i }))[0]);

    expect(await screen.findByText(/violation detail/i)).toBeInTheDocument();
    expect(screen.getByText("Bằng chứng webcam")).toBeInTheDocument();
    expect(screen.getByText("Bằng chứng màn hình")).toBeInTheDocument();
    expect(await screen.findByAltText(/webcam evidence/i)).toBeInTheDocument();
    expect(screen.getByAltText(/screen evidence/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /bằng chứng webcam source/i })).toHaveAttribute(
      "href",
      "https://example.com/webcam.png",
    );
  });

  it("opens the selected violation detail from a live alert", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/exams/1/monitor"]}>
        <Routes>
          <Route path="/exams/:id/monitor" element={<LiveMonitoring />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("tab", { name: /live alerts/i }));
    await user.click((await screen.findAllByRole("button", { name: /view violation/i }))[0]);

    expect(await screen.findByText(/violation detail/i)).toBeInTheDocument();
    expect(screen.getAllByText(/fullscreen exit/i).length).toBeGreaterThan(0);
    expect(screen.getByAltText(/webcam evidence/i)).toBeInTheDocument();
  });

  it("applies consistent sheet padding for the violation detail panel", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/exams/1/monitor"]}>
        <Routes>
          <Route path="/exams/:id/monitor" element={<LiveMonitoring />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("tab", { name: /live alerts/i }));
    await user.click((await screen.findAllByRole("button", { name: /view violation/i }))[0]);

    const sheetTitle = await screen.findByText(/violation detail/i);
    const sheetHeader = sheetTitle.closest('[data-slot="sheet-header"]');
    const sheetContent = sheetTitle.closest('[data-slot="sheet-content"]');

    expect(sheetHeader).toHaveClass("p-0", "pr-12");
    expect(sheetContent).toHaveClass("px-6", "py-6");
  });

  it("applies websocket media deltas without reloading the full snapshot", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/exams/1/monitor"]}>
        <Routes>
          <Route path="/exams/:id/monitor" element={<LiveMonitoring />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("tab", { name: /candidate status/i }));
    await screen.findByText(/webcam local only/i);

    const initialMonitoringCalls = mockApiRequest.mock.calls.filter(
      ([path]) => path === "/api/v1/proctoring/exams/1/monitoring/",
    ).length;

    await act(async () => {
      websocketInstances[0].onmessage?.({
        data: JSON.stringify({
          type: "media_state",
          payload: {
            session_id: 77,
            webcam_publish_status: "publishing",
            screen_capture_status: "ready",
            last_publish_at: "2026-03-23T08:06:00Z",
            live_request_enabled: true,
            live_slot_active: true,
          },
        }),
      });
      await Promise.resolve();
    });

    expect(await screen.findByText(/webcam live available/i)).toBeInTheDocument();
    const nextMonitoringCalls = mockApiRequest.mock.calls.filter(
      ([path]) => path === "/api/v1/proctoring/exams/1/monitoring/",
    ).length;
    expect(nextMonitoringCalls).toBe(initialMonitoringCalls);
  });

  it("defines an unstable connection filter that matches backend statuses", () => {
    expect(CANDIDATE_CONNECTION_FILTER_OPTIONS).toContainEqual({
      value: "unstable",
      label: "Unstable",
    });
    expect(CANDIDATE_CONNECTION_FILTER_OPTIONS.some((option) => option.value === "intermittent")).toBe(false);
  });
});
