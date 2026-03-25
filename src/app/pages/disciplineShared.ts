import { buildApiUrl } from "../lib/env";
import { getStoredLocale, getStoredTokens } from "../lib/storage";

export interface DisciplinaryExamSummaryRecord {
  id: number;
  name: string;
  subject_name: string;
  unique_violating_candidates: number;
  total_cases: number;
  approved_records: number;
  pending_review_count: number;
  result_sync_status: string;
  certificate_status: string;
  last_updated: string | null;
}

export interface DisciplinaryCandidateRecord {
  id: number;
  exam: {
    id: number;
    name: string;
    subject_name: string;
  };
  candidate: {
    id: number;
    email: string;
    full_name: string;
  };
  selected_session: number | null;
  unique_case_count: number;
  open_case_count: number;
  approved_case_count: number;
  original_total_score: string;
  original_percentage: string;
  applied_penalty_percent: string;
  final_total_score: string;
  final_percentage: string;
  certificate_level_snapshot: string;
  review_status: string;
  published_score_synced_at: string | null;
  updated_at: string;
}

export interface PenaltyProposalRecord {
  proposed_penalty_percent: string;
  status: string;
  notes: string;
  proposed_by: {
    id: number;
    email: string;
    full_name: string;
  } | null;
  proposed_at: string | null;
  approved_by: {
    id: number;
    email: string;
    full_name: string;
  } | null;
  approved_at: string | null;
}

export interface DisciplinaryCaseRecord {
  id: number;
  session_id: number;
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
  created_at: string;
  evidence_count: number;
  proposal: PenaltyProposalRecord | null;
}

export interface CertificatePolicyRecord {
  mode: string;
  gold_config: Record<string, string | number>;
  silver_config: Record<string, string | number>;
  bronze_config: Record<string, string | number>;
  encouragement_config: Record<string, string | number>;
}

export const formatDisciplineDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";

export const formatCertificateLevel = (value: string | null | undefined) => {
  switch (value) {
    case "gold":
      return "Gold";
    case "silver":
      return "Silver";
    case "bronze":
      return "Bronze";
    case "encouragement":
      return "Encouragement";
    case "participation":
      return "Participation";
    default:
      return "-";
  }
};

export const formatReviewStatus = (value: string) => {
  switch (value) {
    case "penalty_applied":
      return "Penalty Applied";
    case "reviewed":
      return "Reviewed";
    case "clear":
      return "Clear";
    default:
      return "Pending Review";
  }
};

const summarizeErrorPayload = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { detail?: string } | null;
    return payload?.detail || `Export failed with status ${response.status}`;
  }
  const text = await response.text();
  return text.trim() || `Export failed with status ${response.status}`;
};

export const downloadDisciplineWorkbook = async (path: string, fileName: string) => {
  const tokens = getStoredTokens();
  const response = await fetch(new URL(buildApiUrl(path), window.location.origin), {
    headers: {
      "Accept-Language": getStoredLocale(),
      ...(tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(await summarizeErrorPayload(response));
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(downloadUrl);
  }, 0);
};
