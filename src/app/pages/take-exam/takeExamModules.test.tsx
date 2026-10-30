import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildBackupJson, buildBackupText } from "./backup";
import { useExamShortcuts } from "./hooks";
import type { CandidateSession, SessionQuestion } from "./types";
import { applySubmission, formatTime, parseLiveRequestEnabled } from "./utils";

const draftStore = vi.hoisted(() => ({ value: null as unknown }));

vi.mock("../../lib/snapshotStore", () => ({
  getExamDraft: vi.fn(async () => draftStore.value),
  saveExamDraft: vi.fn(),
  clearExamDraft: vi.fn(),
}));
vi.mock("../../lib/http", () => ({ apiRequest: vi.fn() }));

const question = (id: number, overrides: Partial<SessionQuestion> = {}): SessionQuestion => ({
  id,
  sort_order: id,
  points: "1",
  question_text: `Q${id}`,
  question_type: "single_choice",
  difficulty: "easy",
  options: [],
  selected_option_keys: [],
  answer_text: "",
  is_answered: false,
  is_marked_for_review: false,
  ...overrides,
});

const session = {
  id: 7,
  exam_id: 3,
  exam_name: "Toan 10",
  attempt_number: 1,
  status: "in_progress",
  is_late: false,
  questions: [question(1, { selected_option_keys: ["A"] }), question(2, { question_type: "essay", answer_text: "x" })],
} as unknown as CandidateSession;

describe("take-exam utils", () => {
  it("formats remaining time and clamps negatives", () => {
    expect(formatTime(3725)).toBe("1:02:05");
    expect(formatTime(-5)).toBe("0:00:00");
  });

  it("parses live request flags from the control socket", () => {
    expect(parseLiveRequestEnabled(true)).toBe(true);
    expect(parseLiveRequestEnabled("1")).toBe(true);
    expect(parseLiveRequestEnabled("false")).toBe(false);
    expect(parseLiveRequestEnabled(undefined)).toBe(false);
  });

  it("merges a submission into the session and keeps is_late when absent", () => {
    const next = applySubmission({ ...session, is_late: true }, {
      id: 1,
      status: "submitted",
      submitted_at: "2026-01-01T00:00:00Z",
      objective_score: "5",
      max_score: "10",
      manual_grading_required: false,
    });
    expect(next?.status).toBe("submitted");
    expect(next?.is_late).toBe(true);
    expect(applySubmission(null, {} as never)).toBeNull();
  });
});

describe("take-exam backup", () => {
  it("builds a JSON backup with a checksum and a readable text summary", () => {
    const json = buildBackupJson(session, 3);
    expect(json.answers).toHaveLength(2);
    expect(json.tamper_proof_checksum).toMatch(/^[0-9A-F]+$/);

    const text = buildBackupText(session, 3);
    expect(text).toContain("Q1: A");
    expect(text).toContain("Q2: x");
  });
});

describe("take-exam local draft", () => {
  beforeEach(() => {
    localStorage.clear();
    draftStore.value = null;
  });

  it("restores unsynced answers from IndexedDB and the LocalStorage fallback", async () => {
    const { mergeLocalDraftAnswers } = await import("./localDraft");
    draftStore.value = { sessionId: 7, answers: { "1": { selected_option_keys: ["C"] } }, version: 1, timestamp: 0 };
    localStorage.setItem(
      "eduexam_pending_sync_7",
      JSON.stringify({ "2": { payload: { answer_text: "offline essay", is_marked_for_review: true } } }),
    );

    const merged = await mergeLocalDraftAnswers(7, [question(1), question(2), question(3)]);

    expect(merged[0]).toMatchObject({ selected_option_keys: ["C"], is_answered: true });
    expect(merged[1]).toMatchObject({ answer_text: "offline essay", is_marked_for_review: true, is_answered: true });
    expect(merged[2].is_answered).toBe(false);
  });
});

describe("useExamShortcuts", () => {
  const press = (key: string, altKey = true) =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key, altKey }));

  afterEach(() => vi.clearAllMocks());

  it("maps Alt shortcuts to navigation and flag actions", () => {
    const handlers = { onPrevious: vi.fn(), onNext: vi.fn(), onToggleFlag: vi.fn() };
    renderHook(() => useExamShortcuts(true, { current: false }, handlers));

    press("ArrowLeft");
    press("n");
    press("F");
    press("n", false);

    expect(handlers.onPrevious).toHaveBeenCalledTimes(1);
    expect(handlers.onNext).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleFlag).toHaveBeenCalledTimes(1);
  });

  it("ignores shortcuts after time is up or when disabled", () => {
    const handlers = { onPrevious: vi.fn(), onNext: vi.fn(), onToggleFlag: vi.fn() };
    const { rerender } = renderHook(({ enabled }) => useExamShortcuts(enabled, { current: true }, handlers), {
      initialProps: { enabled: true },
    });
    press("ArrowRight");
    rerender({ enabled: false });
    press("ArrowRight");
    expect(handlers.onNext).not.toHaveBeenCalled();
  });
});
