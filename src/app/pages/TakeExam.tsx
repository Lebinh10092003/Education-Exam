import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { notify } from "../lib/notify";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Wifi,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { buildWsUrl } from "../lib/env";
import { apiRequest } from "../lib/http";
import {
  captureTrackSnapshot,
  requestProctoringStreams,
  type ProctoringCaptureResources,
} from "../lib/proctoringCapture";
import {
  connectCandidatePublisher,
  disconnectRoom,
  recordProctoringEvent,
  reportMediaStatus,
  requestPublishToken,
  uploadProctorEvidence,
  type ConnectedMediaRoom,
  type ProctorEventResponse,
} from "../lib/proctoringMedia";
import {
  clearSessionSnapshots,
  compressSnapshotForUpload,
  getTopViolationSnapshots,
  saveSnapshotLocally,
} from "../lib/snapshotStore";
import { getStoredTokens } from "../lib/storage";

interface SessionQuestion {
  id: number;
  sort_order: number;
  points: string;
  question_text: string;
  question_type: string;
  difficulty: string;
  options: Array<{
    key: string;
    text: string;
    sort_order: number;
  }>;
  selected_option_keys: string[];
  answer_text: string;
  is_answered: boolean;
  is_marked_for_review: boolean;
}

interface CandidateSession {
  id: number;
  exam_id: number;
  exam_name: string;
  subject: {
    id: number;
    name: string;
    code: string;
    color: string;
  };
  status: string;
  attempt_number: number;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  show_results_immediately: boolean;
  enable_proctoring: boolean;
  remaining_seconds: number;
  objective_score: string;
  max_score: string;
  manual_grading_required: boolean;
  answered_count: number;
  marked_count: number;
  total_questions: number;
  questions: SessionQuestion[];
}

interface SessionAnswerResponse {
  session_question: number;
  selected_option_keys: string[];
  answer_text: string;
  is_answered: boolean;
  is_marked_for_review: boolean;
  updated_at: string;
}

interface AutosaveResponse {
  id: number | null;
  answered_count: number;
  marked_count: number;
  payload: Record<string, unknown>;
  created_at: string;
}

interface SubmissionSummary {
  id: number;
  status: string;
  submitted_at: string;
  objective_score: string;
  max_score: string;
  manual_grading_required: boolean;
}

type ConnectionStatus = "stable" | "offline" | "unstable";
type ViolationNotice = {
  severity: "warning" | "critical";
  message: string;
  occurredAt: string;
};

type NavigatorConnectionInfo = {
  effectiveType?: string;
  rtt?: number;
};

const HEARTBEAT_INTERVAL_MS = 60_000;
const AUTOSAVE_INTERVAL_MS = 120_000;
const ESSAY_AUTOSAVE_DELAY_MS = 25_000;
const DEGRADED_CONNECTION_RTT_MS = 1_500;

const formatTime = (seconds: number) => {
  const clampedSeconds = Math.max(0, seconds);
  const hours = Math.floor(clampedSeconds / 3600);
  const minutes = Math.floor((clampedSeconds % 3600) / 60);
  const secs = clampedSeconds % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const normalizeCandidateLocale = (locale: string) => (locale.toLowerCase().startsWith("vi") ? "vi-VN" : "en-GB");

const formatDateTime = (value: string, locale: string) =>
  new Intl.DateTimeFormat(normalizeCandidateLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const assignPreviewStream = (
  element: (HTMLVideoElement & { srcObject?: MediaStream | null }) | null,
  stream: MediaStream | null,
) => {
  if (!element) {
    return;
  }
  element.srcObject = stream;
};

const getNavigatorConnectionInfo = () =>
  (navigator as Navigator & { connection?: NavigatorConnectionInfo }).connection;

const getCandidateConnectionStatus = (failedHeartbeatCount: number): ConnectionStatus => {
  if (!navigator.onLine) {
    return "offline";
  }

  if (failedHeartbeatCount > 0) {
    return "unstable";
  }

  const connectionInfo = getNavigatorConnectionInfo();
  if (
    connectionInfo?.effectiveType === "slow-2g"
    || connectionInfo?.effectiveType === "2g"
    || (typeof connectionInfo?.rtt === "number" && connectionInfo.rtt >= DEGRADED_CONNECTION_RTT_MS)
  ) {
    return "unstable";
  }

  return "stable";
};

const parseLiveRequestEnabled = (value: boolean | string | undefined) =>
  value === true || value === "1" || value === "true";

export function TakeExam() {
  const { t, i18n } = useTranslation("common");
  const { id } = useParams();
  const navigate = useNavigate();
  const examId = Number(id);
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [session, setSession] = useState<CandidateSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proctoringBlockReason, setProctoringBlockReason] = useState<string | null>(null);
  const [proctoringReady, setProctoringReady] = useState(false);
  const [isProctoringSetupPending, setIsProctoringSetupPending] = useState(false);
  const [localPreviewStream, setLocalPreviewStream] = useState<MediaStream | null>(null);
  const [latestViolationNotice, setLatestViolationNotice] = useState<ViolationNotice | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    navigator.onLine ? "stable" : "offline",
  );
  const [controlSocketRevision, setControlSocketRevision] = useState(0);
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
  const controlSocketRef = useRef<WebSocket | null>(null);
  const controlReconnectTimeoutRef = useRef<number | null>(null);
  const setupPreviewRef = useRef<HTMLVideoElement | null>(null);
  const examPreviewRef = useRef<HTMLVideoElement | null>(null);
  const screenEndedHandlerRef = useRef<(() => void) | null>(null);
  const violationCapturePendingRef = useRef(false);

  const enqueueSessionMutation = async <T,>(task: () => Promise<T>) => {
    const previous = requestQueueRef.current;
    let releaseCurrent = () => undefined;
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

  const clearControlReconnectTimeout = () => {
    if (controlReconnectTimeoutRef.current !== null) {
      window.clearTimeout(controlReconnectTimeoutRef.current);
      controlReconnectTimeoutRef.current = null;
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
    payload: Partial<{
      selected_option_keys: string[];
      answer_text: string;
      is_marked_for_review: boolean;
    }>,
  ) => {
    if (!session) {
      return;
    }

    setIsSaving(true);
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
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : t("examSession.saveAnswerError");
      notify.error(message);
      throw saveError;
    } finally {
      setIsSaving(false);
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
    clearControlReconnectTimeout();
    if (controlSocketRef.current) {
      controlSocketRef.current.close();
      controlSocketRef.current = null;
    }
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

  /**
   * Chup anh vi pham va LUU VAO LOCAL (IndexedDB) - khong upload ngay.
   * Viec upload se duoc thuc hien khi nop bai (chi top-3 snapshot).
   */
  const captureViolationEvidence = async (
    event: ProctorEventResponse,
    message: string,
    severity: "critical" | "warning" | "info",
  ) => {
    if (!session) {
      return;
    }

    const captureResources = captureResourcesRef.current;
    if (!captureResources) {
      return;
    }

    const capturedAt = new Date().toISOString();

    // Chup webcam -> luu local (JPEG chat luong cao, chua nen)
    try {
      const webcamBlob = await captureTrackSnapshot(captureResources.webcamTrack, {
        maxWidth: 1280,
        mimeType: "image/jpeg",
        quality: 0.85,
      });
      await saveSnapshotLocally({
        sessionId: session.id,
        eventId: event.id,
        evidenceType: "webcam_snapshot",
        severity,
        blob: webcamBlob,
        message,
        capturedAt,
      });
    } catch {
      // Neu khong chup duoc webcam, bo qua (khong de loi nay chan nop bai)
    }

    // Chup man hinh -> luu local
    if (captureResources.screenTrack && captureResources.screenTrack.readyState !== "ended") {
      try {
        const screenBlob = await captureTrackSnapshot(captureResources.screenTrack, {
          maxWidth: 1280,
          mimeType: "image/jpeg",
          quality: 0.85,
        });
        await saveSnapshotLocally({
          sessionId: session.id,
          eventId: event.id,
          evidenceType: "screen_capture",
          severity,
          blob: screenBlob,
          message,
          capturedAt,
        });
      } catch {
        // Neu khong chup duoc man hinh, bo qua
      }
    }
  };

  const reportViolation = async (
    eventType: string,
    severity: "info" | "warning" | "critical",
    message: string,
  ) => {
    if (!session || violationCapturePendingRef.current) {
      return;
    }

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
      setSession(nextSession);
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
    assignPreviewStream(
      setupPreviewRef.current as (HTMLVideoElement & { srcObject?: MediaStream | null }) | null,
      localPreviewStream,
    );
    assignPreviewStream(
      examPreviewRef.current as (HTMLVideoElement & { srcObject?: MediaStream | null }) | null,
      localPreviewStream,
    );
    return () => {
      assignPreviewStream(
        setupPreviewRef.current as (HTMLVideoElement & { srcObject?: MediaStream | null }) | null,
        null,
      );
      assignPreviewStream(
        examPreviewRef.current as (HTMLVideoElement & { srcObject?: MediaStream | null }) | null,
        null,
      );
    };
  }, [localPreviewStream, proctoringReady]);

  useEffect(() => {
    if (session?.status === "submitted") {
      void cleanupProctoringResources();
    }
  }, [session?.status]);

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
        captureResources = await requestProctoringStreams();
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

  useEffect(() => {
    if (!session || session.status !== "in_progress") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTimeRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [session?.id, session?.status]);

  useEffect(() => {
    const tokens = getStoredTokens();
    if (
      !session
      || !session.enable_proctoring
      || session.status !== "in_progress"
      || !proctoringReady
      || !tokens?.access
    ) {
      clearControlReconnectTimeout();
      if (controlSocketRef.current) {
        controlSocketRef.current.close();
        controlSocketRef.current = null;
      }
      return;
    }

    let isActive = true;
    const scheduleReconnect = () => {
      if (!isActive || controlReconnectTimeoutRef.current !== null) {
        return;
      }
      controlReconnectTimeoutRef.current = window.setTimeout(() => {
        controlReconnectTimeoutRef.current = null;
        if (!isActive) {
          return;
        }
        setControlSocketRevision((current) => current + 1);
      }, 3000);
    };

    const websocket = new WebSocket(
      buildWsUrl(`/ws/proctoring/sessions/${session.id}/control/?token=${tokens.access}`),
    );
    controlSocketRef.current = websocket;

    websocket.onopen = () => {
      clearControlReconnectTimeout();
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as {
          type?: string;
          payload?: { enabled?: boolean | string };
        };
        if (message.type !== "live_request") {
          return;
        }
        const enabled = parseLiveRequestEnabled(message.payload?.enabled);
        void syncRequestedLiveState(enabled);
      } catch {
        // Ignore malformed control payloads and wait for the next update.
      }
    };

    websocket.onerror = () => {
      scheduleReconnect();
    };

    websocket.onclose = () => {
      if (!isActive) {
        return;
      }
      scheduleReconnect();
    };

    return () => {
      isActive = false;
      if (controlSocketRef.current === websocket) {
        controlSocketRef.current = null;
      }
      websocket.close();
    };
  }, [
    proctoringReady,
    session?.enable_proctoring,
    session?.id,
    session?.status,
    controlSocketRevision,
  ]);

  useEffect(() => {
    if (!session || session.status !== "in_progress") {
      return;
    }

    if (session.enable_proctoring && !proctoringReady) {
      return;
    }

    const autosave = () => {
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
      }
    };

    const handleFullscreenChange = () => {
      if (session.enable_proctoring && document.fullscreenEnabled && !document.fullscreenElement) {
        void reportViolation("fullscreen_exit", "warning", t("examSession.fullscreenExitWarning"));
      }
    };

    const handleOnline = () => setConnectionStatus("unstable");
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
    if (!currentQuestion) {
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
    if (!currentQuestion) {
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
    if (!currentQuestion) {
      return;
    }
    const nextMarked = !currentQuestion.is_marked_for_review;
    markAutosaveDirty();
    updateQuestion(currentQuestion.id, { is_marked_for_review: nextMarked });
    await saveAnswer(currentQuestion.id, { is_marked_for_review: nextMarked });
  };

  /**
   * Upload top-3 snapshot vi pham (theo severity) len server truoc khi nop bai.
   * Moi snapshot duoc nen tu JPEG 0.85 -> WebP 0.6 de giam tai duong truyen.
   * Sau khi upload xong, toan bo snapshot local duoc xoa.
   */
  const uploadPendingSnapshots = async (sessionId: number) => {
    const MAX_UPLOADS = 3;
    let snapshots;
    try {
      snapshots = await getTopViolationSnapshots(sessionId, MAX_UPLOADS);
    } catch {
      // Neu IndexedDB loi, bo qua upload (khong chặn nop bai)
      return;
    }

    for (const entry of snapshots) {
      try {
        // Nen anh truoc khi upload (WebP 0.6 - nhe hon ~60%)
        const compressed = await compressSnapshotForUpload(entry.blob);
        await enqueueSessionMutation(() =>
          uploadProctorEvidence(
            entry.sessionId,
            entry.eventId,
            entry.evidenceType,
            compressed,
            { message: entry.message, compressed: true, original_size: entry.blob.size },
          ),
        );
      } catch {
        // Neu upload that bai, tiep tuc voi snapshot tiep theo
      }
    }

    // Don dep IndexedDB sau khi upload xong
    try {
      await clearSessionSnapshots(sessionId);
    } catch {
      // Loi don dep khong quan trong, bo qua
    }
  };

  const handleSubmit = async () => {
    if (!session) {
      return;
    }

    setIsSubmitting(true);
    try {
      await persistEssayAnswer();
      // Upload top-3 snapshot vi pham truoc khi nop bai
      await uploadPendingSnapshots(session.id);
      const response = await enqueueSessionMutation(() =>
        apiRequest<SubmissionSummary>(`/api/v1/exam-sessions/${session.id}/submit/`, {
          method: "POST",
        }),
      );
      setSession((current) =>
        current
          ? {
              ...current,
              status: response.status,
              submitted_at: response.submitted_at,
              objective_score: response.objective_score,
              max_score: response.max_score,
              manual_grading_required: response.manual_grading_required,
            }
          : current,
      );
      notify.success(t("examSession.submitSuccess"));
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : t("examSession.submitUnavailable");
      notify.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmSubmit = async () => {
    if (!session) {
      return;
    }

    const confirmed = await notify.confirm({
      title: t("examSession.confirmSubmitTitle"),
      html: `
        <div style="text-align:left">
          <p style="margin:0 0 12px;">${t("examSession.confirmSubmitDescription")}</p>
          <div style="display:grid;gap:8px;">
            <div><strong>${t("examSession.confirmSubmitTotalQuestions")}:</strong> ${session.questions.length}</div>
            <div><strong>${t("examSession.confirmSubmitAnswered")}:</strong> ${answeredCount}</div>
            <div><strong>${t("examSession.confirmSubmitUnanswered")}:</strong> ${session.questions.length - answeredCount}</div>
            ${markedCount > 0 ? `<div><strong>${t("examSession.confirmSubmitMarked")}:</strong> ${markedCount}</div>` : ""}
          </div>
        </div>
      `,
      confirmText: t("examSession.submitExam"),
      cancelText: t("examSession.goBack"),
      confirmButtonColor: "#2563eb",
    });

    if (!confirmed) {
      return;
    }

    await handleSubmit();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">{t("examSession.loading")}</p>
      </div>
    );
  }

  if (error || !session || !currentQuestion) {
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

  if (session.status !== "submitted" && session.enable_proctoring && !proctoringReady) {
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
            </div>

            {proctoringBlockReason ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {proctoringBlockReason}
              </div>
            ) : null}

            {localPreviewStream ? (
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
                    ref={setupPreviewRef}
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
              <Button onClick={() => void beginProtectedExam()} disabled={isProctoringSetupPending}>
                {isProctoringSetupPending
                  ? t("examSession.startMonitoring")
                  : localPreviewStream
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

  if (session.status === "submitted") {
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-bold text-lg text-gray-900">{session.exam_name}</h1>
            <p className="text-sm text-gray-600">
              {t("examSession.questionAttemptLine", {
                current: currentQuestionIndex + 1,
                total: session.questions.length,
                attempt: session.attempt_number,
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
              <CheckCircle2 className={`w-4 h-4 ${lastSavedAt ? "text-green-600" : "text-gray-400"}`} />
              <span className="text-sm text-gray-600">
                {lastSavedAt
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

            <Button className="w-full sm:w-auto" onClick={() => void confirmSubmit()} disabled={isSubmitting}>
              {t("examSession.submitExam")}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 sm:p-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            {latestViolationNotice ? (
              <div
                className={`mb-4 rounded-xl border px-4 py-4 text-sm ${
                  latestViolationNotice.severity === "critical"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {latestViolationNotice.severity === "critical"
                        ? t("examSession.criticalAlertRecorded")
                        : t("examSession.warningAlertRecorded")}
                    </p>
                    <p className="mt-1">{latestViolationNotice.message}</p>
                    <p className="mt-2 text-xs opacity-80">
                      {t("examSession.recordedAt", {
                        time: formatDateTime(latestViolationNotice.occurredAt, locale),
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            <Card>
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                  <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-gray-900">
                          {t("examSession.questionHeading", { number: currentQuestionIndex + 1 })}
                        </h2>
                        <Badge variant="outline">{currentQuestion.difficulty}</Badge>
                        <Badge variant="outline">{currentQuestion.question_type.replace(/_/g, " ")}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">{t("examSession.points", { points: currentQuestion.points })}</p>
                    </div>
                    <Button variant="outline" size="sm" className="w-full gap-2 sm:w-auto" onClick={() => void toggleMarked()}>
                      <Flag className="w-4 h-4" />
                      {currentQuestion.is_marked_for_review ? t("examSession.unmark") : t("examSession.markForReview")}
                    </Button>
                  </div>
                  <p className="text-base leading-relaxed text-gray-800 sm:text-lg">{currentQuestion.question_text}</p>
                </div>

                {currentQuestion.question_type === "essay" ? (
                  <Textarea
                    rows={10}
                    value={currentQuestion.answer_text}
                    onChange={(event) => handleEssayChange(event.target.value)}
                    onBlur={() => void persistEssayAnswer()}
                    placeholder={t("examSession.answerPlaceholder")}
                  />
                ) : (
                  <div className="space-y-3">
                    <RadioGroup
                      value={currentQuestion.selected_option_keys[0] ?? undefined}
                      onValueChange={(value) => void handleOptionChange(value)}
                    >
                      {currentQuestion.options.map((option, index) => {
                        const isSelected = currentQuestion.selected_option_keys.includes(option.key);
                        return (
                          <label
                            key={option.key}
                            className={`flex items-start gap-4 rounded-lg border-2 p-4 transition-colors ${
                              isSelected
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            <RadioGroupItem value={option.key} id={`option-${option.key}`} />
                            <Label htmlFor={`option-${option.key}`} className="flex-1 cursor-pointer text-base">
                              <span className="font-medium text-gray-700 mr-2">{String.fromCharCode(65 + index)}.</span>
                              {option.text}
                            </Label>
                          </label>
                        );
                      })}
                    </RadioGroup>
                  </div>
                )}

                <div className="mt-8 flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <Button className="w-full sm:w-auto" variant="outline" onClick={() => void goToQuestion(currentQuestionIndex - 1)} disabled={currentQuestionIndex === 0}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    {t("examSession.previous")}
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => void goToQuestion(currentQuestionIndex + 1)}
                    disabled={currentQuestionIndex === session.questions.length - 1}
                  >
                    {t("examSession.next")}
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-24">
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 mb-4">{t("examSession.questionNavigator")}</h3>

                {session.enable_proctoring ? (
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
                      {proctoringReady && localPreviewStream ? (
                        <video
                          ref={examPreviewRef}
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
                      {answeredCount}/{session.questions.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{t("examSession.marked")}:</span>
                    <span className="font-semibold text-orange-600">{markedCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{t("examSession.unanswered")}:</span>
                    <span className="font-semibold text-red-600">
                      {session.questions.length - answeredCount}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {session.questions.map((question, index) => (
                    <button
                      key={question.id}
                      onClick={() => void goToQuestion(index)}
                      className={`aspect-square rounded-lg flex items-center justify-center text-sm font-semibold transition-all relative ${
                        currentQuestionIndex === index
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
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

    </div>
  );
}
