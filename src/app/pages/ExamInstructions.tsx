import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  FileText,
  Shield,
  Cpu,
  Database,
  Camera,
  Monitor,
  Wifi,
  Loader2,
} from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { useAsyncList } from "../hooks/useAsyncList";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import {
  type CandidateAssignedExam,
  canLaunchExam,
  formatExamSchedule,
  getExamAvailabilityLabel,
  getExamAvailabilityState,
  getExamAvailabilityTone,
} from "./candidateExamShared";

const emptyExamResponse: PaginatedResponse<CandidateAssignedExam> = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

export function ExamInstructions() {
  const { t, i18n } = useTranslation("common");
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const locationExam = (location.state as { exam?: CandidateAssignedExam } | null)?.exam ?? null;
  const [checklist, setChecklist] = useState({
    rules: false,
    workspace: false,
  });

  const deviceType = useMemo(() => {
    const ua = navigator.userAgent;
    const isMobile = /mobile|iphone|ipod|android/i.test(ua);
    const isMac = /macintosh|mac os x/i.test(ua) && !isMobile;
    const isIPad = /ipad/i.test(ua) || (isMac && navigator.maxTouchPoints > 1);
    
    if (isMobile) return "mobile";
    if (isIPad) return "tablet";
    if (isMac) return "mac";
    return "windows";
  }, []);

  const [autoCheckState, setAutoCheckState] = useState<{
    status: "idle" | "running" | "pass" | "fail";
    indexedDb: "pending" | "running" | "pass" | "fail";
    camera: "pending" | "running" | "pass" | "fail";
    screen: "pending" | "running" | "pass" | "fail";
    worker: "pending" | "running" | "pass" | "fail";
    network: "pending" | "running" | "pass" | "fail";
  }>({
    status: "idle",
    indexedDb: "pending",
    camera: "pending",
    screen: "pending",
    worker: "pending",
    network: "pending",
  });

  const runSystemCheck = async () => {
    if (!exam) return;

    setAutoCheckState({
      status: "running",
      indexedDb: "running",
      camera: "pending",
      screen: "pending",
      worker: "pending",
      network: "pending",
    });

    // 1. Check IndexedDB storage (>250MB)
    let dbPass = false;
    try {
      if (window.indexedDB) {
        if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          const quota = estimate.quota ?? 0;
          const usage = estimate.usage ?? 0;
          dbPass = (quota - usage) > 250 * 1024 * 1024;
        } else {
          dbPass = true; // fallback
        }
      }
    } catch {}
    
    setAutoCheckState(prev => ({
      ...prev,
      indexedDb: dbPass ? "pass" : "fail",
      camera: exam.enable_proctoring ? "running" : "pending",
    }));

    if (!dbPass) {
      setAutoCheckState(prev => ({ ...prev, status: "fail" }));
      return;
    }

    // 2. Check Camera access
    let cameraPass = true;
    if (exam.enable_proctoring) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject();
          setTimeout(() => reject(), 3000);
        });
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0, 160, 120);
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.5));
        stream.getTracks().forEach((t) => t.stop());
        cameraPass = blob !== null && blob.size > 0;
      } catch {
        cameraPass = false;
      }
    }

    setAutoCheckState(prev => ({
      ...prev,
      camera: cameraPass ? "pass" : "fail",
      screen: exam.enable_proctoring ? "running" : "pending",
    }));

    if (!cameraPass) {
      setAutoCheckState(prev => ({ ...prev, status: "fail" }));
      return;
    }

    // 3. Check Screen Share access
    let screenPass = true;
    if (exam.enable_proctoring) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: "monitor",
          },
          audio: false,
          selfBrowserSurface: "exclude",
          systemAudio: "exclude",
        } as any);
        const track = stream.getVideoTracks()[0];
        screenPass = !!track && track.readyState !== "ended";
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        screenPass = false;
      }
    }

    setAutoCheckState(prev => ({
      ...prev,
      screen: screenPass ? "pass" : "fail",
      worker: "running",
    }));

    if (!screenPass) {
      setAutoCheckState(prev => ({ ...prev, status: "fail" }));
      return;
    }

    // 4. Check Web Worker capability
    let workerPass = false;
    try {
      if (window.Worker) {
        const code = "self.onmessage = (e) => self.postMessage('pong');";
        const blob = new Blob([code], { type: "application/javascript" });
        const worker = new Worker(URL.createObjectURL(blob));
        workerPass = await new Promise<boolean>((resolve) => {
          worker.onmessage = () => resolve(true);
          worker.onerror = () => resolve(false);
          worker.postMessage("ping");
          setTimeout(() => resolve(false), 2000);
        });
        worker.terminate();
      }
    } catch {}

    setAutoCheckState(prev => ({
      ...prev,
      worker: workerPass ? "pass" : "fail",
      network: "running",
    }));

    if (!workerPass) {
      setAutoCheckState(prev => ({ ...prev, status: "fail" }));
      return;
    }

    // 5. Check Network latency (<1.5s)
    let networkPass = false;
    try {
      const start = Date.now();
      await fetch("/api/v1/health/", { method: "HEAD", cache: "no-store" }).catch(() => {});
      const latency = Date.now() - start;
      networkPass = latency < 1500;
    } catch {
      networkPass = true;
    }

    const allPass = dbPass && cameraPass && screenPass && workerPass && networkPass;
    setAutoCheckState(prev => ({
      ...prev,
      network: networkPass ? "pass" : "fail",
      status: allPass ? "pass" : "fail",
    }));
  };

  const fallbackExams = useAsyncList(
    () =>
      locationExam
        ? Promise.resolve(emptyExamResponse)
        : apiRequest<PaginatedResponse<CandidateAssignedExam>>("/api/v1/my-exams/", {
            query: { page_size: 100 },
          }),
    [id, Boolean(locationExam)],
  );

  const exam = useMemo(() => {
    if (locationExam) {
      return locationExam;
    }
    return fallbackExams.data?.results.find((record) => String(record.id) === String(id)) ?? null;
  }, [fallbackExams.data?.results, id, locationExam]);

  const allChecked = checklist.rules && checklist.workspace && autoCheckState.status === "pass";
  const availability = exam ? getExamAvailabilityState(exam) : null;

  if (!locationExam && fallbackExams.isLoading) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-slate-500">
          {t("examInstructions.loading")}
        </CardContent>
      </Card>
    );
  }

  if (!exam) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-base font-medium text-slate-900">{t("examInstructions.notFoundTitle")}</p>
          <p className="mt-1 text-sm text-slate-500">{t("examInstructions.notFoundDescription")}</p>
          <Button asChild className="mt-6">
            <Link to="/candidate/exams">{t("examInstructions.backToMyExams")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <Button variant="ghost" className="mb-4 px-0 text-slate-600 hover:bg-transparent" asChild>
        <Link to="/candidate/exams">
          <ArrowLeft className="h-4 w-4" />
          {t("examInstructions.backToMyExams")}
        </Link>
      </Button>

      <PageHeader
        title={exam.name}
        description={t("examInstructions.pageDescription")}
      />

      {fallbackExams.error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fallbackExams.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr),380px]">
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{exam.subject.name}</Badge>
              <Badge variant="outline" className={getExamAvailabilityTone(exam)}>
                {getExamAvailabilityLabel(exam, { locale: i18n.resolvedLanguage ?? i18n.language })}
              </Badge>
              {exam.enable_proctoring ? (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                  {t("examInstructions.proctored")}
                </Badge>
              ) : null}
            </div>
            <CardTitle className="text-2xl text-slate-950">{t("examInstructions.readinessTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  {t("examInstructions.schedule")}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {formatExamSchedule(
                    exam.schedule.opens_at,
                    exam.schedule.closes_at,
                    i18n.resolvedLanguage ?? i18n.language,
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Clock3 className="h-4 w-4 text-blue-600" />
                  {t("examInstructions.duration")}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {t("myExams.duration", { minutes: exam.duration_minutes })}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <FileText className="h-4 w-4 text-blue-600" />
                  {t("examInstructions.questionSet")}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {t("myExams.questionCount", { count: exam.question_count })}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Shield className="h-4 w-4 text-blue-600" />
                  {t("examInstructions.attempts")}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {t("examInstructions.attemptsUsed", {
                    used: exam.attempts_used,
                    total: exam.max_attempts,
                  })}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                <div className="space-y-2 text-sm text-amber-900">
                  <p className="font-semibold">{t("examInstructions.beforeBeginTitle")}</p>
                  <p>{t("examInstructions.beforeBeginNetwork")}</p>
                  <p>{t("examInstructions.beforeBeginProctoring")}</p>
                </div>
              </div>
            </div>

            {exam.enable_proctoring && (
              <div className={`rounded-2xl border p-5 animate-fade-in ${
                deviceType === "mobile" 
                  ? "border-red-200 bg-red-50 text-red-900" 
                  : deviceType === "mac" || deviceType === "tablet"
                    ? "border-blue-200 bg-blue-50 text-blue-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
              }`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${
                    deviceType === "mobile" 
                      ? "text-red-600" 
                      : deviceType === "mac" || deviceType === "tablet"
                        ? "text-blue-600"
                        : "text-amber-600"
                  }`} />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">
                      {deviceType === "mobile" 
                        ? t("examInstructions.deviceNotices.mobileTitle")
                        : deviceType === "mac"
                          ? t("examInstructions.deviceNotices.macTitle")
                          : deviceType === "tablet"
                            ? t("examInstructions.deviceNotices.ipadTitle")
                            : t("examInstructions.deviceNotices.windowsTitle")}
                    </p>
                    <p className="leading-relaxed text-xs opacity-90">
                      {deviceType === "mobile" 
                        ? t("examInstructions.deviceNotices.mobileDesc")
                        : deviceType === "mac"
                          ? t("examInstructions.deviceNotices.macDesc")
                          : deviceType === "tablet"
                            ? t("examInstructions.deviceNotices.ipadDesc")
                            : t("examInstructions.deviceNotices.windowsDesc")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">{t("examInstructions.systemCheckTitle", { defaultValue: "Automated System Check" })}</h3>
                {autoCheckState.status === "idle" && (
                  <Button size="sm" onClick={runSystemCheck}>
                    {t("examInstructions.runCheck", { defaultValue: "Run Check" })}
                  </Button>
                )}
                {autoCheckState.status === "running" && (
                  <span className="flex items-center gap-1.5 text-sm text-blue-600 font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("examInstructions.checking", { defaultValue: "Checking..." })}
                  </span>
                )}
                {autoCheckState.status === "pass" && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    {t("examInstructions.checkPass", { defaultValue: "System Ready" })}
                  </span>
                )}
                {autoCheckState.status === "fail" && (
                  <Button size="sm" variant="destructive" onClick={runSystemCheck}>
                    {t("examInstructions.retryCheck", { defaultValue: "Retry Check" })}
                  </Button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className={`flex items-center gap-3 rounded-xl border p-3 bg-white ${
                  autoCheckState.indexedDb === "pass" ? "border-emerald-200" : autoCheckState.indexedDb === "fail" ? "border-red-200" : "border-slate-200"
                }`}>
                  <Database className={`h-5 w-5 ${
                    autoCheckState.indexedDb === "pass" ? "text-emerald-500" : autoCheckState.indexedDb === "fail" ? "text-red-500" : "text-slate-400"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900">IndexedDB Storage</p>
                    <p className="text-[10px] text-slate-500 truncate">{autoCheckState.indexedDb === "pass" ? "Ready (>250MB)" : autoCheckState.indexedDb === "fail" ? "Storage Full" : "Pending"}</p>
                  </div>
                </div>

                <div className={`flex items-center gap-3 rounded-xl border p-3 bg-white ${
                  autoCheckState.worker === "pass" ? "border-emerald-200" : autoCheckState.worker === "fail" ? "border-red-200" : "border-slate-200"
                }`}>
                  <Cpu className={`h-5 w-5 ${
                    autoCheckState.worker === "pass" ? "text-emerald-500" : autoCheckState.worker === "fail" ? "text-red-500" : "text-slate-400"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900">Web Worker</p>
                    <p className="text-[10px] text-slate-500 truncate">{autoCheckState.worker === "pass" ? "Supported" : autoCheckState.worker === "fail" ? "Unsupported" : "Pending"}</p>
                  </div>
                </div>

                <div className={`flex items-center gap-3 rounded-xl border p-3 bg-white ${
                  autoCheckState.network === "pass" ? "border-emerald-200" : autoCheckState.network === "fail" ? "border-red-200" : "border-slate-200"
                }`}>
                  <Wifi className={`h-5 w-5 ${
                    autoCheckState.network === "pass" ? "text-emerald-500" : autoCheckState.network === "fail" ? "text-red-500" : "text-slate-400"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900">Network Connection</p>
                    <p className="text-[10px] text-slate-500 truncate">{autoCheckState.network === "pass" ? "Stable" : autoCheckState.network === "fail" ? "High Latency" : "Pending"}</p>
                  </div>
                </div>

                {exam.enable_proctoring && (
                  <>
                    <div className={`flex items-center gap-3 rounded-xl border p-3 bg-white ${
                      autoCheckState.camera === "pass" ? "border-emerald-200" : autoCheckState.camera === "fail" ? "border-red-200" : "border-slate-200"
                    }`}>
                      <Camera className={`h-5 w-5 ${
                        autoCheckState.camera === "pass" ? "text-emerald-500" : autoCheckState.camera === "fail" ? "text-red-500" : "text-slate-400"
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900">Webcam Access</p>
                        <p className="text-[10px] text-slate-500 truncate">{autoCheckState.camera === "pass" ? "Granted" : autoCheckState.camera === "fail" ? "Denied" : "Pending"}</p>
                      </div>
                    </div>

                    <div className={`flex items-center gap-3 rounded-xl border p-3 bg-white ${
                      autoCheckState.screen === "pass" ? "border-emerald-200" : autoCheckState.screen === "fail" ? "border-red-200" : "border-slate-200"
                    }`}>
                      <Monitor className={`h-5 w-5 ${
                        autoCheckState.screen === "pass" ? "text-emerald-500" : autoCheckState.screen === "fail" ? "text-red-500" : "text-slate-400"
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900">Screen Share</p>
                        <p className="text-[10px] text-slate-500 truncate">{autoCheckState.screen === "pass" ? "Granted" : autoCheckState.screen === "fail" ? "Denied" : "Pending"}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {exam.enable_proctoring && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed">
                  {t("examSession.screenShareTip")}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {(
                [
                  ["rules", t("examInstructions.checklist.rules")],
                  ["workspace", t("examInstructions.checklist.workspace")],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <Checkbox
                    checked={checklist[key]}
                    onCheckedChange={(checked) =>
                      setChecklist((current) => ({ ...current, [key]: checked === true }))
                    }
                    className="mt-0.5"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>{t("examInstructions.launchSummary")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl bg-slate-950 px-5 py-6 text-white">
              <p className="text-sm text-slate-300">{t("examInstructions.subject")}</p>
              <p className="mt-1 text-xl font-semibold">{exam.subject.name}</p>
              <p className="mt-4 text-sm text-slate-300">{t("examInstructions.passingScore")}</p>
              <p className="mt-1 text-lg font-medium">{exam.passing_score}</p>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-4">
                <span>{t("examInstructions.status")}</span>
                <span className="font-medium text-slate-900">
                  {getExamAvailabilityLabel(exam, { locale: i18n.resolvedLanguage ?? i18n.language })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>{t("examInstructions.window")}</span>
                <span className="text-right text-slate-900">
                  {availability === "available" || availability === "resume"
                    ? t("examInstructions.openNow")
                    : getExamAvailabilityLabel(exam, { locale: i18n.resolvedLanguage ?? i18n.language })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>{t("examInstructions.checklistLabel")}</span>
                <span className="font-medium text-slate-900">
                  {t("examInstructions.checklistConfirmed", {
                    count: Object.values(checklist).filter(Boolean).length,
                  })}
                </span>
              </div>
            </div>

            {canLaunchExam(exam) ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4" />
                  <span>{t("examInstructions.launchReadyHint")}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {t("examInstructions.launchUnavailableHint")}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={!canLaunchExam(exam) || !allChecked}
              onClick={() => navigate(`/candidate/exam/${exam.id}`)}
            >
              {availability === "resume" ? t("examInstructions.resumeExam") : t("examInstructions.startExam")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
