import { buildApiUrl } from "../lib/env";
import { getStoredLocale, getStoredTokens } from "../lib/storage";

interface ExportViolationHistoryOptions {
  examId: number;
  status?: string;
  severity?: string;
  search?: string;
}

const summarizeErrorPayload = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { detail?: string } | null;
    return payload?.detail || `Export failed with status ${response.status}`;
  }
  const text = await response.text();
  return text.trim() || `Export failed with status ${response.status}`;
};

export const exportViolationHistoryExcel = async ({
  examId,
  search,
  severity,
  status,
}: ExportViolationHistoryOptions) => {
  const tokens = getStoredTokens();
  const url = new URL(buildApiUrl("/api/v1/proctoring/cases/export/"), window.location.origin);
  url.searchParams.set("exam", String(examId));
  if (status && status !== "all") {
    url.searchParams.set("status", status);
  }
  if (severity && severity !== "all") {
    url.searchParams.set("severity", severity);
  }
  if (search?.trim()) {
    url.searchParams.set("search", search.trim());
  }

  const response = await fetch(url, {
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
  link.download = `eduexam-violation-history-exam-${examId}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(downloadUrl);
  }, 100);
};

