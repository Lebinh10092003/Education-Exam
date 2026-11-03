import { describe, expect, it } from "vitest";

import { canLaunchExam, getExamAvailabilityState, getExamPrimaryAction, type CandidateAssignedExam } from "./candidateExamShared";

const now = new Date("2026-11-03T08:00:00Z");

const buildExam = (overrides: Partial<CandidateAssignedExam> = {}): CandidateAssignedExam => ({
  id: 4,
  name: "Ôn tập Sinh học",
  description: "",
  status: "open",
  duration_minutes: 40,
  passing_score: "70",
  max_attempts: 1,
  question_count: 3,
  enable_proctoring: false,
  lifecycle_phase: "open",
  attempts_used: 0,
  attempts_remaining: 1,
  active_session_id: null,
  subject: { id: 1, name: "Sinh học", code: "BIO", color: "#16a34a" },
  // Khung gio van con mo tai thoi diem `now`.
  schedule: { opens_at: "2026-11-01T07:40:00Z", closes_at: "2026-11-04T07:40:00Z" },
  ...overrides,
});

describe("getExamAvailabilityState", () => {
  it("is available while the backend phase is open inside the schedule window", () => {
    expect(getExamAvailabilityState(buildExam(), now)).toBe("available");
    expect(canLaunchExam(buildExam(), now)).toBe(true);
  });

  it("treats an exam closed early by staff as closed even if the window is still open", () => {
    for (const phase of ["closed", "results"]) {
      const exam = buildExam({ status: "closed", lifecycle_phase: phase });
      expect(getExamAvailabilityState(exam, now)).toBe("closed");
      expect(canLaunchExam(exam, now)).toBe(false);
      expect(getExamPrimaryAction(exam, { locale: "vi", now }).label).toBe("Xem chi tiết");
    }
  });

  it("shows paused exams as paused and does not allow starting them", () => {
    const exam = buildExam({ status: "paused", lifecycle_phase: "paused" });
    expect(getExamAvailabilityState(exam, now)).toBe("paused");
    expect(canLaunchExam(exam, now)).toBe(false);
  });

  it("treats a scheduled exam without an open time as upcoming", () => {
    const exam = buildExam({ status: "scheduled", lifecycle_phase: "scheduled", schedule: { opens_at: null, closes_at: null } });
    expect(getExamAvailabilityState(exam, now)).toBe("upcoming");
  });

  it("still lets candidates resume an active session", () => {
    const exam = buildExam({ status: "closed", lifecycle_phase: "closed", active_session_id: 12 });
    expect(getExamAvailabilityState(exam, now)).toBe("resume");
  });

  it("falls back to the schedule window when the phase is missing", () => {
    const exam = buildExam({ lifecycle_phase: undefined, schedule: { opens_at: null, closes_at: "2026-11-02T00:00:00Z" } });
    expect(getExamAvailabilityState(exam, now)).toBe("closed");
  });
});
