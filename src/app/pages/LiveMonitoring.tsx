import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { RoomEvent } from "livekit-client";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Globe,
  Pause,
  Play,
  RefreshCw,
  Search,
  Shield,
  Users,
  Video,
  Wifi,
  XCircle,
} from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { cn } from "../components/ui/utils";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";
import { buildWsUrl } from "../lib/env";
import { apiRequest, isApiError, type PaginatedResponse } from "../lib/http";
import { notify } from "../lib/notify";
import {
  connectViewerRoom,
  disconnectRoom,
  requestViewToken,
  stopViewToken,
  type ConnectedMediaRoom,
} from "../lib/proctoringMedia";
import { getStoredTokens } from "../lib/storage";
import { exportViolationHistoryExcel } from "./liveMonitoringExport";
import {
  ALERTS_PAGE_SIZE,
  CANDIDATE_CONNECTION_FILTER_OPTIONS,
  CANDIDATES_PAGE_SIZE,
  HISTORY_PAGE_SIZE,
  clampPage,
  filterAlerts,
  filterCandidateStatuses,
  formatDate,
  formatEvidenceLabel,
  formatMinutes,
  getEvidenceCardTitle,
  getScreenStatusText,
  getWebcamStatusText,
  paginateItems,
  parseMonitoringTab,
  parsePositiveInt,
  type CandidateMonitoringStatus,
  type LiveViewState,
  type MonitoringSnapshot,
  type ProctoredExamDetail,
  type ViolationCaseRecord,
} from "./liveMonitoringShared";

type LivekitTrackLike = {
  kind?: string;
  attach?: () => HTMLElement;
};

type LivekitTrackPublicationLike = {
  isSubscribed?: boolean;
  track?: LivekitTrackLike;
};

type LivekitParticipantLike = {
  trackPublications?: Map<string, LivekitTrackPublicationLike>;
};

type LivekitRoomLike = ConnectedMediaRoom & {
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
  remoteParticipants?: Map<string, LivekitParticipantLike>;
};

interface LiveMonitoringProps {
  examId?: number;
  embedded?: boolean;
}

const updateSearchParams = (
  current: URLSearchParams,
  updates: Record<string, string | null | undefined>,
) => {
  const next = new URLSearchParams(current);
  Object.entries(updates).forEach(([key, value]) => {
    if (!value || value === "all") {
      next.delete(key);
      return;
    }
    next.set(key, value);
  });
  return next;
};

const getConnectionTone = (value: string) => {
  if (value === "stable") {
    return "text-green-600";
  }
  if (value === "offline") {
    return "text-red-600";
  }
  return "text-yellow-600";
};

const updateCandidateStatusBySession = (
  snapshot: MonitoringSnapshot,
  sessionId: number,
  updater: (candidateStatus: CandidateMonitoringStatus) => CandidateMonitoringStatus,
): MonitoringSnapshot => ({
  ...snapshot,
  candidate_statuses: snapshot.candidate_statuses.map((candidateStatus) =>
    candidateStatus.session_id === sessionId ? updater(candidateStatus) : candidateStatus,
  ),
});

const appendAlertRecord = (
  snapshot: MonitoringSnapshot,
  alert: MonitoringSnapshot["alerts"][number],
): MonitoringSnapshot => ({
  ...snapshot,
  alerts: [alert, ...snapshot.alerts.filter((item) => item.id !== alert.id)].slice(0, 20),
});

const PaginationControls = ({
  label,
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
}: {
  label: string;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) => {
  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = totalItems === 0 ? 0 : Math.min(totalItems, rangeStart + pageSize - 1);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        {label}: <strong>{rangeStart}-{rangeEnd}</strong> of <strong>{totalItems}</strong>
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled>
          Page {totalItems === 0 ? 0 : page} / {Math.max(totalPages, 1)}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages || totalItems === 0}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const CaseDetailPanel = ({
  caseRecord,
  isLoading,
  error,
  onDismiss,
  onResolve,
}: {
  caseRecord: ViolationCaseRecord | null;
  isLoading: boolean;
  error: string | null;
  onDismiss: () => void;
  onResolve: () => void;
}) => {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        Loading violation detail...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!caseRecord) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        Select a violation case to inspect its summary and evidence.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Violation Case</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">{caseRecord.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{caseRecord.summary || "No summary provided."}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={caseRecord.severity} />
          <StatusBadge status={caseRecord.status} />
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Candidate</p>
          <p className="mt-1 font-medium text-slate-900">{caseRecord.candidate.full_name}</p>
          <p className="text-sm text-slate-600">{caseRecord.candidate.email}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Exam</p>
          <p className="mt-1 font-medium text-slate-900">{caseRecord.exam.name}</p>
          <p className="text-sm text-slate-600">{caseRecord.exam.subject_name}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Evidence</p>
          <p className="mt-1 font-medium text-slate-900">{caseRecord.evidence_ids.length} item(s)</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Resolved At</p>
          <p className="mt-1 font-medium text-slate-900">{formatDate(caseRecord.resolved_at)}</p>
        </div>
      </div>

      {caseRecord.evidence_items.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {caseRecord.evidence_items.map((evidence) => (
            <div key={evidence.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="space-y-2 border-b border-slate-200 px-3 py-3">
                <p className="font-medium text-slate-900">{getEvidenceCardTitle(evidence.evidence_type)}</p>
                {evidence.file_url && !evidence.deleted_at ? (
                  <a
                    aria-label={`${getEvidenceCardTitle(evidence.evidence_type)} source`}
                    className="flex items-center gap-2 text-xs text-sky-700 transition hover:text-sky-900"
                    href={evidence.file_url}
                    rel="noreferrer"
                    target="_blank"
                    title={evidence.file_url}
                  >
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{evidence.file_url}</span>
                  </a>
                ) : null}
              </div>
              {evidence.file_url && !evidence.deleted_at ? (
                <a href={evidence.file_url} rel="noreferrer" target="_blank">
                  <img
                    alt={formatEvidenceLabel(evidence.evidence_type)}
                    className="h-40 w-full object-cover"
                    src={evidence.file_url}
                  />
                </a>
              ) : (
                <div className="flex h-40 items-center justify-center bg-slate-100 text-center text-xs text-slate-500">
                  Evidence expired
                </div>
              )}
              <div className="space-y-1 px-3 py-3 text-xs text-slate-600">
                <p>{formatDate(evidence.captured_at)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No evidence uploaded for this case.
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">Resolution Notes</p>
        <p className="mt-2 text-sm text-slate-700">
          {caseRecord.resolution_notes || "No resolution notes have been added yet."}
        </p>
      </div>

      {caseRecord.status === "open" ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onDismiss}>
            Dismiss
          </Button>
          <Button onClick={onResolve}>Resolve</Button>
        </div>
      ) : null}
    </div>
  );
};

export function LiveMonitoring({ examId: examIdProp, embedded = false }: LiveMonitoringProps) {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const mutation = useMutationState();
  const resolvedExamId = examIdProp ?? Number(params.id);

  const monitorTab = parseMonitoringTab(searchParams.get("monitorTab"));
  const selectedCaseId = parsePositiveInt(searchParams.get("case"));
  const historyStatus = searchParams.get("historyStatus") ?? "all";
  const historySeverity = searchParams.get("historySeverity") ?? "all";
  const historySearch = searchParams.get("historySearch") ?? "";
  const historyPage = parsePositiveInt(searchParams.get("historyPage")) ?? 1;
  const debouncedHistorySearch = useDebouncedValue(historySearch, 300);

  const [socketState, setSocketState] = useState<"connecting" | "open" | "closed">("connecting");
  const [socketRevision, setSocketRevision] = useState(0);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [liveView, setLiveView] = useState<LiveViewState | null>(null);
  const [alertSearch, setAlertSearch] = useState("");
  const [alertSeverity, setAlertSeverity] = useState("all");
  const [alertPage, setAlertPage] = useState(1);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateStatusFilter, setCandidateStatusFilter] = useState("all");
  const [candidateConnectionFilter, setCandidateConnectionFilter] = useState("all");
  const [candidateWebcamFilter, setCandidateWebcamFilter] = useState("all");
  const [candidatePage, setCandidatePage] = useState(1);
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<ViolationCaseRecord | null>(null);
  const [selectedCaseLoading, setSelectedCaseLoading] = useState(false);
  const [selectedCaseError, setSelectedCaseError] = useState<string | null>(null);

  const [viewingSessionId, setViewingSessionId] = useState<number | null>(null);
  const [viewingSessionData, setViewingSessionData] = useState<any | null>(null);
  const [viewingSessionLoading, setViewingSessionLoading] = useState(false);
  const [viewingSessionError, setViewingSessionError] = useState<string | null>(null);

  const fetchSessionDetail = async (sessionId: number) => {
    setViewingSessionId(sessionId);
    setViewingSessionLoading(true);
    setViewingSessionError(null);
    setViewingSessionData(null);
    try {
      const data = await apiRequest<any>(`/api/v1/exam-sessions/${sessionId}/`);
      setViewingSessionData(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load exam sheet details.";
      setViewingSessionError(message);
      notify.error(message);
    } finally {
      setViewingSessionLoading(false);
    }
  };
  const liveRoomRef = useRef<ConnectedMediaRoom | null>(null);
  const liveStageRef = useRef<HTMLDivElement | null>(null);
  const attachedElementsRef = useRef<HTMLElement[]>([]);
  const pendingTrackRef = useRef<LivekitTrackLike | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const selectedSessionIdRef = useRef<number | null>(null);

  const updateMonitoringParams = (
    updates: Record<string, string | null | undefined>,
    replace = true,
  ) => {
    setSearchParams(updateSearchParams(searchParams, updates), { replace });
  };

  const snapshot = useAsyncList(
    async () => apiRequest<MonitoringSnapshot>(`/api/v1/proctoring/exams/${resolvedExamId}/monitoring/`),
    [resolvedExamId],
  );
  const exam = useAsyncList(
    async () => apiRequest<ProctoredExamDetail>(`/api/v1/exams/${resolvedExamId}/`),
    [resolvedExamId],
  );
  const caseHistory = useAsyncList(
    async () =>
      apiRequest<PaginatedResponse<ViolationCaseRecord>>("/api/v1/proctoring/cases/", {
        query: {
          exam: resolvedExamId,
          page: historyPage,
          page_size: HISTORY_PAGE_SIZE,
          search: debouncedHistorySearch || undefined,
          status: historyStatus !== "all" ? historyStatus : undefined,
          severity: historySeverity !== "all" ? historySeverity : undefined,
        },
      }),
    [resolvedExamId, historyPage, debouncedHistorySearch, historyStatus, historySeverity],
  );

  const caseResults = caseHistory.data?.results ?? [];
  const selectedCaseFromList = useMemo(
    () => caseResults.find((caseRecord) => caseRecord.id === selectedCaseId) ?? null,
    [caseResults, selectedCaseId],
  );

  const latestCaseIdBySession = useMemo(() => {
    const mapping = new Map<number, number>();
    (snapshot.data?.alerts ?? []).forEach((alert) => {
      if (alert.case_id && !mapping.has(alert.session_id)) {
        mapping.set(alert.session_id, alert.case_id);
      }
    });
    return mapping;
  }, [snapshot.data?.alerts]);

  const clearAttachedMedia = () => {
    attachedElementsRef.current.forEach((element) => element.remove());
    attachedElementsRef.current = [];
    pendingTrackRef.current = null;
    if (liveStageRef.current) {
      liveStageRef.current.replaceChildren();
    }
  };

  const attachTrackElement = (track: LivekitTrackLike) => {
    if (!track.attach || track.kind !== "video") {
      return;
    }
    if (!liveStageRef.current) {
      pendingTrackRef.current = track;
      return;
    }
    clearAttachedMedia();
    const element = track.attach();
    element.className = "h-full w-full rounded-2xl object-cover";
    if (element instanceof HTMLVideoElement) {
      element.autoplay = true;
      element.playsInline = true;
      element.controls = false;
    }
    liveStageRef.current.append(element);
    attachedElementsRef.current = [element];
  };

  const attachExistingTracks = (room: LivekitRoomLike) => {
    const remoteParticipants = room.remoteParticipants;
    if (!remoteParticipants) {
      return;
    }
    for (const participant of remoteParticipants.values()) {
      for (const publication of participant.trackPublications?.values() ?? []) {
        if (publication.isSubscribed && publication.track) {
          attachTrackElement(publication.track);
          return;
        }
      }
    }
  };

  const attachPendingOrExistingTrack = () => {
    if (!liveStageRef.current) {
      return;
    }
    if (pendingTrackRef.current) {
      const nextTrack = pendingTrackRef.current;
      pendingTrackRef.current = null;
      attachTrackElement(nextTrack);
      return;
    }
    const room = liveRoomRef.current as LivekitRoomLike | null;
    if (room) {
      attachExistingTracks(room);
    }
  };

  const cleanupLiveView = async (options?: { releaseServerView?: boolean; sessionId?: number | null }) => {
    if (options?.releaseServerView && options.sessionId) {
      await stopViewToken(options.sessionId).catch(() => undefined);
    }
    clearAttachedMedia();
    await disconnectRoom(liveRoomRef.current);
    liveRoomRef.current = null;
  };

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      void cleanupLiveView({ releaseServerView: true, sessionId: selectedSessionIdRef.current });
    };
  }, []);

  useEffect(() => {
    attachPendingOrExistingTrack();
  }, [liveView?.sessionId, liveView?.status]);

  useEffect(() => {
    if (!selectedCaseId) {
      setSelectedCaseDetail(null);
      setSelectedCaseError(null);
      setSelectedCaseLoading(false);
      return;
    }

    if (selectedCaseFromList) {
      setSelectedCaseDetail(selectedCaseFromList);
      setSelectedCaseError(null);
      setSelectedCaseLoading(false);
      return;
    }

    let isActive = true;
    setSelectedCaseLoading(true);
    setSelectedCaseError(null);
    void apiRequest<ViolationCaseRecord>(`/api/v1/proctoring/cases/${selectedCaseId}/`)
      .then((caseRecord) => {
        if (!isActive) {
          return;
        }
        if (caseRecord.exam.id !== resolvedExamId) {
          updateMonitoringParams({ case: null });
          setSelectedCaseDetail(null);
          return;
        }
        setSelectedCaseDetail(caseRecord);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }
        if (isApiError(error) && error.status === 404) {
          updateMonitoringParams({ case: null });
          setSelectedCaseDetail(null);
          setSelectedCaseError(null);
          return;
        }
        const message =
          error instanceof Error ? error.message : "Unable to load the selected violation detail.";
        setSelectedCaseError(message);
      })
      .finally(() => {
        if (isActive) {
          setSelectedCaseLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [resolvedExamId, selectedCaseFromList, selectedCaseId]);

  useEffect(() => {
    const tokens = getStoredTokens();
    if (!resolvedExamId || !tokens?.access) {
      setSocketState("closed");
      return;
    }

    let isActive = true;
    const scheduleReconnect = () => {
      if (!isActive || reconnectTimeoutRef.current !== null) {
        return;
      }
      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectTimeoutRef.current = null;
        if (!isActive) {
          return;
        }
        setSocketRevision((current) => current + 1);
      }, 3000);
    };

    const websocket = new WebSocket(
      buildWsUrl(`/ws/monitoring/exams/${resolvedExamId}/?token=${tokens.access}`),
    );
    setSocketState("connecting");

    websocket.onopen = () => {
      clearReconnectTimeout();
      setSocketState("open");
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as {
          type: string;
          payload: Record<string, unknown> | MonitoringSnapshot;
        };
        if (message.type === "snapshot") {
          snapshot.setData(message.payload as MonitoringSnapshot);
          return;
        }

        snapshot.setData((current) => {
          if (!current) {
            return current;
          }
          const payload = message.payload as Record<string, unknown>;
          switch (message.type) {
            case "heartbeat":
              return updateCandidateStatusBySession(current, Number(payload.session_id), (candidateStatus) => ({
                ...candidateStatus,
                connection_status: String(payload.connection_status ?? candidateStatus.connection_status),
                last_activity_at:
                  typeof payload.recorded_at === "string"
                    ? payload.recorded_at
                    : candidateStatus.last_activity_at,
              }));
            case "media_state":
              return updateCandidateStatusBySession(current, Number(payload.session_id), (candidateStatus) => ({
                ...candidateStatus,
                media: {
                  ...candidateStatus.media,
                  webcam_publish_status: String(
                    payload.webcam_publish_status ?? candidateStatus.media.webcam_publish_status,
                  ),
                  screen_capture_status: String(
                    payload.screen_capture_status ?? candidateStatus.media.screen_capture_status,
                  ),
                  last_publish_at: typeof payload.last_publish_at === "string" || payload.last_publish_at === null
                    ? payload.last_publish_at
                      : candidateStatus.media.last_publish_at,
                  live_request_enabled:
                    typeof payload.live_request_enabled === "boolean"
                      ? payload.live_request_enabled
                      : candidateStatus.media.live_request_enabled,
                  live_slot_active:
                    typeof payload.live_slot_active === "boolean"
                      ? payload.live_slot_active
                      : candidateStatus.media.live_slot_active,
                },
              }));
            case "client_capability":
              return updateCandidateStatusBySession(current, Number(payload.session_id), (candidateStatus) => ({
                ...candidateStatus,
                media: {
                  ...candidateStatus.media,
                  screen_capture_status: candidateStatus.media.screen_capture_status,
                },
              }));
            case "proctor_event":
              return appendAlertRecord(current, payload as unknown as MonitoringSnapshot["alerts"][number]);
            default:
              return current;
          }
        });
        if (message.type === "proctor_event" || message.type === "violation_case" || message.type === "evidence") {
          void caseHistory.reload().catch(() => undefined);
        }
      } catch {
        void snapshot.reload().catch(() => undefined);
      }
    };

    websocket.onerror = () => {
      if (!isActive) {
        return;
      }
      setSocketState("closed");
      scheduleReconnect();
    };

    websocket.onclose = () => {
      if (!isActive) {
        return;
      }
      setSocketState("closed");
      scheduleReconnect();
    };

    return () => {
      isActive = false;
      websocket.close();
    };
  }, [caseHistory.reload, resolvedExamId, snapshot.reload, socketRevision]);

  const filteredAlerts = useMemo(
    () =>
      filterAlerts(snapshot.data?.alerts ?? [], {
        search: alertSearch,
        severity: alertSeverity,
      }),
    [alertSearch, alertSeverity, snapshot.data?.alerts],
  );
  const paginatedAlerts = useMemo(
    () => paginateItems(filteredAlerts, alertPage, ALERTS_PAGE_SIZE),
    [alertPage, filteredAlerts],
  );

  const filteredCandidates = useMemo(
    () =>
      filterCandidateStatuses(snapshot.data?.candidate_statuses ?? [], {
        search: candidateSearch,
        status: candidateStatusFilter,
        connection: candidateConnectionFilter,
        webcam: candidateWebcamFilter,
      }),
    [
      candidateConnectionFilter,
      candidateSearch,
      candidateStatusFilter,
      candidateWebcamFilter,
      snapshot.data?.candidate_statuses,
    ],
  );
  const paginatedCandidates = useMemo(
    () => paginateItems(filteredCandidates, candidatePage, CANDIDATES_PAGE_SIZE),
    [candidatePage, filteredCandidates],
  );

  useEffect(() => {
    setAlertPage(1);
  }, [alertSearch, alertSeverity]);

  useEffect(() => {
    setCandidatePage(1);
  }, [candidateConnectionFilter, candidateSearch, candidateStatusFilter, candidateWebcamFilter]);

  useEffect(() => {
    const maxAlertPage = Math.max(1, Math.ceil(filteredAlerts.length / ALERTS_PAGE_SIZE));
    setAlertPage((current) => clampPage(current, maxAlertPage));
  }, [filteredAlerts.length]);

  useEffect(() => {
    const maxCandidatePage = Math.max(
      1,
      Math.ceil(filteredCandidates.length / CANDIDATES_PAGE_SIZE),
    );
    setCandidatePage((current) => clampPage(current, maxCandidatePage));
  }, [filteredCandidates.length]);

  const selectedCase = selectedCaseFromList ?? selectedCaseDetail;
  const data = snapshot.data;
  const examStatus = exam.data?.status ?? "open";

  const activeCandidateStatus = useMemo(() => {
    if (!liveView || !snapshot.data?.candidate_statuses) return null;
    return snapshot.data.candidate_statuses.find(
      (c) => c.session_id === liveView.sessionId
    ) ?? null;
  }, [liveView, snapshot.data?.candidate_statuses]);

  const hasViolationOrAlert = useMemo(() => {
    if (!liveView) return false;
    if (activeCandidateStatus) {
      if (activeCandidateStatus.connection_status === "offline") return true;
      if (activeCandidateStatus.media.webcam_publish_status === "failed") return true;
    }
    if (snapshot.data?.alerts) {
      return snapshot.data.alerts.some(
        (alert) => alert.session_id === liveView.sessionId && (alert.severity === "critical" || alert.severity === "warning")
      );
    }
    return false;
  }, [liveView, activeCandidateStatus, snapshot.data?.alerts]);

  const setMonitorTab = (value: string) => {
    updateMonitoringParams({ monitorTab: value });
  };

  const setHistoryFilter = (key: string, value: string) => {
    updateMonitoringParams({
      [key]: value,
      historyPage: "1",
    });
  };

  const updateExamStatus = async (nextStatus: "open" | "paused" | "closed") => {
    try {
      await mutation.run(() =>
        apiRequest(`/api/v1/exams/${resolvedExamId}/`, {
          method: "PATCH",
          body: { status: nextStatus },
        }),
      );
      notify.success(`Exam moved to ${nextStatus}.`);
      await Promise.all([exam.reload(), snapshot.reload()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update exam status.";
      notify.error(message);
    }
  };

  const refreshSelectedCase = async (caseId: number) => {
    try {
      const nextCase = await apiRequest<ViolationCaseRecord>(`/api/v1/proctoring/cases/${caseId}/`);
      setSelectedCaseDetail(nextCase);
      return nextCase;
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        updateMonitoringParams({ case: null });
        setSelectedCaseDetail(null);
        return null;
      }
      throw error;
    }
  };

  const resolveCase = async (caseRecord: ViolationCaseRecord, decision: "resolved" | "dismissed") => {
    try {
      await mutation.run(() =>
        apiRequest(`/api/v1/proctoring/cases/${caseRecord.id}/resolve/`, {
          method: "POST",
          body: { decision, notes: "" },
        }),
      );
      notify.success(`Case ${decision}.`);
      await caseHistory.reload();
      if (selectedCaseId === caseRecord.id) {
        await refreshSelectedCase(caseRecord.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update case.";
      notify.error(message);
    }
  };

  const openLiveView = async (candidateStatus: CandidateMonitoringStatus) => {
    if (!candidateStatus.session_id) {
      return;
    }

    try {
      const previousSessionId = selectedSessionId;
      setSelectedSessionId(candidateStatus.session_id);
      setLiveView({
        sessionId: candidateStatus.session_id,
        candidateName: candidateStatus.candidate.full_name,
        roomName: "",
        participantName: "",
        status: "connecting",
        error: null,
      });

      await cleanupLiveView({
        releaseServerView: previousSessionId !== null && previousSessionId !== candidateStatus.session_id,
        sessionId: previousSessionId,
      });

      const token = await requestViewToken(candidateStatus.session_id);
      const room = await connectViewerRoom(token);
      const roomLike = room as LivekitRoomLike;
      liveRoomRef.current = room;

      roomLike.on?.(RoomEvent.TrackSubscribed, (...args: unknown[]) => {
        const track = args[0] as LivekitTrackLike | undefined;
        if (track) {
          attachTrackElement(track);
        }
      });
      roomLike.on?.(RoomEvent.ParticipantConnected, () => {
        attachPendingOrExistingTrack();
      });
      roomLike.on?.(RoomEvent.Reconnected, () => {
        attachPendingOrExistingTrack();
      });
      roomLike.on?.(RoomEvent.TrackUnsubscribed, () => {
        clearAttachedMedia();
      });
      roomLike.on?.(RoomEvent.Disconnected, () => {
        setLiveView((current) =>
          current?.sessionId === candidateStatus.session_id
            ? { ...current, status: "error", error: "Candidate webcam stream disconnected." }
            : current,
        );
      });

      attachExistingTracks(roomLike);

      setLiveView({
        sessionId: candidateStatus.session_id,
        candidateName: candidateStatus.candidate.full_name,
        roomName: token.room_name,
        participantName: token.participant_name,
        status: "open",
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open candidate webcam.";
      await cleanupLiveView({ releaseServerView: true, sessionId: candidateStatus.session_id });
      setLiveView({
        sessionId: candidateStatus.session_id,
        candidateName: candidateStatus.candidate.full_name,
        roomName: "",
        participantName: "",
        status: "error",
        error: message,
      });
      notify.error(message);
    }
  };

  const closeLiveView = async () => {
    const sessionId = selectedSessionId;
    setSelectedSessionId(null);
    setLiveView(null);
    await cleanupLiveView({ releaseServerView: true, sessionId });
  };

  const openViolationCase = (caseId: number | null) => {
    if (!caseId) {
      return;
    }
    updateMonitoringParams({ case: String(caseId) }, false);
  };

  const closeViolationCase = () => {
    updateMonitoringParams({ case: null });
  };

  const exportHistory = async () => {
    try {
      await exportViolationHistoryExcel({
        examId: resolvedExamId,
        search: historySearch,
        severity: historySeverity,
        status: historyStatus,
      });
      notify.success("Violation history exported.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export violation history.";
      notify.error(message);
    }
  };

  const monitoringHeader = embedded ? (
    <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Exam Monitoring</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Proctoring Workspace</h2>
        <p className="mt-2 text-sm text-slate-600">
          Live operations for {data?.exam.name ?? "this exam"}, grouped by overview, alerts,
          candidates, and violation history.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link to={`/discipline/exams/${resolvedExamId}`}>
            <Shield className="mr-2 h-4 w-4" />
            Disciplinary Board
          </Link>
        </Button>
        <Button variant="outline" onClick={() => void snapshot.reload().catch(() => undefined)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Button
          variant="outline"
          onClick={() => void updateExamStatus(examStatus === "paused" ? "open" : "paused")}
        >
          {examStatus === "paused" ? (
            <>
              <Play className="mr-2 h-4 w-4" />
              Resume Exam
            </>
          ) : (
            <>
              <Pause className="mr-2 h-4 w-4" />
              Pause Exam
            </>
          )}
        </Button>
        <Button variant="destructive" onClick={() => void updateExamStatus("closed")}>
          <XCircle className="mr-2 h-4 w-4" />
          End Exam
        </Button>
      </div>
    </div>
  ) : (
    <PageHeader
      title="Live Exam Monitoring"
      description={
        data ? `${data.exam.name} • ${data.exam.subject_name}` : "Loading monitoring snapshot..."
      }
      action={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/discipline/exams/${resolvedExamId}`}>
              <Shield className="mr-2 h-4 w-4" />
              Disciplinary Board
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => void updateExamStatus(examStatus === "paused" ? "open" : "paused")}
          >
            {examStatus === "paused" ? (
              <>
                <Play className="mr-2 h-4 w-4" />
                Resume Exam
              </>
            ) : (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pause Exam
              </>
            )}
          </Button>
          <Button variant="destructive" onClick={() => void updateExamStatus("closed")}>
            <XCircle className="mr-2 h-4 w-4" />
            End Exam
          </Button>
        </div>
      }
    />
  );

  if (!resolvedExamId) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Exam id is required to open monitoring.
      </div>
    );
  }

  return (
    <div>
      {monitoringHeader}

      {snapshot.error || caseHistory.error || exam.error || mutation.error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {snapshot.error ?? caseHistory.error ?? exam.error ?? mutation.error}
        </div>
      ) : null}

      {exam.data && exam.data.enable_proctoring === false ? (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="px-5 py-4 text-sm text-amber-900">
            This exam does not have proctoring enabled. Monitoring is only available for protected
            exams.
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Wifi
            className={cn(
              "h-4 w-4",
              socketState === "open"
                ? "text-green-600"
                : socketState === "connecting"
                  ? "text-yellow-600"
                  : "text-red-600",
            )}
          />
          <span>
            Monitoring socket:{" "}
            <strong className="capitalize">
              {socketState === "open"
                ? "connected"
                : socketState === "connecting"
                  ? "connecting"
                  : "reconnecting"}
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={examStatus} />
          <Badge variant="outline">{data?.exam.subject_name ?? "Monitoring"}</Badge>
        </div>
      </div>

      <Tabs value={monitorTab} onValueChange={setMonitorTab} className="space-y-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-slate-100 p-2">
          <TabsTrigger value="overview" className="flex-none px-4">Overview</TabsTrigger>
          <TabsTrigger value="live-alerts" className="flex-none px-4">Live Alerts</TabsTrigger>
          <TabsTrigger value="candidate-status" className="flex-none px-4">Candidate Status</TabsTrigger>
          <TabsTrigger value="violation-history" className="flex-none px-4">Violation History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4">
            <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="mb-1 text-sm text-slate-600">Total Candidates</p><p className="text-3xl font-bold text-slate-900">{data?.total_candidates ?? 0}</p></div><div className="rounded-2xl bg-blue-100 p-4 text-blue-600"><Users className="h-6 w-6" /></div></div></CardContent></Card>
            <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="mb-1 text-sm text-slate-600">In Progress</p><p className="text-3xl font-bold text-blue-600">{data?.in_progress ?? 0}</p></div><div className="rounded-2xl bg-blue-100 p-4 text-blue-600"><Clock className="h-6 w-6" /></div></div></CardContent></Card>
            <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="mb-1 text-sm text-slate-600">Completed</p><p className="text-3xl font-bold text-green-600">{data?.completed ?? 0}</p></div><div className="rounded-2xl bg-green-100 p-4 text-green-600"><CheckCircle2 className="h-6 w-6" /></div></div></CardContent></Card>
            <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="mb-1 text-sm text-slate-600">Average Progress</p><p className="text-3xl font-bold text-slate-900">{data?.average_progress ?? 0}%</p></div><div className="rounded-2xl bg-purple-100 p-4 text-purple-600"><CheckCircle2 className="h-6 w-6" /></div></div></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-orange-600" />Recent Live Alerts</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setMonitorTab("live-alerts")}>Open Alert Tab</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.alerts ?? []).slice(0, 5).map((alert) => (
                  <div key={alert.id} className={cn("rounded-2xl border px-4 py-3", alert.severity === "critical" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50")}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{alert.candidate.full_name}</p>
                        <p className="mt-1 text-sm text-slate-700">{alert.message}</p>
                        <p className="mt-2 text-xs text-slate-500">{formatDate(alert.occurred_at)}</p>
                      </div>
                      <StatusBadge status={alert.severity} />
                    </div>
                    {alert.case_id ? <Button size="sm" variant="outline" className="mt-3" onClick={() => openViolationCase(alert.case_id)}>View Violation</Button> : null}
                  </div>
                ))}
                {!snapshot.isLoading && !(data?.alerts.length ?? 0) ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No live alerts for this exam.</div> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-sky-600" />Selected Webcam</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {liveView ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-medium text-slate-900">{liveView.candidateName}</p><p className="text-xs text-slate-500">{liveView.participantName || "Waiting for session metadata"}</p></div>
                      <StatusBadge status={liveView.status} />
                    </div>
                    <div ref={liveStageRef} className={cn(
                      "flex aspect-video items-center justify-center rounded-2xl border bg-slate-950 p-4 text-center text-sm text-slate-200 transition-all duration-300",
                      hasViolationOrAlert ? "proctor-alert-glow" : "border-slate-200"
                    )}>
                      {liveView.status === "connecting" ? <p>Connecting to webcam feed...</p> : liveView.error ? <p>{liveView.error}</p> : <p>Waiting for webcam track...</p>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void closeLiveView()}>Close Webcam</Button>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">Open a candidate webcam from the Candidate Status tab to observe them live here.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="live-alerts" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Live Alerts</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Search live alerts" className="pl-10" placeholder="Search by candidate, event, or message" value={alertSearch} onChange={(event) => setAlertSearch(event.target.value)} /></div>
                <Select value={alertSeverity} onValueChange={setAlertSeverity}><SelectTrigger><SelectValue placeholder="All severities" /></SelectTrigger><SelectContent><SelectItem value="all">All severities</SelectItem><SelectItem value="warning">Warning</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-3">
                {paginatedAlerts.items.map((alert) => (
                  <div key={alert.id} className={cn("rounded-2xl border bg-white p-4", alert.severity === "critical" ? "border-red-200" : "border-amber-200")}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-900">{alert.candidate.full_name}</p><StatusBadge status={alert.severity} /></div>
                        <p className="mt-2 text-sm text-slate-700">{alert.message}</p>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500"><span>{alert.candidate.email}</span><span>{formatDate(alert.occurred_at)}</span></div>
                      </div>
                      {alert.case_id ? <Button size="sm" variant="outline" onClick={() => openViolationCase(alert.case_id)}>View Violation</Button> : null}
                    </div>
                  </div>
                ))}
                {!snapshot.isLoading && !paginatedAlerts.totalItems ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">No live alerts matched the current filters.</div> : null}
              </div>
              <PaginationControls label="Alerts" page={paginatedAlerts.page} totalPages={paginatedAlerts.totalPages} totalItems={paginatedAlerts.totalItems} pageSize={ALERTS_PAGE_SIZE} onPageChange={setAlertPage} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="candidate-status" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Candidate Status</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Search candidates" className="pl-10" placeholder="Search candidate name or email" value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} /></div>
                <Select value={candidateStatusFilter} onValueChange={setCandidateStatusFilter}><SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="not_started">Not started</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="submitted">Submitted</SelectItem></SelectContent></Select>
                <Select value={candidateConnectionFilter} onValueChange={setCandidateConnectionFilter}><SelectTrigger><SelectValue placeholder="All connections" /></SelectTrigger><SelectContent>{CANDIDATE_CONNECTION_FILTER_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
                <Select value={candidateWebcamFilter} onValueChange={setCandidateWebcamFilter}><SelectTrigger><SelectValue placeholder="All webcams" /></SelectTrigger><SelectContent><SelectItem value="all">All webcams</SelectItem><SelectItem value="publishing">Live available</SelectItem><SelectItem value="not_live">Not live</SelectItem></SelectContent></Select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead><tr className="border-b border-slate-200"><th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Candidate</th><th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th><th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Progress</th><th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Time</th><th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Connection</th><th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Proctoring</th></tr></thead>
                  <tbody>
                    {paginatedCandidates.items.map((candidateStatus) => (
                      <tr key={candidateStatus.candidate.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3"><div><p className="font-medium text-slate-900">{candidateStatus.candidate.full_name}</p><p className="text-xs text-slate-500">{candidateStatus.candidate.email}</p></div></td>
                        <td className="px-4 py-3"><StatusBadge status={candidateStatus.status} /></td>
                        <td className="px-4 py-3"><div className="space-y-1"><div className="flex items-center gap-2"><Progress value={candidateStatus.progress_percentage} className="w-28" /><span className="text-xs text-slate-600">{candidateStatus.progress_percentage}%</span></div><p className="text-xs text-slate-500">{candidateStatus.questions_answered}/{candidateStatus.total_questions} questions</p></div></td>
                        <td className="px-4 py-3"><p className="text-sm text-slate-900">{formatMinutes(candidateStatus.time_elapsed_minutes)}</p><p className="text-xs text-slate-500">{formatDate(candidateStatus.last_activity_at)}</p></td>
                        <td className="px-4 py-3"><div className="flex items-center gap-2"><Wifi className={cn("h-4 w-4", getConnectionTone(candidateStatus.connection_status))} /><span className="text-xs capitalize text-slate-600">{candidateStatus.connection_status}</span></div></td>
                        <td className="px-4 py-3"><div className="space-y-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"><p className="font-medium text-slate-900">{getWebcamStatusText(candidateStatus.media.webcam_publish_status)}</p><p className="mt-1">{getScreenStatusText(candidateStatus.media.screen_capture_status)}</p><p className="mt-1 text-slate-500">Last webcam publish: {formatDate(candidateStatus.media.last_publish_at)}</p>{candidateStatus.media.live_request_enabled ? <p className="mt-1 text-sky-600">Live request is active.</p> : <p className="mt-1 text-slate-500">Webcam stays local until requested.</p>}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant={selectedSessionId === candidateStatus.session_id ? "secondary" : "outline"} disabled={!candidateStatus.session_id} onClick={() => void openLiveView(candidateStatus)}><Video className="mr-2 h-4 w-4" />Open Webcam</Button><Button size="sm" variant="outline" disabled={!candidateStatus.session_id} onClick={() => { if (candidateStatus.session_id) void fetchSessionDetail(candidateStatus.session_id); }}><FileText className="mr-2 h-4 w-4" />Xem bài thi</Button>{candidateStatus.session_id && latestCaseIdBySession.has(candidateStatus.session_id) ? <Button size="sm" variant="outline" onClick={() => openViolationCase(candidateStatus.session_id ? latestCaseIdBySession.get(candidateStatus.session_id) ?? null : null)}><AlertTriangle className="mr-2 h-4 w-4" />View Violation</Button> : null}</div></div></td>
                      </tr>
                    ))}
                    {!snapshot.isLoading && !paginatedCandidates.totalItems ? <tr><td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={6}>No candidates matched the current filters.</td></tr> : null}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <PaginationControls label="Candidates" page={paginatedCandidates.page} totalPages={paginatedCandidates.totalPages} totalItems={paginatedCandidates.totalItems} pageSize={CANDIDATES_PAGE_SIZE} onPageChange={setCandidatePage} />
                <Card className="border-slate-200">
                  <CardHeader><CardTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-sky-600" />Selected Webcam</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {liveView ? (
                      <>
                        <div className="flex items-start justify-between gap-3"><div><p className="font-medium text-slate-900">{liveView.candidateName}</p><p className="text-xs text-slate-500">{liveView.participantName || "Waiting for session metadata"}</p></div><StatusBadge status={liveView.status} /></div>
                        <div ref={liveStageRef} className={cn(
                          "flex aspect-video items-center justify-center rounded-2xl border bg-slate-950 p-4 text-center text-sm text-slate-200 transition-all duration-300",
                          hasViolationOrAlert ? "proctor-alert-glow" : "border-slate-200"
                        )}>{liveView.status === "connecting" ? <p>Connecting to webcam feed...</p> : liveView.error ? <p>{liveView.error}</p> : <p>Waiting for webcam track...</p>}</div>
                        <Button size="sm" variant="outline" onClick={() => void closeLiveView()}>Close Webcam</Button>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">Select a candidate to request an on-demand webcam view.</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="violation-history" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div><CardTitle>Violation History</CardTitle><p className="mt-2 text-sm text-slate-600">Review, filter, resolve, and export violation cases for this protected exam.</p></div>
              <Button onClick={() => void exportHistory()}><Download className="mr-2 h-4 w-4" />Export Excel</Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px]">
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Search violation history" className="pl-10" placeholder="Search candidate, title, or summary" value={historySearch} onChange={(event) => setHistoryFilter("historySearch", event.target.value)} /></div>
                <Select value={historyStatus} onValueChange={(value) => setHistoryFilter("historyStatus", value)}><SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="dismissed">Dismissed</SelectItem></SelectContent></Select>
                <Select value={historySeverity} onValueChange={(value) => setHistoryFilter("historySeverity", value)}><SelectTrigger><SelectValue placeholder="All severities" /></SelectTrigger><SelectContent><SelectItem value="all">All severities</SelectItem><SelectItem value="warning">Warning</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select>
              </div>

              <div className="space-y-3">
                {caseResults.map((caseRecord) => (
                  <div key={caseRecord.id} className={cn("rounded-2xl border bg-white p-4 transition-colors", selectedCaseId === caseRecord.id ? "border-blue-300 bg-blue-50" : "border-slate-200")}>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-900">{caseRecord.title}</p><StatusBadge status={caseRecord.severity} /><StatusBadge status={caseRecord.status} /></div>
                        <p className="mt-2 text-sm text-slate-700">{caseRecord.summary || "No summary provided."}</p>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500"><span>{caseRecord.candidate.full_name}</span><span>{caseRecord.candidate.email}</span><span>Events: {caseRecord.event_ids.length}</span><span>Evidence: {caseRecord.evidence_ids.length}</span><span>Resolved: {formatDate(caseRecord.resolved_at)}</span></div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openViolationCase(caseRecord.id)}>View Details</Button>
                        {caseRecord.status === "open" ? <Button size="sm" variant="outline" onClick={() => void resolveCase(caseRecord, "dismissed")}>Dismiss</Button> : null}
                        {caseRecord.status === "open" ? <Button size="sm" onClick={() => void resolveCase(caseRecord, "resolved")}>Resolve</Button> : null}
                      </div>
                    </div>
                  </div>
                ))}
                {!caseHistory.isLoading && !caseHistory.data?.count ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">No violation cases matched the current filters.</div> : null}
              </div>

              <PaginationControls label="Cases" page={historyPage} totalPages={Math.max(1, Math.ceil((caseHistory.data?.count ?? 0) / HISTORY_PAGE_SIZE))} totalItems={caseHistory.data?.count ?? 0} pageSize={HISTORY_PAGE_SIZE} onPageChange={(page) => updateMonitoringParams({ historyPage: String(page) })} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={selectedCaseId !== null} onOpenChange={(open) => (!open ? closeViolationCase() : undefined)}>
        <SheetContent className="w-full overflow-y-auto px-6 py-6 sm:max-w-2xl">
          <SheetHeader className="p-0 pr-12">
            <SheetTitle>Violation Detail</SheetTitle>
            <SheetDescription>Review evidence, notes, and current resolution state without leaving the monitoring workspace.</SheetDescription>
          </SheetHeader>
          <CaseDetailPanel caseRecord={selectedCase} isLoading={selectedCaseLoading} error={selectedCaseError} onDismiss={() => { if (selectedCase) { void resolveCase(selectedCase, "dismissed"); } }} onResolve={() => { if (selectedCase) { void resolveCase(selectedCase, "resolved"); } }} />
        </SheetContent>
      </Sheet>

      <Sheet open={viewingSessionId !== null} onOpenChange={(open) => (!open ? setViewingSessionId(null) : undefined)}>
        <SheetContent className="w-full overflow-y-auto px-6 py-6 sm:max-w-3xl">
          <SheetHeader className="p-0 pr-12">
            <SheetTitle>Chi tiết bài thi</SheetTitle>
            <SheetDescription>Xem thông tin và nội dung câu trả lời của thí sinh.</SheetDescription>
          </SheetHeader>
          
          {viewingSessionLoading && (
            <div className="py-12 text-center text-sm text-slate-500">
              Đang tải chi tiết bài thi...
            </div>
          )}

          {viewingSessionError && (
            <div className="my-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {viewingSessionError}
            </div>
          )}

          {viewingSessionData && (
            <div className="mt-6 space-y-6">
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Trạng thái làm bài</p>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={viewingSessionData.status} />
                    <Badge variant="outline">Lần thi {viewingSessionData.attempt_number}</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Điểm số trắc nghiệm</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {viewingSessionData.objective_score} / {viewingSessionData.max_score} điểm
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Bắt đầu lúc</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {formatDate(viewingSessionData.started_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Nộp bài lúc</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {formatDate(viewingSessionData.submitted_at)}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 font-sans">Danh sách câu hỏi ({viewingSessionData.total_questions})</h3>
                {viewingSessionData.questions.map((question: any) => {
                  const isEssay = question.question_type === "essay";
                  const isMultipleChoice = question.question_type === "multiple_choice";
                  const isTrueFalse = question.question_type === "true_false";

                  return (
                    <div key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Câu {question.sort_order}</Badge>
                        <Badge variant="outline" className="capitalize">
                          {question.question_type.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {question.difficulty}
                        </Badge>
                        <Badge variant="outline">
                          {question.points} điểm
                        </Badge>
                        {question.is_marked_for_review && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            Đánh dấu xem lại
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm font-medium text-slate-900">{question.question_text}</p>

                      {(isMultipleChoice || isTrueFalse) && (
                        <div className="space-y-2 mt-2">
                          {question.options.map((opt: any) => {
                            const isSelected = question.selected_option_keys.includes(opt.key);
                            return (
                              <div
                                key={opt.key}
                                className={cn(
                                  "flex items-start gap-3 rounded-xl border p-3 text-sm transition-colors",
                                  isSelected
                                    ? "border-blue-200 bg-blue-50/50 text-blue-900"
                                    : "border-slate-100 bg-slate-50 text-slate-700"
                                )}
                              >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-semibold text-slate-500 shadow-sm">
                                  {opt.key.toUpperCase()}
                                </span>
                                <span className="flex-1">{opt.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {isEssay && (
                        <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                            Câu trả lời của thí sinh:
                          </p>
                          <p className="text-sm whitespace-pre-wrap text-slate-700">
                            {question.answer_text || "Không có câu trả lời."}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
