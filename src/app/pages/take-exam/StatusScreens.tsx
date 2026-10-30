import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import type { CandidateSession, PreviewVideoRef } from "./types";
import { formatDateTime } from "./utils";

export function LoadingScreen() {
  const { t } = useTranslation("common");
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">{t("examSession.loading")}</p>
    </div>
  );
}

export function UnavailableScreen({ error }: { error: string | null }) {
  const { t } = useTranslation("common");
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">{t("examSession.unavailableTitle")}</h1>
          <p className="text-sm text-gray-600 mb-6">{error ?? t("examSession.unavailableDescription")}</p>
          <Button asChild>
            <Link to="/candidate/exams">{t("examInstructions.backToMyExams")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

type ProctoringSetupScreenProps = {
  blockReason: string | null;
  previewStream: MediaStream | null;
  previewRef: PreviewVideoRef;
  isPending: boolean;
  onBegin: () => void;
};

export function ProctoringSetupScreen({
  blockReason,
  previewStream,
  previewRef,
  isPending,
  onBegin,
}: ProctoringSetupScreenProps) {
  const { t } = useTranslation("common");
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <Card className="w-full max-w-xl">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">{t("examSession.protectedSetupTitle")}</h1>
            <p className="text-sm text-gray-600">
              {t("examSession.protectedSetupDescription")}
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-medium">{t("examSession.protectedSetupIntroTitle")}</p>
            <p className="mt-2">{t("examSession.protectedSetupIntroDescription")}</p>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-900">{t("examSession.permissionsRequested")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t("examSession.permissionCamera")}</li>
              <li>{t("examSession.permissionMicrophone")}</li>
              <li>{t("examSession.permissionScreen")}</li>
              <li>{t("examSession.permissionFullscreen")}</li>
            </ul>
            <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed">
              {t("examSession.screenShareTip")}
            </div>
          </div>

          {blockReason ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {blockReason}
            </div>
          ) : null}

          {previewStream ? (
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t("examSession.webcamPreviewTitle")}</p>
                  <p className="text-xs text-slate-600">{t("examSession.webcamPreviewSetup")}</p>
                </div>
                <Badge variant="outline">{t("examSession.previewBadge")}</Badge>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                <video
                  ref={previewRef}
                  aria-label={t("examSession.webcamPreviewLabel")}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-video h-full w-full object-cover"
                />
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={onBegin} disabled={isPending}>
              {isPending
                ? t("examSession.startMonitoring")
                : previewStream
                  ? t("examSession.enterFullscreenAndStart")
                  : t("examSession.grantPermissionsAndStart")}
            </Button>
            <Button asChild>
              <Link to="/candidate/exams">{t("examInstructions.backToMyExams")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SubmittedScreen({ session, locale }: { session: CandidateSession; locale: string }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <Card className="w-full max-w-xl">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">{t("examSession.submittedTitle")}</h1>
            <p className="mt-2 text-sm text-gray-600">
              {t("examSession.submittedAt", {
                exam: session.exam_name,
                time: session.submitted_at
                  ? formatDateTime(session.submitted_at, locale)
                  : t("examSession.justNow"),
              })}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">{t("examSession.objectiveScore")}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {session.objective_score}/{session.max_score}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">{t("examSession.evaluationStatus")}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {session.manual_grading_required ? t("examSession.pendingGrading") : t("examSession.finalized")}
              </p>
            </div>
          </div>

          {session.is_late ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-4">
              {t("examSession.lateSubmissionNotice")}
            </div>
          ) : null}

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 mb-6">
            {session.show_results_immediately && !session.manual_grading_required
              ? t("examSession.resultsImmediate")
              : t("examSession.resultsLater")}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => navigate(0)}>
              {t("examSession.refresh")}
            </Button>
            <Button asChild>
              <Link to="/candidate/exams">{t("examInstructions.backToMyExams")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
