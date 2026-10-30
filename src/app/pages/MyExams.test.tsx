import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../i18n";
import { ExamInstructions } from "./ExamInstructions";
import { MyExams } from "./MyExams";

const mockApiRequest = vi.fn();
const now = Date.now();

vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

const examRecord = {
  id: 1,
  name: "Mathematics Final Exam",
  description: "Comprehensive final assessment.",
  status: "scheduled",
  duration_minutes: 120,
  passing_score: "60",
  max_attempts: 1,
  question_count: 50,
  enable_proctoring: true,
  attempts_used: 0,
  attempts_remaining: 1,
  active_session_id: null,
  subject: {
    id: 1,
    name: "Mathematics",
    code: "MATH101",
    color: "#2563eb",
  },
  schedule: {
    opens_at: new Date(now - 60 * 60 * 1000).toISOString(),
    closes_at: new Date(now + 60 * 60 * 1000).toISOString(),
  },
};

const buildPaginated = <T,>(results: T[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

describe("student exam flows", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(async () => {
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/api/v1/my-exams/") {
        return buildPaginated([examRecord]);
      }

      throw new Error(`Unhandled apiRequest path: ${path}`);
    });
    await i18n.changeLanguage("en");

    // Mock browser APIs for automated system checks
    Object.defineProperty(navigator, 'storage', {
      value: {
        estimate: () => Promise.resolve({ quota: 500 * 1024 * 1024, usage: 0 })
      },
      writable: true,
      configurable: true
    });

    Object.defineProperty(window, 'indexedDB', {
      value: {},
      writable: true,
      configurable: true
    });
    
    Object.defineProperty(window, 'Worker', {
      value: class {
        onmessage: any = null;
        onerror: any = null;
        postMessage() {
          setTimeout(() => {
            if (this.onmessage) this.onmessage({ data: 'pong' });
          }, 10);
        }
        terminate() {}
      },
      writable: true,
      configurable: true
    });
    
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () => Promise.resolve({
          getVideoTracks: () => [{ stop: () => {}, readyState: 'live' }],
          getAudioTracks: () => [{ stop: () => {}, readyState: 'live' }],
          getTracks: () => [{ stop: () => {} }]
        }),
        getDisplayMedia: () => Promise.resolve({
          getVideoTracks: () => [{ stop: () => {}, readyState: 'live' }],
          getTracks: () => [{ stop: () => {} }]
        })
      },
      writable: true,
      configurable: true
    });

    Object.defineProperty(HTMLVideoElement.prototype, 'play', {
      value: function() {
        setTimeout(() => {
          if (this.onloadedmetadata) this.onloadedmetadata();
        }, 10);
        return Promise.resolve();
      },
      writable: true,
      configurable: true
    });

    Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', {
      set(val) {
        this._srcObject = val;
        setTimeout(() => {
          if (this.onloadedmetadata) this.onloadedmetadata();
        }, 10);
      },
      get() {
        return this._srcObject;
      },
      configurable: true
    });

    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      value: function(callback: any) {
        callback(new Blob(['fake-blob-bytes'], { type: 'image/jpeg' }));
      },
      writable: true,
      configurable: true
    });
  });

  it("renders assigned exams and links available exams to the instructions route", async () => {
    render(
      <MemoryRouter>
        <MyExams />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Mathematics Final Exam")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start exam/i })).toHaveAttribute(
      "href",
      "/candidate/exams/1/instructions",
    );
  });

  it("loads the instructions page from the fallback exam list and enables launch after checklist confirmation", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/candidate/exams/1/instructions"]}>
        <Routes>
          <Route path="/candidate/exams/:id/instructions" element={<ExamInstructions />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: /^start exam$/i })).toBeDisabled();

    // Click Run Check button and wait for it to pass
    const checkButton = screen.getByRole("button", { name: /run check/i });
    await user.click(checkButton);
    await screen.findByText("System Ready");

    const checkboxes = screen.getAllByRole("checkbox");
    for (const checkbox of checkboxes) {
      await user.click(checkbox);
    }

    expect(screen.getByRole("button", { name: /^start exam$/i })).toBeEnabled();
  });

  it("renders the exam instructions flow in Vietnamese when locale is vi", async () => {
    await i18n.changeLanguage("vi");

    render(
      <MemoryRouter initialEntries={["/candidate/exams/1/instructions"]}>
        <Routes>
          <Route path="/candidate/exams/:id/instructions" element={<ExamInstructions />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Kiểm tra sẵn sàng")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quay lại bài thi của tôi" })).toBeInTheDocument();
    expect(screen.getByText("Tóm tắt khởi chạy")).toBeInTheDocument();
    expect(screen.getByText("Hoàn tất checklist để bật nút vào bài thi cuối cùng.")).toBeInTheDocument();
  });
});
