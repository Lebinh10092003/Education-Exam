export interface CandidateMonitoringStatus {
  session_id: number | null;
  candidate: {
    id: number;
    email: string;
    full_name: string;
  };
  status: string;
  progress_percentage: number;
  questions_answered: number;
  total_questions: number;
  time_elapsed_minutes: number;
  connection_status: string;
  last_activity_at: string | null;
  media: {
    webcam_publish_status: string;
    screen_capture_status: string;
    last_publish_at: string | null;
  };
}

export interface MonitoringSnapshot {
  exam: {
    id: number;
    name: string;
    subject_name: string;
  };
  total_candidates: number;
  in_progress: number;
  completed: number;
  not_started: number;
  average_progress: number;
  candidate_statuses: CandidateMonitoringStatus[];
  alerts: MonitoringAlertRecord[];
}

export interface MonitoringAlertRecord {
  id: number;
  session_id: number;
  candidate: {
    id: number;
    email: string;
    full_name: string;
  };
  event_type: string;
  severity: string;
  message: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
  case_id: number | null;
}

export interface ProctoredExamDetail {
  id: number;
  status: string;
  enable_proctoring?: boolean;
}

export interface ViolationEvidencePreview {
  id: number;
  evidence_type: string;
  file_url: string;
  captured_at: string;
  deleted_at: string | null;
}

export interface ViolationCaseRecord {
  id: number;
  session: number;
  candidate: {
    id: number;
    email: string;
    full_name: string;
  };
  exam: {
    id: number;
    name: string;
    subject_name: string;
  };
  severity: string;
  status: string;
  title: string;
  summary: string;
  event_ids: number[];
  evidence_ids: number[];
  evidence_items: ViolationEvidencePreview[];
  resolved_at: string | null;
  resolution_notes: string;
}

export interface LiveViewState {
  sessionId: number;
  candidateName: string;
  roomName: string;
  participantName: string;
  status: "connecting" | "open" | "error";
  error: string | null;
}

export type MonitoringWorkspaceTab =
  | "overview"
  | "live-alerts"
  | "candidate-status"
  | "violation-history";

export const MONITORING_TABS: MonitoringWorkspaceTab[] = [
  "overview",
  "live-alerts",
  "candidate-status",
  "violation-history",
];

export const ALERTS_PAGE_SIZE = 8;
export const CANDIDATES_PAGE_SIZE = 8;
export const HISTORY_PAGE_SIZE = 10;

export const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "-";

export const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) {
    return `${remainingMinutes}m`;
  }
  return `${hours}h ${remainingMinutes}m`;
};

export const formatEvidenceLabel = (evidenceType: string) =>
  evidenceType === "webcam_snapshot" ? "Webcam evidence" : "Screen evidence";

export const getWebcamStatusText = (status: string) => {
  switch (status) {
    case "publishing":
      return "Webcam live available";
    case "failed":
      return "Webcam live failed";
    case "stopped":
      return "Webcam live stopped";
    default:
      return "Webcam live unavailable";
  }
};

export const getScreenStatusText = (status: string) => {
  switch (status) {
    case "ready":
      return "Screen evidence ready";
    case "revoked":
      return "Screen evidence revoked";
    case "failed":
      return "Screen evidence failed";
    default:
      return "Screen evidence unavailable";
  }
};

export const clampPage = (page: number, totalPages: number) => {
  if (totalPages <= 0) {
    return 1;
  }
  return Math.min(Math.max(page, 1), totalPages);
};

export const paginateItems = <TItem,>(items: TItem[], page: number, pageSize: number) => {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = clampPage(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  return {
    page: safePage,
    totalPages,
    totalItems: items.length,
    items: items.slice(startIndex, endIndex),
  };
};

const includesSearch = (haystack: string, search: string) =>
  haystack.toLowerCase().includes(search.trim().toLowerCase());

export const filterAlerts = (
  alerts: MonitoringAlertRecord[],
  filters: {
    search: string;
    severity: string;
  },
) => {
  const search = filters.search.trim().toLowerCase();
  return alerts.filter((alert) => {
    if (filters.severity !== "all" && alert.severity !== filters.severity) {
      return false;
    }
    if (!search) {
      return true;
    }
    return (
      includesSearch(alert.candidate.full_name, search) ||
      includesSearch(alert.candidate.email, search) ||
      includesSearch(alert.message, search) ||
      includesSearch(alert.event_type.replaceAll("_", " "), search)
    );
  });
};

export const filterCandidateStatuses = (
  candidates: CandidateMonitoringStatus[],
  filters: {
    search: string;
    status: string;
    connection: string;
    webcam: string;
  },
) => {
  const search = filters.search.trim().toLowerCase();
  return candidates.filter((candidateStatus) => {
    if (filters.status !== "all" && candidateStatus.status !== filters.status) {
      return false;
    }
    if (
      filters.connection !== "all" &&
      candidateStatus.connection_status !== filters.connection
    ) {
      return false;
    }
    if (filters.webcam !== "all") {
      const expectsLive = filters.webcam === "publishing";
      if ((candidateStatus.media.webcam_publish_status === "publishing") !== expectsLive) {
        return false;
      }
    }
    if (!search) {
      return true;
    }
    return (
      includesSearch(candidateStatus.candidate.full_name, search) ||
      includesSearch(candidateStatus.candidate.email, search)
    );
  });
};

export const parsePositiveInt = (value: string | null) => {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const parseMonitoringTab = (value: string | null): MonitoringWorkspaceTab => {
  if (value && MONITORING_TABS.includes(value as MonitoringWorkspaceTab)) {
    return value as MonitoringWorkspaceTab;
  }
  return "overview";
};

