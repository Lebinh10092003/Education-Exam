import { useTranslation } from "react-i18next";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, RefreshCw, Wifi } from "lucide-react";

import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
import type { ConnectionStatus, ViolationNotice } from "./types";
import { formatDateTime, formatTime, normalizeCandidateLocale } from "./utils";

type ExamHeaderProps = {
  examName: string;
  currentIndex: number;
  totalQuestions: number;
  attemptNumber: number;
  connectionStatus: ConnectionStatus;
  pendingSyncCount: number;
  lastSavedAt: string | null;
  timeRemaining: number;
  locale: string;
  isSubmitting: boolean;
  onSubmit: () => void;
};

export function ExamHeader({
  examName,
  currentIndex,
  totalQuestions,
  attemptNumber,
  connectionStatus,
  pendingSyncCount,
  lastSavedAt,
  timeRemaining,
  locale,
  isSubmitting,
  onSubmit,
}: ExamHeaderProps) {
  const { t } = useTranslation("common");
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-bold text-lg text-gray-900">{examName}</h1>
          <p className="text-sm text-gray-600">
            {t("examSession.questionAttemptLine", {
              current: currentIndex + 1,
              total: totalQuestions,
              attempt: attemptNumber,
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <div className="flex min-w-[8rem] items-center gap-2">
            <Wifi
              className={`w-4 h-4 ${
                connectionStatus === "stable"
                  ? "text-green-600"
                  : connectionStatus === "offline"
                    ? "text-red-600"
                    : "text-yellow-600"
              }`}
            />
            <span className="text-sm text-gray-600 capitalize">{t(`examSession.connection.${connectionStatus}`)}</span>
          </div>

          <div className="flex min-w-[10rem] items-center gap-2">
            <CheckCircle2 className={`w-4 h-4 ${pendingSyncCount > 0 ? "text-amber-500 animate-pulse" : lastSavedAt ? "text-green-600" : "text-gray-400"}`} />
            <span className="text-sm text-gray-600">
              {pendingSyncCount > 0
                ? t("examSession.syncStatus", { count: pendingSyncCount })
                : lastSavedAt
                  ? t("examSession.savedAt", {
                      time: new Date(lastSavedAt).toLocaleTimeString(normalizeCandidateLocale(locale)),
                    })
                  : t("examSession.autosavePending")}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="font-mono font-semibold text-blue-900">{formatTime(timeRemaining)}</span>
          </div>

          <Button className="w-full sm:w-auto" onClick={onSubmit} disabled={isSubmitting}>
            {t("examSession.submitExam")}
          </Button>
        </div>
      </div>
    </header>
  );
}

type SyncErrorBannerProps = {
  pendingSyncCount: number;
  isSyncing: boolean;
  onSync: () => void;
};

export function SyncErrorBanner({ pendingSyncCount, isSyncing, onSync }: SyncErrorBannerProps) {
  const { t } = useTranslation("common");
  return (
    <div className="mx-auto max-w-7xl mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-semibold text-amber-950 leading-relaxed">
              {t("examSession.syncErrorBanner")}
            </p>
            {pendingSyncCount > 0 && (
              <p className="mt-1 text-sm text-amber-800">
                {t("examSession.syncStatus", { count: pendingSyncCount })}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="self-start sm:self-center shrink-0 border-amber-300 hover:bg-amber-100 hover:text-amber-950 gap-2 font-medium bg-white"
          onClick={onSync}
          disabled={isSyncing}
        >
          <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          {isSyncing ? t("examSession.syncingNow") : t("examSession.syncNow")}
        </Button>
      </div>
    </div>
  );
}

export function ViolationNoticeBanner({ notice, locale }: { notice: ViolationNotice; locale: string }) {
  const { t } = useTranslation("common");
  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-4 text-sm ${
        notice.severity === "critical"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">
            {notice.severity === "critical"
              ? t("examSession.criticalAlertRecorded")
              : t("examSession.warningAlertRecorded")}
          </p>
          <p className="mt-1">{notice.message}</p>
          <p className="mt-2 text-xs opacity-80">
            {t("examSession.recordedAt", {
              time: formatDateTime(notice.occurredAt, locale),
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
