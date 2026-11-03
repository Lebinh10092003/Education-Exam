import { useTranslation } from "react-i18next";
import { Flag } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import type { PreviewVideoRef, SessionQuestion } from "./types";

type QuestionNavigatorProps = {
  questions: SessionQuestion[];
  currentIndex: number;
  answeredCount: number;
  markedCount: number;
  isSaving: boolean;
  enableProctoring: boolean;
  proctoringReady: boolean;
  previewStream: MediaStream | null;
  previewRef: PreviewVideoRef;
  onSelect: (index: number) => void;
};

export function QuestionNavigator({
  questions,
  currentIndex,
  answeredCount,
  markedCount,
  isSaving,
  enableProctoring,
  proctoringReady,
  previewStream,
  previewRef,
  onSelect,
}: QuestionNavigatorProps) {
  const { t } = useTranslation("common");
  const total = questions.length;
  const answeredUnmarked = questions.filter((q) => q.is_answered && !q.is_marked_for_review).length;
  const marked = questions.filter((q) => q.is_marked_for_review).length;

  return (
    <Card className="lg:sticky lg:top-24">
      <CardContent className="p-4 sm:p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t("examSession.questionNavigator")}</h3>

        <div className="mb-4">
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex border border-slate-200/50">
            <div
              style={{ width: `${(answeredUnmarked / total) * 100}%` }}
              className="h-full bg-emerald-500 transition-all duration-500 ease-out"
              title="Answered"
            />
            <div
              style={{ width: `${(marked / total) * 100}%` }}
              className="h-full bg-amber-500 transition-all duration-500 ease-out animate-pulse"
              title="Marked for Review"
            />
          </div>
        </div>

        {enableProctoring ? (
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{t("examSession.webcamPreviewTitle")}</p>
                <p className="text-xs text-slate-600">
                  {proctoringReady ? t("examSession.monitoringActive") : t("examSession.monitoringPending")}
                </p>
              </div>
              <Badge variant="outline">{proctoringReady ? t("examSession.liveBadge") : t("examSession.pendingBadge")}</Badge>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
              {proctoringReady && previewStream ? (
                <video
                  ref={previewRef}
                  aria-label={t("examSession.webcamPreviewLabel")}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-video h-full w-full object-cover"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center px-4 text-center text-xs text-slate-200">
                  {t("examSession.webcamPreviewWaiting")}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{t("examSession.answered")}:</span>
            <span className="font-semibold text-green-600">
              {answeredCount}/{total}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{t("examSession.marked")}:</span>
            <span className="font-semibold text-orange-600">{markedCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{t("examSession.unanswered")}:</span>
            <span className="font-semibold text-red-600">
              {total - answeredCount}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {questions.map((question, index) => (
            <button
              key={question.id}
              onClick={() => onSelect(index)}
              className={`aspect-square rounded-lg flex items-center justify-center text-sm font-semibold transition-all relative ${
                currentIndex === index
                  ? "bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2"
                  : question.is_answered
                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              type="button"
            >
              {index + 1}
              {question.is_marked_for_review ? (
                <Flag className="w-3 h-3 absolute -top-1 -right-1 text-orange-500 fill-orange-500" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 bg-green-100 rounded" />
            <span className="text-gray-600">{t("examSession.answered")}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 bg-gray-100 rounded" />
            <span className="text-gray-600">{t("examSession.unanswered")}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 bg-blue-600 rounded" />
            <span className="text-gray-600">{t("examSession.current")}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Flag className="w-4 h-4 text-orange-500 fill-orange-500" />
            <span className="text-gray-600">{t("examSession.marked")}</span>
          </div>
          {isSaving ? <p className="text-xs text-blue-600 pt-2">{t("examSession.savingAnswer")}</p> : null}

          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs font-semibold text-slate-500 mb-2">⌨️ {t("examSession.shortcuts.title")}</p>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500">
              <div><kbd className="px-1 bg-slate-100 border rounded">Alt</kbd>+<kbd className="px-1 bg-slate-100 border rounded">←</kbd> {t("examSession.shortcuts.prev")}</div>
              <div><kbd className="px-1 bg-slate-100 border rounded">Alt</kbd>+<kbd className="px-1 bg-slate-100 border rounded">→</kbd> {t("examSession.shortcuts.next")}</div>
              <div><kbd className="px-1 bg-slate-100 border rounded">Alt</kbd>+<kbd className="px-1 bg-slate-100 border rounded">F</kbd> {t("examSession.shortcuts.flag")}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
