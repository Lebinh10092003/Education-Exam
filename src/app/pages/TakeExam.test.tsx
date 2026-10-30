import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../i18n";
import { TakeExam } from "./TakeExam";

const mockApiRequest = vi.fn();
const mockNotifyConfirm = vi.fn();
const mockNotifyError = vi.fn();
const mockNotifySuccess = vi.fn();
const mockNotifyWarning = vi.fn();
const mockRequestProctoringStreams = vi.fn();
const mockCaptureTrackSnapshot = vi.fn();
const mockConnectCandidatePublisher = vi.fn();
const mockDisconnectRoom = vi.fn();
const mockRequestFullscreen = vi.fn();
const mockSaveSnapshotLocally = vi.fn();
const mockGetTopViolationSnapshots = vi.fn();
const mockClearSessionSnapshots = vi.fn();
const mockCompressSnapshotForUpload = vi.fn();

const websocketInstances: Array<{
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close: ReturnType<typeof vi.fn>;
}> = [];

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
    warning: (...args: unknown[]) => mockNotifyWarning(...args),
    error: (...args: unknown[]) => mockNotifyError(...args),
    confirm: (...args: unknown[]) => mockNotifyConfirm(...args),
  },
}));

vi.mock("../lib/proctoringCapture", () => ({
  claimStashedProctoringStreams: () => null,
  hasStashedProctoringStreams: () => false,
  releaseStashedProctoringStreams: () => undefined,
  requestProctoringStreams: (...args: unknown[]) => mockRequestProctoringStreams(...args),
  captureTrackSnapshot: (...args: unknown[]) => mockCaptureTrackSnapshot(...args),
}));

vi.mock("../lib/snapshotStore", () => ({
  saveSnapshotLocally: (...args: unknown[]) => mockSaveSnapshotLocally(...args),
  getTopViolationSnapshots: (...args: unknown[]) => mockGetTopViolationSnapshots(...args),
  clearSessionSnapshots: (...args: unknown[]) => mockClearSessionSnapshots(...args),
  compressSnapshotForUpload: (...args: unknown[]) => mockCompressSnapshotForUpload(...args),
  countSessionSnapshots: vi.fn().mockResolvedValue(0),
  saveExamDraft: vi.fn().mockResolvedValue(undefined),
  getExamDraft: vi.fn().mockResolvedValue(null),
  clearExamDraft: vi.fn().mockResolvedValue(undefined),
}));


vi.mock("../lib/proctoringMedia", async () => {
  const actual = await vi.importActual<typeof import("../lib/proctoringMedia")>("../lib/proctoringMedia");
  return {
    ...actual,
    connectCandidatePublisher: (...args: unknown[]) => mockConnectCandidatePublisher(...args),
    disconnectRoom: (...args: unknown[]) => mockDisconnectRoom(...args),
  };
});

vi.mock("../lib/storage", async () => {
  const actual = await vi.importActual<typeof import("../lib/storage")>("../lib/storage");
  return {
    ...actual,
    getStoredTokens: () => ({ access: "access-token", refresh: "refresh-token" }),
  };
});

const sessionPayload = {
  id: 77,
  exam_id: 1,
  exam_name: "Mathematics Final Exam",
  subject: {
    id: 1,
    name: "Mathematics",
    code: "MATH101",
    color: "bg-blue-600",
  },
  status: "in_progress",
  attempt_number: 1,
  started_at: "2026-03-23T08:00:00Z",
  // Han lam bai tinh tu thoi diem chay test, neu khong man hinh "het gio" se bat len.
  expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  submitted_at: null,
  show_results_immediately: false,
  enable_proctoring: true,
  remaining_seconds: 1800,
  objective_score: "0.00",
  max_score: "1.00",
  manual_grading_required: false,
  answered_count: 0,
  marked_count: 0,
  total_questions: 1,
  questions: [
    {
      id: 301,
      sort_order: 1,
      points: "1.00",
      question_text: "What is 1 + 1?",
      question_type: "multiple_choice",
      difficulty: "easy",
      options: [
        { key: "A", text: "2", sort_order: 1 },
        { key: "B", text: "3", sort_order: 2 },
      ],
      selected_option_keys: [],
      answer_text: "",
      is_answered: false,
      is_marked_for_review: false,
    },
  ],
};

const captureResources = {
  webcamStream: { getTracks: () => [] },
  screenStream: { getTracks: () => [] },
  webcamTrack: { stop: vi.fn() },
  microphoneTrack: { stop: vi.fn() },
  screenTrack: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    stop: vi.fn(),
  },
  dispose: vi.fn(),
};

function renderTakeExam() {
  return render(
    <MemoryRouter initialEntries={["/candidate/exam/1"]}>
      <Routes>
        <Route path="/candidate/exam/:id" element={<TakeExam />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TakeExam", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(async () => {
    mockNotifyConfirm.mockResolvedValue(true);
    await i18n.changeLanguage("en");
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      configurable: true,
      writable: true,
      value: null,
    });
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: mockRequestFullscreen,
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      writable: true,
      value: null,
    });
    mockRequestFullscreen.mockImplementation(async () => {
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        writable: true,
        value: document.documentElement,
      });
    });
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
      configurable: true,
      writable: true,
      value: WebSocketMock,
    });
    websocketInstances.length = 0;
    mockRequestProctoringStreams.mockResolvedValue(captureResources);
    mockCaptureTrackSnapshot.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    mockConnectCandidatePublisher.mockResolvedValue({ disconnect: mockDisconnectRoom });
    mockApiRequest.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
      if (path === "/api/v1/exams/1/start-session/" && options?.method === "POST") {
        return sessionPayload;
      }
      if (path === "/api/v1/proctoring/sessions/77/capability/" && options?.method === "POST") {
        return { id: 1 };
      }
      if (path === "/api/v1/proctoring/sessions/77/media/publish-token/" && options?.method === "POST") {
        return {
          provider: "livekit",
          server_url: "wss://127.0.0.1:7880",
          room_name: "eduexam-exam-1-session-77",
          participant_name: "candidate-2-session-77",
          access_token: "token",
          expires_at: "2026-03-23T08:15:00Z",
        };
      }
      if (path === "/api/v1/proctoring/sessions/77/media/status/" && options?.method === "POST") {
        const body = options.body as {
          webcam_publish_status?: string;
          screen_capture_status?: string;
          metadata?: Record<string, unknown>;
        };
        return {
          provider: "livekit",
          room_name: "eduexam-exam-1-session-77",
          participant_name: "candidate-2-session-77",
          webcam_publish_status: body?.webcam_publish_status ?? "idle",
          screen_capture_status: body?.screen_capture_status ?? "ready",
          webcam_publish_error: "",
          last_publish_at: "2026-03-23T08:00:00Z",
          last_status_at: "2026-03-23T08:00:00Z",
          metadata: body?.metadata ?? {},
        };
      }
      if (path === "/api/v1/proctoring/sessions/77/heartbeats/" && options?.method === "POST") {
        return { id: 1 };
      }
      if (path === "/api/v1/proctoring/sessions/77/events/" && options?.method === "POST") {
        return {
          id: 19,
          event_type: "fullscreen_exit",
          severity: "warning",
          metadata: {},
          occurred_at: "2026-03-23T08:01:00Z",
          case_ids: [1],
        };
      }
      if (path === "/api/v1/proctoring/sessions/77/evidence/" && options?.method === "POST") {
        return {
          id: 5,
          event: 19,
          evidence_type: "webcam_snapshot",
          metadata: {},
          captured_at: "2026-03-23T08:01:00Z",
          file_url: "/media/proctoring/evidence/1.png",
        };
      }
      if (path === "/api/v1/exam-sessions/77/autosave/" && options?.method === "POST") {
        return {
          id: 2,
          created_at: "2026-03-23T08:01:30Z",
        };
      }
      if (path === "/api/v1/exam-sessions/77/answers/301/" && options?.method === "PUT") {
        return {
          session_question: 301,
          selected_option_keys: ["A"],
          answer_text: "",
          is_answered: true,
          is_marked_for_review: false,
          updated_at: "2026-03-23T08:02:00Z",
        };
      }
      throw new Error(`Unhandled apiRequest path: ${path}`);
    });
  });

  it("blocks the candidate when webcam permission is denied", async () => {
    const user = userEvent.setup();
    mockRequestProctoringStreams.mockRejectedValueOnce(new Error("Webcam access is required."));

    renderTakeExam();

    await user.click(await screen.findByRole("button", { name: /start monitoring/i }));
    expect(await screen.findByText(/webcam access is required/i)).toBeInTheDocument();
  });

  it("binds the local webcam stream and keeps webcam publishing disabled until requested", async () => {
    const user = userEvent.setup();

    renderTakeExam();

    await user.click(await screen.findByRole("button", { name: /start monitoring/i }));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/api/v1/proctoring/sessions/77/media/status/",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(mockRequestFullscreen).toHaveBeenCalledTimes(1);
    expect(mockApiRequest).not.toHaveBeenCalledWith(
      "/api/v1/proctoring/sessions/77/media/publish-token/",
      expect.anything(),
    );
    const preview = (await screen.findByLabelText(/your webcam preview/i)) as HTMLVideoElement & {
      srcObject: unknown;
    };
    expect(preview).toBeInTheDocument();
    expect(preview.srcObject).toBe(captureResources.webcamStream);
  });

  it("publishes webcam only after an admin live request arrives over the control socket", async () => {
    const user = userEvent.setup();

    renderTakeExam();

    await user.click(await screen.findByRole("button", { name: /start monitoring/i }));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/api/v1/proctoring/sessions/77/media/status/",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(websocketInstances).toHaveLength(1);

    await act(async () => {
      websocketInstances[0].onmessage?.({
        data: JSON.stringify({
          type: "live_request",
          payload: { enabled: true },
        }),
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/api/v1/proctoring/sessions/77/media/publish-token/",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(mockConnectCandidatePublisher).toHaveBeenCalledTimes(1);
  });

  it("does not publish webcam when VPS is overloaded, falling back to local snapshots", async () => {
    const user = userEvent.setup();

    renderTakeExam();

    await user.click(await screen.findByRole("button", { name: /start monitoring/i }));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/api/v1/proctoring/sessions/77/media/status/",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(websocketInstances).toHaveLength(1);

    // Mock publish-token endpoint returning overloaded
    mockApiRequest.mockImplementationOnce(async (path: string, options?: { method?: string }) => {
      if (path === "/api/v1/proctoring/sessions/77/media/publish-token/" && options?.method === "POST") {
        return {
          vps_overloaded: true,
          provider: "",
          server_url: "",
          room_name: "",
          participant_name: "",
          access_token: "",
          expires_at: "",
        };
      }
      return { status: "success" };
    });

    // Reset calls to connect candidate publisher
    mockConnectCandidatePublisher.mockClear();

    await act(async () => {
      websocketInstances[0].onmessage?.({
        data: JSON.stringify({
          type: "live_request",
          payload: { enabled: true },
        }),
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/api/v1/proctoring/sessions/77/media/publish-token/",
        expect.objectContaining({ method: "POST" }),
      );
    });

    // Ensure we did NOT connect to the publisher
    expect(mockConnectCandidatePublisher).not.toHaveBeenCalled();

    // Verify it reports status with overloaded reason metadata
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/api/v1/proctoring/sessions/77/media/status/",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            webcam_publish_status: "idle",
            metadata: expect.objectContaining({
              reason: "vps_overloaded_fallback",
            }),
          }),
        }),
      );
    });
  });

  it("keeps the exam locked until fullscreen is restored after permissions are granted", async () => {
    const user = userEvent.setup();
    mockRequestFullscreen
      .mockRejectedValueOnce(new Error("Fullscreen mode is required to start this exam."))
      .mockImplementationOnce(async () => {
        Object.defineProperty(document, "fullscreenElement", {
          configurable: true,
          writable: true,
          value: document.documentElement,
        });
      });

    renderTakeExam();

    await user.click(await screen.findByRole("button", { name: /start monitoring/i }));

    expect(
      await screen.findByText(/click again to re-enter fullscreen and start the exam/i),
    ).toBeInTheDocument();
    expect(mockApiRequest).not.toHaveBeenCalledWith(
      "/api/v1/proctoring/sessions/77/media/publish-token/",
      expect.anything(),
    );

    await user.click(screen.getByRole("button", { name: /enter fullscreen and start exam/i }));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/api/v1/proctoring/sessions/77/media/status/",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText(/question 1 of 1/i)).toBeInTheDocument();
  });

  it("uploads webcam and screen evidence after a fullscreen violation", async () => {
    const user = userEvent.setup();
    renderTakeExam();

    await user.click(await screen.findByRole("button", { name: /start monitoring/i }));

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      writable: true,
      value: null,
    });

    await act(async () => {
      document.dispatchEvent(new Event("fullscreenchange"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/api/v1/proctoring/sessions/77/events/",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(mockSaveSnapshotLocally).toHaveBeenCalled();

    expect(mockNotifyWarning).toHaveBeenCalledWith(
      "A proctoring warning was recorded. Candidate exited fullscreen mode.",
    );
    expect(await screen.findByText("A proctoring warning was recorded.")).toBeInTheDocument();
    expect(screen.getByText("Candidate exited fullscreen mode.")).toBeInTheDocument();
  });

  it("updates the saved indicator without showing a success toast when selecting an answer", async () => {
    const user = userEvent.setup();

    renderTakeExam();

    await user.click(await screen.findByRole("button", { name: /start monitoring/i }));

    await user.click(screen.getByLabelText(/2/i));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/api/v1/exam-sessions/77/answers/301/",
        expect.objectContaining({ method: "PUT" }),
      );
    });

    expect(await screen.findByText(/saved/i)).toBeInTheDocument();
    expect(mockNotifySuccess).not.toHaveBeenCalledWith("Answer saved.");
  });

  it("renders the protected setup flow in Vietnamese when locale is vi", async () => {
    await i18n.changeLanguage("vi");
    const user = userEvent.setup();

    renderTakeExam();

    expect(await screen.findByText("Thiết lập bài thi có giám sát")).toBeInTheDocument();
    expect(screen.getByText("Các quyền được yêu cầu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cấp quyền và bắt đầu giám sát" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cấp quyền và bắt đầu giám sát" }));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/api/v1/proctoring/sessions/77/media/status/",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("displays a warning banner when save answer fails", async () => {
    const user = userEvent.setup();
    mockApiRequest.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
      if (path === "/api/v1/exams/1/start-session/" && options?.method === "POST") {
        return sessionPayload;
      }
      if (path === "/api/v1/proctoring/sessions/77/capability/" && options?.method === "POST") {
        return { id: 1 };
      }
      if (path === "/api/v1/proctoring/sessions/77/media/status/" && options?.method === "POST") {
        return { webcam_publish_status: "idle", screen_capture_status: "ready" };
      }
      if (path === "/api/v1/exam-sessions/77/answers/301/" && options?.method === "PUT") {
        throw new Error("503 Service Unavailable");
      }
      throw new Error(`Unhandled apiRequest path: ${path}`);
    });

    renderTakeExam();

    await user.click(await screen.findByRole("button", { name: /start monitoring/i }));
    await user.click(screen.getByLabelText(/2/i));

    await waitFor(() => {
      expect(screen.getByText(/server connection interrupted/i)).toBeInTheDocument();
    });
  });

  it("opens the backup modal when exam submission fails and allows copying/downloading backup answers", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
    mockApiRequest.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
      if (path === "/api/v1/exams/1/start-session/" && options?.method === "POST") {
        return sessionPayload;
      }
      if (path === "/api/v1/proctoring/sessions/77/capability/" && options?.method === "POST") {
        return { id: 1 };
      }
      if (path === "/api/v1/proctoring/sessions/77/media/status/" && options?.method === "POST") {
        return { webcam_publish_status: "idle", screen_capture_status: "ready" };
      }
      if (path === "/api/v1/exam-sessions/77/submit/" && options?.method === "POST") {
        throw new Error("500 Internal Server Error");
      }
      throw new Error(`Unhandled apiRequest path: ${path}`);
    });

    renderTakeExam();

    await user.click(await screen.findByRole("button", { name: /start monitoring/i }));
    await user.click(screen.getByRole("button", { name: /submit exam/i }));
    // Hop xac nhan liet ke cau chua lam truoc khi nop.
    expect(await screen.findByRole("button", { name: /question 1/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /submit anyway/i }));

    expect(await screen.findByText(/unable to submit exam to server/i)).toBeInTheDocument();
    expect(screen.getByText(/download the backup exam file/i)).toBeInTheDocument();

    const copyBtn = screen.getByRole("button", { name: /copy backup code/i });
    await user.click(copyBtn);
    expect(mockNotifySuccess).toHaveBeenCalledWith("Backup code copied to clipboard!");
  });

  const mockSessionTiming = (timing: { expiresInSeconds: number; deadlineInSeconds: number }) => {
    const defaultImplementation = mockApiRequest.getMockImplementation();
    const submitCalls: Array<{ body?: unknown }> = [];
    mockApiRequest.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
      if (path === "/api/v1/exams/1/start-session/" && options?.method === "POST") {
        return {
          ...sessionPayload,
          expires_at: new Date(Date.now() + timing.expiresInSeconds * 1000).toISOString(),
          submission_deadline: new Date(Date.now() + timing.deadlineInSeconds * 1000).toISOString(),
          submission_grace_seconds: 300,
          remaining_seconds: Math.max(0, timing.expiresInSeconds),
        };
      }
      if (path === "/api/v1/exam-sessions/77/submit/" && options?.method === "POST") {
        submitCalls.push({ body: options.body });
        return {
          id: 77,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          objective_score: "0.00",
          max_score: "1.00",
          manual_grading_required: false,
          is_late: timing.deadlineInSeconds <= 0,
        };
      }
      return defaultImplementation?.(path, options);
    });
    return submitCalls;
  };

  it("locks the exam behind a submit-only countdown once time is up", async () => {
    const user = userEvent.setup();
    const submitCalls = mockSessionTiming({ expiresInSeconds: -10, deadlineInSeconds: 290 });

    renderTakeExam();

    expect(await screen.findByRole("dialog", { name: /time is up/i })).toBeInTheDocument();
    expect(screen.getByText(/1 unanswered question\(s\) will be marked as incorrect/i)).toBeInTheDocument();
    expect(screen.getByText(/^0:04:[45]\d$/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /submit now/i }));

    expect(await screen.findByText(/exam submitted/i)).toBeInTheDocument();
    expect(submitCalls).toHaveLength(1);
    expect(submitCalls[0].body).toBeUndefined();
  });

  it("auto-submits as late when the grace period has ended", async () => {
    const submitCalls = mockSessionTiming({ expiresInSeconds: -400, deadlineInSeconds: -100 });

    renderTakeExam();

    await waitFor(() => expect(submitCalls).toHaveLength(1));
    expect(submitCalls[0].body).toEqual({ auto_submit: true });
    expect(await screen.findByText(/recorded as a late submission/i)).toBeInTheDocument();
  });

  it("lists unanswered questions before submitting and lets the candidate jump back", async () => {
    const user = userEvent.setup();
    const submitCalls = mockSessionTiming({ expiresInSeconds: 1800, deadlineInSeconds: 2100 });

    renderTakeExam();

    await user.click(await screen.findByRole("button", { name: /start monitoring/i }));
    await user.click(await screen.findByRole("button", { name: /submit exam/i }));

    const dialog = await screen.findByRole("dialog", { name: /submit/i });
    expect(dialog).toHaveTextContent(/1 unanswered question/i);
    await user.click(screen.getByRole("button", { name: /^question 1$/i }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: /submit/i })).not.toBeInTheDocument());
    expect(submitCalls).toHaveLength(0);
  });
});
