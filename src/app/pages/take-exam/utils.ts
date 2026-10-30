import type { CandidateSession, ConnectionStatus, NavigatorConnectionInfo, SubmissionSummary } from "./types";

export const HEARTBEAT_INTERVAL_MS = 60_000;
export const AUTOSAVE_INTERVAL_MS = 120_000;
export const ESSAY_AUTOSAVE_DELAY_MS = 25_000;
const DEGRADED_CONNECTION_RTT_MS = 1_500;
// Cung loai vi pham lap lai trong khoang nay chi gui 1 lan (backend cung gop tuong tu).
export const VIOLATION_COOLDOWN_MS = 5_000;
// Rai thoi diem upload anh bang chung sau khi nop bai de tranh don tai luc het gio.
const EVIDENCE_UPLOAD_MIN_DELAY_MS = 2_000;
const EVIDENCE_UPLOAD_MAX_DELAY_MS = 15_000;

export const getEvidenceUploadDelayMs = () =>
  EVIDENCE_UPLOAD_MIN_DELAY_MS +
  Math.floor(Math.random() * (EVIDENCE_UPLOAD_MAX_DELAY_MS - EVIDENCE_UPLOAD_MIN_DELAY_MS));

export const formatTime = (seconds: number) => {
  const clampedSeconds = Math.max(0, seconds);
  const hours = Math.floor(clampedSeconds / 3600);
  const minutes = Math.floor((clampedSeconds % 3600) / 60);
  const secs = clampedSeconds % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const normalizeCandidateLocale = (locale: string) => (locale.toLowerCase().startsWith("vi") ? "vi-VN" : "en-GB");

export const formatDateTime = (value: string, locale: string) =>
  new Intl.DateTimeFormat(normalizeCandidateLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export const assignPreviewStream = (element: HTMLVideoElement | null, stream: MediaStream | null) => {
  if (!element) {
    return;
  }
  (element as HTMLVideoElement & { srcObject?: MediaStream | null }).srcObject = stream;
};

export const getNavigatorConnectionInfo = () =>
  (navigator as Navigator & { connection?: NavigatorConnectionInfo }).connection;

export const getCandidateConnectionStatus = (failedHeartbeatCount: number): ConnectionStatus => {
  if (!navigator.onLine) {
    return "offline";
  }

  if (failedHeartbeatCount > 0) {
    return "unstable";
  }

  const connectionInfo = getNavigatorConnectionInfo();
  if (
    connectionInfo?.effectiveType === "slow-2g"
    || connectionInfo?.effectiveType === "2g"
    || (typeof connectionInfo?.rtt === "number" && connectionInfo.rtt >= DEGRADED_CONNECTION_RTT_MS)
  ) {
    return "unstable";
  }

  return "stable";
};

export const parseLiveRequestEnabled = (value: boolean | string | undefined) =>
  value === true || value === "1" || value === "true";

/** Gop ket qua nop bai vao phien hien tai (dung chung cho nop lan dau va nop lai). */
export const applySubmission = (
  current: CandidateSession | null,
  response: SubmissionSummary,
): CandidateSession | null =>
  current
    ? {
        ...current,
        status: response.status,
        submitted_at: response.submitted_at,
        objective_score: response.objective_score,
        max_score: response.max_score,
        manual_grading_required: response.manual_grading_required,
        is_late: response.is_late ?? current.is_late,
      }
    : current;
