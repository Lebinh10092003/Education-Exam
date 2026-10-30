import { useTranslation } from "react-i18next";
import { AlertCircle, AlertTriangle, Clock, Copy, Download, RefreshCw } from "lucide-react";

import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
import { formatTime } from "./utils";

export function FullscreenExitOverlay({ onReturn }: { onReturn: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="text-center p-8 bg-white rounded-xl max-w-md mx-auto shadow-2xl relative">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Đã thoát toàn màn hình</h2>
        <p className="text-slate-600 mb-6">
          Hệ thống giám sát yêu cầu bạn phải làm bài ở chế độ toàn màn hình. Vui lòng quay lại toàn màn hình để tiếp tục làm bài thi.
        </p>
        <Button onClick={onReturn} size="lg" className="w-full text-base py-6">
          Quay lại toàn màn hình
        </Button>
      </div>
    </div>
  );
}

type TimeUpDialogProps = {
  graceSeconds: number;
  graceRemaining: number | null;
  answeredCount: number;
  totalQuestions: number;
  unansweredCount: number;
  isSubmitting: boolean;
  onSubmit: () => void;
};

export function TimeUpDialog({
  graceSeconds,
  graceRemaining,
  answeredCount,
  totalQuestions,
  unansweredCount,
  isSubmitting,
  onSubmit,
}: TimeUpDialogProps) {
  const { t } = useTranslation("common");
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="time-up-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <Clock className="h-7 w-7 text-red-600" />
        </div>
        <h2 id="time-up-title" className="text-2xl font-bold text-slate-900">
          {t("examSession.timeUpTitle")}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {t("examSession.timeUpDescription", {
            minutes: Math.max(1, Math.round(graceSeconds / 60)),
          })}
        </p>
        <p className="mt-6 text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("examSession.timeUpCountdownLabel")}
        </p>
        <p
          className={cn(
            "mt-1 font-mono text-5xl font-bold tabular-nums",
            (graceRemaining ?? 0) <= 60 ? "text-red-600" : "text-slate-900",
          )}
          aria-live="polite"
        >
          {formatTime(graceRemaining ?? 0)}
        </p>
        <p className="mt-6 text-sm text-slate-700">
          {t("examSession.answeredSummary", { answered: answeredCount, total: totalQuestions })}
        </p>
        {unansweredCount > 0 ? (
          <p className="mt-1 text-sm font-medium text-amber-700">
            {t("examSession.timeUpUnansweredNote", { count: unansweredCount })}
          </p>
        ) : null}
        <Button
          size="lg"
          className="mt-6 w-full py-6 text-base"
          onClick={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? graceRemaining === 0
              ? t("examSession.autoSubmitting")
              : t("examSession.savingAnswer")
            : t("examSession.submitNow")}
        </Button>
      </div>
    </div>
  );
}

type SubmitConfirmDialogProps = {
  totalQuestions: number;
  answeredCount: number;
  markedCount: number;
  unansweredIndexes: number[];
  questionIds: number[];
  isSubmitting: boolean;
  onJump: (index: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SubmitConfirmDialog({
  totalQuestions,
  answeredCount,
  markedCount,
  unansweredIndexes,
  questionIds,
  isSubmitting,
  onJump,
  onCancel,
  onConfirm,
}: SubmitConfirmDialogProps) {
  const { t } = useTranslation("common");
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="submit-confirm-title" className="text-lg font-bold text-slate-900">
          {t("examSession.confirmSubmitTitle")}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{t("examSession.confirmSubmitDescription")}</p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">{t("examSession.confirmSubmitTotalQuestions")}</p>
            <p className="text-xl font-semibold text-slate-900">{totalQuestions}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">{t("examSession.confirmSubmitAnswered")}</p>
            <p className="text-xl font-semibold text-green-700">{answeredCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">{t("examSession.confirmSubmitUnanswered")}</p>
            <p className="text-xl font-semibold text-amber-700">{unansweredIndexes.length}</p>
          </div>
        </div>
        {markedCount > 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            {t("examSession.confirmSubmitMarked")}: {markedCount}
          </p>
        ) : null}
        {unansweredIndexes.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              {t("examSession.unansweredWarning", { count: unansweredIndexes.length })}
            </p>
            <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {unansweredIndexes.map((index) => (
                <Button
                  key={questionIds[index]}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                  onClick={() => onJump(index)}
                >
                  {t("examSession.jumpToQuestion", { number: index + 1 })}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("examSession.goBack")}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
            {unansweredIndexes.length > 0
              ? t("examSession.submitAnyway")
              : t("examSession.confirmSubmitButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}

type BackupRecoveryModalProps = {
  sessionId: number;
  examId: number;
  isRetrying: boolean;
  onDownload: () => void;
  onCopy: () => void;
  onClose: () => void;
  onRetry: () => void;
};

export function BackupRecoveryModal({
  sessionId,
  examId,
  isRetrying,
  onDownload,
  onCopy,
  onClose,
  onRetry,
}: BackupRecoveryModalProps) {
  const { t } = useTranslation("common");
  const steps = [
    t("examSession.backupModalStep1"),
    t("examSession.backupModalStep2"),
    t("examSession.backupModalStep3"),
    t("examSession.backupModalStep4"),
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950 animate-scale-up">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {t("examSession.backupModalTitle")}
            </h3>
            <p className="text-xs text-slate-500">
              Session ID: #{sessionId} • Exam ID: #{examId}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {t("examSession.backupModalDescription")}
          </p>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900/50">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">{index + 1}</span>
                <p className="mt-0.5">{step}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={onDownload}
              className="flex-1 gap-2 font-medium bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="h-4 w-4" />
              {t("examSession.downloadBackupBtn")}
            </Button>
            <Button
              onClick={onCopy}
              variant="outline"
              className="flex-1 gap-2 font-medium"
            >
              <Copy className="h-4 w-4" />
              {t("examSession.copyBackupBtn")}
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isRetrying}
            className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            {t("examSession.goBack")}
          </Button>
          <Button
            onClick={onRetry}
            disabled={isRetrying}
            className="gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white min-w-[8rem]"
          >
            <RefreshCw className={cn("h-4 w-4", isRetrying && "animate-spin")} />
            {isRetrying ? t("examSession.syncingNow") : t("examSession.retrySubmitBtn")}
          </Button>
        </div>
      </div>
    </div>
  );
}
