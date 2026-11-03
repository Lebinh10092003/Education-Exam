import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";

import { apiRequest } from "../lib/http";
import { notify } from "../lib/notify";
import {
  claimStashedProctoringStreams,
  hasStashedProctoringStreams,
  releaseStashedProctoringStreams,
  requestProctoringStreams,
  type ProctoringCaptureResources,
} from "../lib/proctoringCapture";
import {
  connectCandidatePublisher,
  disconnectRoom,
  recordProctoringEvent,
  reportMediaStatus,
  requestPublishToken,
  type ConnectedMediaRoom,
  type ProctorEventResponse,
} from "../lib/proctoringMedia";
import { backupFileName, buildBackupJson, buildBackupText, downloadJsonFile } from "./take-exam/backup";
import {
  BackupRecoveryModal,
  FullscreenExitOverlay,
  SubmitConfirmDialog,
  TimeUpDialog,
} from "./take-exam/Dialogs";
import {
  captureViolationEvidence as captureEvidenceLocally,
  uploadPendingSnapshots as uploadEvidenceSnapshots,
} from "./take-exam/evidence";
import { ExamHeader, SyncErrorBanner, ViolationNoticeBanner } from "./take-exam/ExamHeader";
import { useExamShortcuts, useExamTimer } from "./take-exam/hooks";
import {
  countPendingSync,
  mergeLocalDraftAnswers,
  removeFromLocalDraft,
  saveToLocalDraft,
  syncLocalDraftQueue,
} from "./take-exam/localDraft";
import { QuestionNavigator } from "./take-exam/QuestionNavigator";
import { QuestionPanel } from "./take-exam/QuestionPanel";
import { useLiveControlSocket } from "./take-exam/useLiveControlSocket";
import {
  LoadingScreen,
  ProctoringSetupScreen,
  SubmittedScreen,
  UnavailableScreen,
} from "./take-exam/StatusScreens";
import type {
  AnswerPayload,
  AutosaveResponse,
  CandidateSession,
  ConnectionStatus,
  SessionAnswerResponse,
  SessionQuestion,
  SubmissionSummary,
  ViolationNotice,
} from "./take-exam/types";
import {
  applySubmission,
  assignPreviewStream,
  AUTOSAVE_INTERVAL_MS,
  ESSAY_AUTOSAVE_DELAY_MS,
  getCandidateConnectionStatus,
  getEvidenceUploadDelayMs,
  getNavigatorConnectionInfo,
  HEARTBEAT_INTERVAL_MS,
  VIOLATION_COOLDOWN_MS,
} from "./take-exam/utils";

/**
 * Trang lam bai thi cua thi sinh: dieu phoi phien thi, luu bai (co hang doi ngoai tuyen),
 * giam sat (webcam/man hinh/toan man hinh) va nop bai. Giao dien nam trong ./take-exam/.
 */
export function TakeExam() {
  const { t, i18n } = useTranslation("common");
  const { id } = useParams();
  const examId = Number(id);
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [session, setSession] = useState<CandidateSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // graceRemaining: null = con gio lam bai; so giay = dang trong thoi gian an han chi duoc nop bai.
  const { timeRemaining, setTimeRemaining, graceRemaining, timeUpRef } = useExamTimer(session);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const autoSubmitTriggeredRef = useRef(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proctoringBlockReason, setProctoringBlockReason] = useState<string | null>(null);
  const [proctoringReady, setProctoringReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isProctoringSetupPending, setIsProctoringSetupPending] = useState(false);
  const [localPreviewStream, setLocalPreviewStream] = useState<MediaStream | null>(null);
  const [latestViolationNotice, setLatestViolationNotice] = useState<ViolationNotice | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    navigator.onLine ? "stable" : "offline",
  );

  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncFailed, setIsSyncFailed] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isRetryingSubmit, setIsRetryingSubmit] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const refreshPendingSyncCount = async (overrideSessionId?: number) => {
    const activeSessionId = overrideSessionId ?? session?.id;
    if (activeSessionId) {
      const count = await countPendingSync(activeSessionId);
      setPendingSyncCount(count);
    }
  };

  const handleManualSync = async () => {
    if (!session || isManualSyncing) return;
    setIsManualSyncing(true);
    try {
      await syncLocalDraftQueue(session.id, () => {
        void refreshPendingSyncCount();
      });
      const currentCount = await countPendingSync(session.id);
      if (currentCount === 0) {
        setIsSyncFailed(false);
        notify.success(t("examSession.syncCompleted"));
      } else {
        notify.warning(t("examSession.syncStatus", { count: currentCount }));
      }
    } catch (err) {
      console.error(err);
      notify.error(t("examSession.saveAnswerError"));
    } finally {
      setIsManualSyncing(false);
      await refreshPendingSyncCount();
    }
  };
  const dirtyEssayQuestionIdsRef = useRef<Set<number>>(new Set());
  const latestQuestionIndexRef = useRef(0);
  const requestQueueRef = useRef(Promise.resolve());
  const heartbeatPendingRef = useRef(false);
  const heartbeatFailureCountRef = useRef(0);
  const autosavePendingRef = useRef(false);
  const autosaveDirtyRef = useRef(false);
  const capabilityRegisteredSessionIdRef = useRef<number | null>(null);
  const captureResourcesRef = useRef<ProctoringCaptureResources | null>(null);
  const liveRoomRef = useRef<ConnectedMediaRoom | null>(null);
  const liveRequestEnabledRef = useRef(false);
  const setupPreviewRef = useRef<HTMLVideoElement | null>(null);
  const examPreviewRef = useRef<HTMLVideoElement | null>(null);
  const screenEndedHandlerRef = useRef<(() => void) | null>(null);
  const violationCapturePendingRef = useRef(false);
  const lastViolationAtRef = useRef<Record<string, number>>({});

  const enqueueSessionMutation = async <T,>(task: () => Promise<T>) => {
    const previous = requestQueueRef.current;
    let releaseCurrent: () => void = () => undefined;
    requestQueueRef.current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    await previous;
    try {
      return await task();
    } finally {
      releaseCurrent();
    }
  };

  const markAutosaveDirty = () => {
    autosaveDirtyRef.current = true;
  };

  const getCurrentScreenCaptureStatus = () => {
    const screenTrack = captureResourcesRef.current?.screenTrack;
    if (!screenTrack) {
      return "unavailable" as const;
    }
    return screenTrack.readyState === "ended" ? ("revoked" as const) : ("ready" as const);
  };

  const syncRequestedLiveState = async (enabled: boolean) => {
    liveRequestEnabledRef.current = enabled;
    if (!session) {
      return;
    }

    const captureResources = captureResourcesRef.current;
    if (!captureResources) {
      return;
    }

    if (!enabled) {
      if (!liveRoomRef.current) {
        return;
      }
      await disconnectRoom(liveRoomRef.current);
      liveRoomRef.current = null;
      await enqueueSessionMutation(() =>
        reportMediaStatus(session.id, {
          webcam_publish_status: "stopped",
          screen_capture_status: getCurrentScreenCaptureStatus(),
          metadata: { reason: "live_request_disabled" },
        }),
      ).catch(() => undefined);
      return;
    }

    if (liveRoomRef.current) {
      return;
    }

    try {
      const publishToken = await enqueueSessionMutation(() => requestPublishToken(session.id));
      if (publishToken.vps_overloaded) {
        await enqueueSessionMutation(() =>
          reportMediaStatus(session.id, {
            webcam_publish_status: "idle",
            screen_capture_status: getCurrentScreenCaptureStatus(),
            metadata: {
              reason: "vps_overloaded_fallback",
            },
          }),
        );
        console.warn("VPS resources are low (less than 50% free). WebRTC live streaming is disabled; falling back to snapshot proctoring.");
        return;
      }
      liveRoomRef.current = await connectCandidatePublisher(
        publishToken,
        captureResources.webcamTrack,
      );
      await enqueueSessionMutation(() =>
        reportMediaStatus(session.id, {
          webcam_publish_status: "publishing",
          screen_capture_status: getCurrentScreenCaptureStatus(),
          metadata: {
            provider: publishToken.provider,
            room_name: publishToken.room_name,
            participant_name: publishToken.participant_name,
            reason: "live_request_enabled",
          },
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("examSession.protectedSetupDescription");
      await enqueueSessionMutation(() =>
        reportMediaStatus(session.id, {
          webcam_publish_status: "failed",
          screen_capture_status: getCurrentScreenCaptureStatus(),
          webcam_publish_error: message,
          metadata: { reason: "live_request_failed" },
        }),
      ).catch(() => undefined);
      notify.error(message);
    }
  };

  const updateQuestion = (questionId: number, patch: Partial<SessionQuestion>) => {
    setSession((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        questions: current.questions.map((question) =>
          question.id === questionId ? { ...question, ...patch } : question,
        ),
      };
    });
  };

  useEffect(() => {
    latestQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  const saveAnswer = async (
    questionId: number,
    payload: AnswerPayload,
  ) => {
    if (!session) {
      return;
    }

    setIsSaving(true);
    await saveToLocalDraft(session.id, questionId, payload);
    await refreshPendingSyncCount();
    
    try {
      const response = await enqueueSessionMutation(() =>
        apiRequest<SessionAnswerResponse>(`/api/v1/exam-sessions/${session.id}/answers/${questionId}/`, {
          method: "PUT",
          body: payload,
        }),
      );
      updateQuestion(questionId, {
        selected_option_keys: response.selected_option_keys,
        answer_text: response.answer_text,
        is_answered: response.is_answered,
        is_marked_for_review: response.is_marked_for_review,
      });
      setLastSavedAt(response.updated_at);
      dirtyEssayQuestionIdsRef.current.delete(questionId);
      await removeFromLocalDraft(session.id, questionId);
      setIsSyncFailed(false);
    } catch (saveError) {
      setIsSyncFailed(true);
      console.error("Failed to sync answer with server. Saved locally.", saveError);
    } finally {
      setIsSaving(false);
      await refreshPendingSyncCount();
    }
  };

  const persistEssayAnswer = async (questionIndex = currentQuestionIndex) => {
    const currentSession = session;
    if (!currentSession) {
      return;
    }
    const question = currentSession.questions[questionIndex];
    if (!question || question.question_type !== "essay" || !dirtyEssayQuestionIdsRef.current.has(question.id)) {
      return;
    }
    await saveAnswer(
      question.id,
      {
        answer_text: question.answer_text,
        is_marked_for_review: question.is_marked_for_review,
      },
    );
  };

  const cleanupProctoringResources = async () => {
    if (captureResourcesRef.current?.screenTrack && screenEndedHandlerRef.current) {
      captureResourcesRef.current.screenTrack.removeEventListener("ended", screenEndedHandlerRef.current);
    }
    screenEndedHandlerRef.current = null;
    closeControlSocket();
    await disconnectRoom(liveRoomRef.current);
    liveRoomRef.current = null;
    liveRequestEnabledRef.current = false;
    captureResourcesRef.current?.dispose();
    captureResourcesRef.current = null;
    setLocalPreviewStream(null);
  };

  const ensureFullscreenMode = async () => {
    if (!document.fullscreenEnabled) {
      throw new Error(t("examSession.fullscreenRequired"));
    }
    if (document.fullscreenElement) {
      return;
    }
    const requestFullscreen = document.documentElement.requestFullscreen?.bind(document.documentElement);
    if (!requestFullscreen) {
      throw new Error(t("examSession.fullscreenUnsupported"));
    }
    await requestFullscreen();
  };

  const captureViolationEvidence = async (
    event: ProctorEventResponse,
    message: string,
    severity: "critical" | "warning" | "info",
  ) => {
    const captureResources = captureResourcesRef.current;
    if (!session || !captureResources) {
      return;
    }
    await captureEvidenceLocally(session.id, captureResources, event, message, severity);
  };

  const reportViolation = async (
    eventType: string,
    severity: "info" | "warning" | "critical",
    message: string,
  ) => {
    if (!session || violationCapturePendingRef.current) {
      return;
    }
    const nowMs = Date.now();
    const lastReportedAt = lastViolationAtRef.current[eventType] ?? 0;
    if (nowMs - lastReportedAt < VIOLATION_COOLDOWN_MS) {
      return;
    }
    lastViolationAtRef.current[eventType] = nowMs;

    violationCapturePendingRef.current = true;
    try {
      const event = await enqueueSessionMutation(() =>
        recordProctoringEvent(session.id, {
          event_type: eventType,
          severity,
          metadata: { message },
        }),
      );
      const violationMessage =
        typeof event.metadata?.message === "string" && event.metadata.message.trim().length > 0
          ? event.metadata.message
          : message;
      if (severity === "warning" || severity === "critical") {
        setLatestViolationNotice({
          severity,
          message: violationMessage,
          occurredAt: event.occurred_at,
        });
        if (severity === "critical") {
          notify.error(`${t("examSession.criticalAlertRecorded")} ${violationMessage}`);
        } else {
          notify.warning(`${t("examSession.warningAlertRecorded")} ${violationMessage}`);
        }
      }
      await captureViolationEvidence(event, message, severity as "critical" | "warning" | "info");
    } catch (violationError) {
      const errorMessage =
        violationError instanceof Error ? violationError.message : t("examSession.captureEvidenceError");
      notify.error(errorMessage);
    } finally {
      violationCapturePendingRef.current = false;
    }
  };

  const loadSession = async () => {
    if (!examId) {
      setError(t("examSession.unavailableDescription"));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextSession = await apiRequest<CandidateSession>(`/api/v1/exams/${examId}/start-session/`, {
        method: "POST",
      });
      
      try {
        nextSession.questions = await mergeLocalDraftAnswers(nextSession.id, nextSession.questions);
      } catch (err) {
        console.error("Failed to load local draft answers", err);
      }

      setSession(nextSession);
      if (nextSession.status !== "in_progress") {
        // Phien da nop: tai bu anh bang chung con sot trong IndexedDB (vd. dong tab truoc khi upload xong).
        const submittedSessionId = nextSession.id;
        window.setTimeout(() => {
          void uploadPendingSnapshots(submittedSessionId).catch(() => undefined);
        }, getEvidenceUploadDelayMs());
      }
      setLatestViolationNotice(null);
      setProctoringBlockReason(null);
      setProctoringReady(!nextSession.enable_proctoring);
      setIsProctoringSetupPending(false);
      setTimeRemaining(nextSession.remaining_seconds);
      autosaveDirtyRef.current = false;
      liveRequestEnabledRef.current = false;
      const nextIndex = Math.max(
        nextSession.questions.findIndex((question) => !question.is_answered),
        0,
      );
      setCurrentQuestionIndex(nextIndex === -1 ? 0 : nextIndex);
      void refreshPendingSyncCount(nextSession.id);
      void syncLocalDraftQueue(nextSession.id, () => {
        void refreshPendingSyncCount(nextSession.id);
      }).catch(() => undefined);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("examSession.unavailableDescription"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSession();
  }, [examId]);

  useEffect(() => {
    return () => {
      void cleanupProctoringResources();
    };
  }, []);

  useEffect(() => {
    assignPreviewStream(setupPreviewRef.current, localPreviewStream);
    assignPreviewStream(examPreviewRef.current, localPreviewStream);
    return () => {
      assignPreviewStream(setupPreviewRef.current, null);
      assignPreviewStream(examPreviewRef.current, null);
    };
  }, [localPreviewStream, proctoringReady]);

  useEffect(() => {
    if (session?.status === "submitted") {
      void cleanupProctoringResources();
    }
  }, [session?.status]);

  // Roi trang ma chua dung quyen da ban giao -> tat camera/man hinh.
  useEffect(() => () => releaseStashedProctoringStreams(), []);

  // Da cap quyen o buoc kiem tra: tu bat dau giam sat, khong bat thi sinh bam/cap quyen lan nua.
  const autoBeginSessionRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      !session
      || !session.enable_proctoring
      || session.status !== "in_progress"
      || proctoringReady
      || isProctoringSetupPending
      || autoBeginSessionRef.current === session.id
      || !hasStashedProctoringStreams(examId)
    ) {
      return;
    }
    autoBeginSessionRef.current = session.id;
    void beginProtectedExam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.status, session?.enable_proctoring, proctoringReady, isProctoringSetupPending, examId]);

  const beginProtectedExam = async () => {
    if (!session || !session.enable_proctoring) {
      return;
    }

    let enteredFullscreen = false;
    setIsProctoringSetupPending(true);
    setProctoringReady(false);

    try {
      let captureResources = captureResourcesRef.current;
      if (!captureResources) {
        await cleanupProctoringResources();
        // Dung lai quyen da cap o buoc "Kiem tra he thong"; chi xin lai neu da mat.
        captureResources = claimStashedProctoringStreams(examId) ?? (await requestProctoringStreams());
        captureResourcesRef.current = captureResources;
        setLocalPreviewStream(captureResources.webcamStream);
        liveRequestEnabledRef.current = false;

        const onScreenShareEnded = () => {
          void enqueueSessionMutation(() =>
            reportMediaStatus(session.id, {
              webcam_publish_status: liveRoomRef.current ? "publishing" : "idle",
              screen_capture_status: "revoked",
              metadata: { reason: "screen_share_ended" },
            }),
          ).catch(() => undefined);
          void reportViolation("manual_alert", "critical", t("examSession.screenShareEnded"));
        };
        screenEndedHandlerRef.current = onScreenShareEnded;
        captureResources.screenTrack.addEventListener("ended", onScreenShareEnded);
      }

      const wasAlreadyFullscreen = Boolean(document.fullscreenElement);
      try {
        await ensureFullscreenMode();
        enteredFullscreen = !wasAlreadyFullscreen && Boolean(document.fullscreenElement);
      } catch (fullscreenError) {
        const message =
          fullscreenError instanceof Error
            ? fullscreenError.message
            : t("examSession.fullscreenRequired");
        setProctoringBlockReason(
          captureResourcesRef.current
            ? t("examSession.permissionsReadyRetry")
            : message,
        );
        return;
      }

      if (capabilityRegisteredSessionIdRef.current !== session.id) {
        capabilityRegisteredSessionIdRef.current = session.id;
        await enqueueSessionMutation(() =>
          apiRequest(`/api/v1/proctoring/sessions/${session.id}/capability/`, {
            method: "POST",
            body: {
              client_type: "web",
              client_version: "vite-react",
              capabilities: {
                fullscreen_enabled: document.fullscreenEnabled,
                online: navigator.onLine,
                user_agent: navigator.userAgent,
                webcam: true,
                microphone: true,
                screen_capture: true,
              },
              attestation_payload: {},
              user_agent: navigator.userAgent,
            },
          }),
        );
      }

      await enqueueSessionMutation(() =>
        reportMediaStatus(session.id, {
          webcam_publish_status: "idle",
          screen_capture_status: "ready",
          metadata: {
            mode: "local_only",
          },
        }),
      );
      setProctoringBlockReason(null);
      setProctoringReady(true);
    } catch (proctoringError) {
      const message =
        proctoringError instanceof Error
          ? proctoringError.message
          : t("examSession.protectedSetupDescription");
      capabilityRegisteredSessionIdRef.current = null;
      setProctoringReady(false);
      setProctoringBlockReason(message);
      notify.error(message);
      await cleanupProctoringResources();
      if (enteredFullscreen && document.fullscreenElement && document.exitFullscreen) {
        try {
          await document.exitFullscreen();
        } catch {
          // Ignore exit errors and surface the original setup failure instead.
        }
      }
    } finally {
      setIsProctoringSetupPending(false);
    }
  };

  const closeControlSocket = useLiveControlSocket(
    Boolean(session?.enable_proctoring && session.status === "in_progress" && proctoringReady),
    session?.id,
    (enabled) => void syncRequestedLiveState(enabled),
  );

  useEffect(() => {
    if (!session || session.status !== "in_progress") {
      return;
    }

    if (session.enable_proctoring && !proctoringReady) {
      return;
    }

    const autosave = () => {
      if (timeUpRef.current) {
        return;
      }
      void syncLocalDraftQueue(session.id, () => {
        void refreshPendingSyncCount();
      }).catch(() => undefined);
      if (autosavePendingRef.current || !autosaveDirtyRef.current) {
        return;
      }

      autosavePendingRef.current = true;
      void enqueueSessionMutation(async () => {
        try {
          const response = await apiRequest<AutosaveResponse>(`/api/v1/exam-sessions/${session.id}/autosave/`, {
            method: "POST",
            body: { payload: { current_question_index: latestQuestionIndexRef.current } },
          });
          setLastSavedAt(response.created_at);
          autosaveDirtyRef.current = false;
        } catch {
          heartbeatFailureCountRef.current = Math.max(heartbeatFailureCountRef.current, 1);
          setConnectionStatus("unstable");
        } finally {
          autosavePendingRef.current = false;
        }
      });
    };

    const intervalId = window.setInterval(() => {
      autosave();
    }, AUTOSAVE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [proctoringReady, session?.enable_proctoring, session?.id, session?.status]);

  useEffect(() => {
    if (!session || session.status !== "in_progress") {
      return;
    }

    if (session.enable_proctoring && (!proctoringReady || proctoringBlockReason)) {
      return;
    }

    const sendHeartbeat = () => {
      if (heartbeatPendingRef.current) {
        return;
      }

      const nextStatus = getCandidateConnectionStatus(heartbeatFailureCountRef.current);
      if (nextStatus === "offline") {
        setConnectionStatus("offline");
        return;
      }

      heartbeatPendingRef.current = true;
      const estimatedLatencyMs = getNavigatorConnectionInfo()?.rtt;
      void enqueueSessionMutation(async () => {
        try {
          await apiRequest(`/api/v1/proctoring/sessions/${session.id}/heartbeats/`, {
            method: "POST",
            body: {
              connection_status: nextStatus,
              latency_ms:
                typeof estimatedLatencyMs === "number" && Number.isFinite(estimatedLatencyMs)
                  ? Math.round(Math.max(estimatedLatencyMs, 0))
                  : undefined,
              payload: { current_question_index: latestQuestionIndexRef.current },
            },
          });
          heartbeatFailureCountRef.current = 0;
          setConnectionStatus(nextStatus);
        } catch {
          heartbeatFailureCountRef.current += 1;
          setConnectionStatus("unstable");
        } finally {
          heartbeatPendingRef.current = false;
        }
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        void reportViolation("tab_switch", "warning", t("examSession.tabSwitchWarning"));
      } else {
        void syncLocalDraftQueue(session.id, () => {
          void refreshPendingSyncCount();
        }).catch(() => undefined);
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (session.enable_proctoring && document.fullscreenEnabled && !document.fullscreenElement) {
        void reportViolation("fullscreen_exit", "warning", t("examSession.fullscreenExitWarning"));
      }
    };

    const handleOnline = () => {
      setConnectionStatus("unstable");
      void syncLocalDraftQueue(session.id, () => {
        void refreshPendingSyncCount();
      }).catch(() => undefined);
    };
    const handleOffline = () => setConnectionStatus("offline");

    sendHeartbeat();

    const heartbeatInterval = window.setInterval(() => {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.clearInterval(heartbeatInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [proctoringBlockReason, proctoringReady, session?.enable_proctoring, session?.id, session?.status]);

  const currentQuestion = session?.questions[currentQuestionIndex] ?? null;

  useEffect(() => {
    if (
      !session
      || session.status !== "in_progress"
      || !currentQuestion
      || currentQuestion.question_type !== "essay"
      || !dirtyEssayQuestionIdsRef.current.has(currentQuestion.id)
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (timeUpRef.current) {
        return;
      }
      void persistEssayAnswer(currentQuestionIndex).catch(() => undefined);
    }, ESSAY_AUTOSAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    currentQuestion?.answer_text,
    currentQuestion?.id,
    currentQuestion?.question_type,
    currentQuestionIndex,
    session,
  ]);

  const answeredCount = useMemo(
    () => session?.questions.filter((question) => question.is_answered).length ?? 0,
    [session],
  );
  const markedCount = useMemo(
    () => session?.questions.filter((question) => question.is_marked_for_review).length ?? 0,
    [session],
  );
  const unansweredIndexes = useMemo(
    () =>
      (session?.questions ?? []).reduce<number[]>((indexes, question, index) => {
        if (!question.is_answered) {
          indexes.push(index);
        }
        return indexes;
      }, []),
    [session],
  );
  const isTimeUp = session?.status === "in_progress" && graceRemaining !== null;

  const goToQuestion = async (nextIndex: number) => {
    if (!session || nextIndex < 0 || nextIndex >= session.questions.length) {
      return;
    }
    try {
      await persistEssayAnswer();
      setCurrentQuestionIndex(nextIndex);
      markAutosaveDirty();
    } catch {
      // Error already surfaced via notify.
    }
  };

  const handleOptionChange = async (optionKey: string) => {
    if (!currentQuestion || timeUpRef.current) {
      return;
    }
    updateQuestion(currentQuestion.id, {
      selected_option_keys: [optionKey],
      is_answered: true,
    });
    markAutosaveDirty();
    await saveAnswer(currentQuestion.id, {
      selected_option_keys: [optionKey],
      is_marked_for_review: currentQuestion.is_marked_for_review,
    });
  };

  const handleEssayChange = (nextText: string) => {
    if (!currentQuestion || timeUpRef.current) {
      return;
    }
    dirtyEssayQuestionIdsRef.current.add(currentQuestion.id);
    markAutosaveDirty();
    updateQuestion(currentQuestion.id, {
      answer_text: nextText,
      is_answered: Boolean(nextText.trim()),
    });
  };

  const toggleMarked = async () => {
    if (!currentQuestion || timeUpRef.current) {
      return;
    }
    const nextMarked = !currentQuestion.is_marked_for_review;
    markAutosaveDirty();
    updateQuestion(currentQuestion.id, { is_marked_for_review: nextMarked });
    await saveAnswer(currentQuestion.id, { is_marked_for_review: nextMarked });
  };

  useExamShortcuts(session?.status === "in_progress", timeUpRef, {
    onPrevious: () => void goToQuestion(currentQuestionIndex - 1),
    onNext: () => void goToQuestion(currentQuestionIndex + 1),
    onToggleFlag: () => void toggleMarked(),
  });

  const uploadPendingSnapshots = (sessionId: number) => uploadEvidenceSnapshots(sessionId, enqueueSessionMutation);

  const handleSubmit = async (options: { auto?: boolean } = {}) => {
    if (!session) {
      return;
    }

    setIsSubmitting(true);
    setShowSubmitConfirm(false);
    try {
      if (timeUpRef.current) {
        // Het gio: server co the da tu choi cau tra loi moi -> khong de loi nay chan viec nop bai.
        await persistEssayAnswer().catch(() => undefined);
      } else {
        await persistEssayAnswer();
      }
      
      // Try to sync any remaining local answers first
      try {
        await syncLocalDraftQueue(session.id, () => {
          void refreshPendingSyncCount();
        });
        await refreshPendingSyncCount();
      } catch (syncErr) {
        console.error("Failed to sync queue during final submit", syncErr);
      }

      // Nop bai len server TRUOC de dam bao khong mat bai lam
      const response = await enqueueSessionMutation(() =>
        apiRequest<SubmissionSummary>(`/api/v1/exam-sessions/${session.id}/submit/`, {
          method: "POST",
          ...(options.auto ? { body: { auto_submit: true } } : {}),
        }),
      );
      setSession((current) => applySubmission(current, response));
      notify.success(t("examSession.submitSuccess"));
      setShowBackupModal(false);

      // Tải ảnh vi phạm len sau khi da nop bai thanh cong (chay bat dong bo)
      const currentSessionId = session.id;
      setTimeout(() => {
        void uploadPendingSnapshots(currentSessionId).catch((err) => {
          console.error("Failed to upload pending evidence snapshots", err);
        });
      }, getEvidenceUploadDelayMs());

    } catch (submitError) {
      console.error("Final submit failed. Opening recovery modal.", submitError);
      setShowBackupModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadBackup = () => {
    if (!session) return;
    try {
      downloadJsonFile(buildBackupJson(session, examId), backupFileName(session));
      notify.success(t("examSession.downloadedSuccess"));
    } catch (err) {
      console.error(err);
      notify.error("Could not download backup file.");
    }
  };

  const handleCopyBackup = () => {
    if (!session) return;
    try {
      navigator.clipboard.writeText(buildBackupText(session, examId));
      notify.success(t("examSession.copiedSuccess"));
    } catch (err) {
      console.error(err);
      notify.error("Could not copy answers.");
    }
  };

  const handleRetrySubmit = async () => {
    if (!session || isRetryingSubmit) return;
    setIsRetryingSubmit(true);
    try {
      await syncLocalDraftQueue(session.id, () => {
        void refreshPendingSyncCount();
      });
      await refreshPendingSyncCount();
      const response = await enqueueSessionMutation(() =>
        apiRequest<SubmissionSummary>(`/api/v1/exam-sessions/${session.id}/submit/`, {
          method: "POST",
        }),
      );
      setSession((current) => applySubmission(current, response));
      notify.success(t("examSession.submitSuccess"));
      setShowBackupModal(false);
      
      const currentSessionId = session.id;
      setTimeout(() => {
        void uploadPendingSnapshots(currentSessionId).catch((err) => {
          console.error("Failed to upload pending evidence snapshots", err);
        });
      }, getEvidenceUploadDelayMs());
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : t("examSession.submitUnavailable");
      notify.error(`${t("examSession.submitUnavailable")} (${message})`);
    } finally {
      setIsRetryingSubmit(false);
    }
  };

  const confirmSubmit = () => {
    if (!session || isSubmitting) {
      return;
    }
    setShowSubmitConfirm(true);
  };

  const jumpToUnansweredQuestion = (index: number) => {
    setShowSubmitConfirm(false);
    void goToQuestion(index);
  };

  useEffect(() => {
    if (!isTimeUp || !session) {
      return;
    }
    // Vua het gio: day not cau tra loi con xep hang (server con nhan trong vai chuc giay).
    setShowSubmitConfirm(false);
    void persistEssayAnswer().catch(() => undefined);
    void syncLocalDraftQueue(session.id, () => {
      void refreshPendingSyncCount();
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimeUp, session?.id]);

  useEffect(() => {
    if (!isTimeUp || graceRemaining !== 0 || autoSubmitTriggeredRef.current || isSubmitting) {
      return;
    }
    // Het ca thoi gian an han: tu nop (server ghi nhan nop muon).
    autoSubmitTriggeredRef.current = true;
    void handleSubmit({ auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimeUp, graceRemaining, isSubmitting]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !session || !currentQuestion) {
    return <UnavailableScreen error={error} />;
  }

  // Het gio: bo qua buoc thiet lap giam sat de thi sinh (vd. vua tai lai trang) van bam nop duoc.
  if (session.status !== "submitted" && session.enable_proctoring && !proctoringReady && !isTimeUp) {
    return (
      <ProctoringSetupScreen
        blockReason={proctoringBlockReason}
        previewStream={localPreviewStream}
        previewRef={setupPreviewRef}
        isPending={isProctoringSetupPending}
        onBegin={() => void beginProtectedExam()}
      />
    );
  }

  if (session.status === "submitted") {
    return <SubmittedScreen session={session} locale={locale} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {!isFullscreen && session?.enable_proctoring && !isTimeUp ? (
        <FullscreenExitOverlay onReturn={() => void ensureFullscreenMode()} />
      ) : null}
      <ExamHeader
        examName={session.exam_name}
        currentIndex={currentQuestionIndex}
        totalQuestions={session.questions.length}
        attemptNumber={session.attempt_number}
        connectionStatus={connectionStatus}
        pendingSyncCount={pendingSyncCount}
        lastSavedAt={lastSavedAt}
        timeRemaining={timeRemaining}
        locale={locale}
        isSubmitting={isSubmitting}
        onSubmit={() => void confirmSubmit()}
      />

      <div className="flex-1 p-4 sm:p-6">
        {isSyncFailed && (
          <SyncErrorBanner
            pendingSyncCount={pendingSyncCount}
            isSyncing={isManualSyncing}
            onSync={() => void handleManualSync()}
          />
        )}
        <div className="mx-auto grid gap-6 max-w-7xl grid-cols-1 lg:grid-cols-4">
          <div className="lg:col-span-3">
            {latestViolationNotice ? <ViolationNoticeBanner notice={latestViolationNotice} locale={locale} /> : null}
            <QuestionPanel
              question={currentQuestion}
              index={currentQuestionIndex}
              totalQuestions={session.questions.length}
              onToggleMarked={() => void toggleMarked()}
              onEssayChange={handleEssayChange}
              onEssayBlur={() => void persistEssayAnswer()}
              onOptionChange={(value) => void handleOptionChange(value)}
              onPrevious={() => void goToQuestion(currentQuestionIndex - 1)}
              onNext={() => void goToQuestion(currentQuestionIndex + 1)}
            />
          </div>

          <div className="lg:col-span-1">
            <QuestionNavigator
              questions={session.questions}
              currentIndex={currentQuestionIndex}
              answeredCount={answeredCount}
              markedCount={markedCount}
              isSaving={isSaving}
              enableProctoring={session.enable_proctoring}
              proctoringReady={proctoringReady}
              previewStream={localPreviewStream}
              previewRef={examPreviewRef}
              onSelect={(index) => void goToQuestion(index)}
            />
          </div>
        </div>
      </div>

      {isTimeUp ? (
        <TimeUpDialog
          graceSeconds={session.submission_grace_seconds ?? 300}
          graceRemaining={graceRemaining}
          answeredCount={answeredCount}
          totalQuestions={session.questions.length}
          unansweredCount={unansweredIndexes.length}
          isSubmitting={isSubmitting}
          onSubmit={() => void handleSubmit()}
        />
      ) : null}

      {showSubmitConfirm && !isTimeUp ? (
        <SubmitConfirmDialog
          totalQuestions={session.questions.length}
          answeredCount={answeredCount}
          markedCount={markedCount}
          unansweredIndexes={unansweredIndexes}
          questionIds={session.questions.map((question) => question.id)}
          isSubmitting={isSubmitting}
          onJump={jumpToUnansweredQuestion}
          onCancel={() => setShowSubmitConfirm(false)}
          onConfirm={() => void handleSubmit()}
        />
      ) : null}

      {showBackupModal && (
        <BackupRecoveryModal
          sessionId={session.id}
          examId={session.exam_id ?? examId}
          isRetrying={isRetryingSubmit}
          onDownload={handleDownloadBackup}
          onCopy={handleCopyBackup}
          onClose={() => setShowBackupModal(false)}
          onRetry={() => void handleRetrySubmit()}
        />
      )}
    </div>
  );
}
