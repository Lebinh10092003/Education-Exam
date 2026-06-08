import { buildApiUrl } from "../lib/env";
import i18n from "../i18n";
import { translateLegacyUiText } from "../i18n/legacyUiFallback";
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

const resolveDateLocale = () => (i18n.language?.startsWith("vi") ? "vi-VN" : "en-GB");
const resolveLegacyLocale = () => (i18n.language?.startsWith("vi") ? "vi" : "en");

export const formatDisciplineDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(resolveDateLocale(), {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";

export const formatCertificateLevel = (value: string | null | undefined) => {
  switch (value) {
    case "gold":
      return i18n.t("common:discipline.certificateLevels.gold");
    case "silver":
      return i18n.t("common:discipline.certificateLevels.silver");
    case "bronze":
      return i18n.t("common:discipline.certificateLevels.bronze");
    case "encouragement":
      return i18n.t("common:discipline.certificateLevels.encouragement");
    case "participation":
      return i18n.t("common:discipline.certificateLevels.participation");
    default:
      return i18n.t("common:discipline.certificateLevels.unknown");
  }
};

export const formatReviewStatus = (value: string) => {
  switch (value) {
    case "penalty_applied":
      return i18n.t("common:discipline.reviewStatus.penalty_applied");
    case "reviewed":
      return i18n.t("common:discipline.reviewStatus.reviewed");
    case "clear":
      return i18n.t("common:discipline.reviewStatus.clear");
    default:
      return i18n.t("common:discipline.reviewStatus.pending_review");
  }
};

export const formatResultSyncStatus = (value: string) => {
  switch (value) {
    case "synced":
      return i18n.t("common:discipline.resultSyncStatus.synced");
    default:
      return i18n.t("common:discipline.resultSyncStatus.pending");
  }
};

export const formatCertificateStatus = (value: string) => {
  switch (value) {
    case "configured":
      return i18n.t("common:discipline.certificateStatus.configured");
    default:
      return i18n.t("common:discipline.certificateStatus.not_configured");
  }
};

export const formatProposalStatus = (value: string | null | undefined) => {
  switch (value) {
    case "draft":
      return i18n.t("common:discipline.proposalStatus.draft");
    case "approved":
      return i18n.t("common:discipline.proposalStatus.approved");
    case "rejected":
      return i18n.t("common:discipline.proposalStatus.rejected");
    case "no_penalty":
      return i18n.t("common:discipline.proposalStatus.no_penalty");
    default:
      return i18n.t("common:discipline.proposalStatus.unknown");
  }
};

export const formatSeverity = (value: string) => {
  switch (value) {
    case "critical":
      return i18n.t("common:discipline.severity.critical");
    case "info":
      return i18n.t("common:discipline.severity.info");
    default:
      return i18n.t("common:discipline.severity.warning");
  }
};

export const formatDisciplineCaseText = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }
  return translateLegacyUiText(resolveLegacyLocale(), value);
};

const summarizeErrorPayload = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { detail?: string } | null;
    return payload?.detail || i18n.t("common:discipline.exportFailedStatus", { status: response.status });
  }
  const text = await response.text();
  return text.trim() || i18n.t("common:discipline.exportFailedStatus", { status: response.status });
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
  }, 100);
};
