import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  Users,
  Wifi,
  XCircle,
} from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { useAsyncList } from "../hooks/useAsyncList";
import { useMutationState } from "../hooks/useMutationState";
import { buildWsUrl } from "../lib/env";
import { getStoredTokens } from "../lib/storage";

interface MonitoringSnapshot {
  exam: {
    id: number;
    name: string;
    subject_name: string;
  };
  total_candidates: number;
  in_progress: number;
  completed: number;
  not_started: number;
  average_progress: number;
  candidate_statuses: Array<{
    candidate: {
      id: number;
      email: string;
      full_name: string;
    };
    status: string;
    progress_percentage: number;
    questions_answered: number;
    total_questions: number;
    time_elapsed_minutes: number;
    connection_status: string;
    last_activity_at: string | null;
  }>;
  alerts: Array<{
    id: number;
    session_id: number;
    candidate: {
      id: number;
      email: string;
      full_name: string;
    };
    event_type: string;
    severity: string;
    message: string;
    metadata: Record<string, unknown>;
    occurred_at: string;
    case_id: number | null;
  }>;
}

interface ExamDetail {
  id: number;
  status: string;
}

interface ViolationCaseRecord {
  id: number;
  session: number;
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
  event_ids: number[];
  evidence_ids: number[];
  resolved_at: string | null;
  resolution_notes: string;
}

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "-";

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) {
    return `${remainingMinutes}m`;
  }
  return `${hours}h ${remainingMinutes}m`;
};

export function LiveMonitoring() {
  const { id } = useParams();
  const examId = Number(id);
  const mutation = useMutationState();
  const [socketState, setSocketState] = useState<"connecting" | "open" | "closed">("connecting");

  const snapshot = useAsyncList(
    () => apiRequest<MonitoringSnapshot>(`/api/v1/proctoring/exams/${examId}/monitoring/`),
    [examId],
  );
  const exam = useAsyncList(
    () => apiRequest<ExamDetail>(`/api/v1/exams/${examId}/`),
    [examId],
  );
  const cases = useAsyncList(
    () =>
      apiRequest<PaginatedResponse<ViolationCaseRecord>>("/api/v1/proctoring/cases/", {
        query: { exam: examId, page_size: 100 },
      }),
    [examId],
  );

  useEffect(() => {
    const tokens = getStoredTokens();
    if (!examId || !tokens?.access) {
      setSocketState("closed");
      return;
    }

    const websocket = new WebSocket(buildWsUrl(`/ws/monitoring/exams/${examId}/?token=${tokens.access}`));
    setSocketState("connecting");

    websocket.onopen = () => {
      setSocketState("open");
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as { type: string; payload: MonitoringSnapshot };
        if (message.type === "snapshot") {
          snapshot.setData(message.payload);
          return;
        }
        void snapshot.reload().catch(() => undefined);
        void cases.reload().catch(() => undefined);
      } catch {
        void snapshot.reload().catch(() => undefined);
      }
    };

    websocket.onerror = () => {
      setSocketState("closed");
    };

    websocket.onclose = () => {
      setSocketState("closed");
    };

    return () => {
      websocket.close();
    };
  }, [examId]);

  const updateExamStatus = async (nextStatus: "open" | "paused" | "closed") => {
    try {
      await mutation.run(() =>
        apiRequest(`/api/v1/exams/${examId}/`, {
          method: "PATCH",
          body: { status: nextStatus },
        }),
      );
      toast.success(`Exam moved to ${nextStatus}.`);
      await Promise.all([exam.reload(), snapshot.reload()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update exam status.";
      toast.error(message);
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
      toast.success(`Case ${decision}.`);
      await cases.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update case.";
      toast.error(message);
    }
  };

  const data = snapshot.data;
  const examStatus = exam.data?.status ?? "open";

  return (
    <div>
      <PageHeader
        title="Live Exam Monitoring"
        description={
          data
            ? `${data.exam.name} • ${data.exam.subject_name}`
            : "Loading monitoring snapshot..."
        }
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void updateExamStatus(examStatus === "paused" ? "open" : "paused")}
            >
              {examStatus === "paused" ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Resume Exam
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause Exam
                </>
              )}
            </Button>
            <Button variant="destructive" onClick={() => void updateExamStatus("closed")}>
              <XCircle className="w-4 h-4 mr-2" />
              End Exam
            </Button>
          </div>
        }
      />

      {(snapshot.error || cases.error || exam.error || mutation.error) ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {snapshot.error ?? cases.error ?? exam.error ?? mutation.error}
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Wifi
            className={`h-4 w-4 ${
              socketState === "open" ? "text-green-600" : socketState === "connecting" ? "text-yellow-600" : "text-red-600"
            }`}
          />
          <span>
            Monitoring socket:{" "}
            <strong className="capitalize">
              {socketState === "open" ? "connected" : socketState === "connecting" ? "connecting" : "reconnecting"}
            </strong>
          </span>
        </div>
        <StatusBadge status={examStatus} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Candidates</p>
                <p className="text-3xl font-bold text-gray-900">{data?.total_candidates ?? 0}</p>
              </div>
              <div className="bg-blue-100 text-blue-600 p-4 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">In Progress</p>
                <p className="text-3xl font-bold text-blue-600">{data?.in_progress ?? 0}</p>
              </div>
              <div className="bg-blue-100 text-blue-600 p-4 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completed</p>
                <p className="text-3xl font-bold text-green-600">{data?.completed ?? 0}</p>
              </div>
              <div className="bg-green-100 text-green-600 p-4 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Average Progress</p>
                <p className="text-3xl font-bold text-gray-900">{data?.average_progress ?? 0}%</p>
              </div>
              <div className="bg-purple-100 text-purple-600 p-4 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Candidate Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 md:hidden">
              {(data?.candidate_statuses ?? []).map((candidateStatus) => (
                <div key={candidateStatus.candidate.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{candidateStatus.candidate.full_name}</p>
                      <p className="truncate text-xs text-gray-500">{candidateStatus.candidate.email}</p>
                    </div>
                    <StatusBadge status={candidateStatus.status} />
                  </div>

                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
                      <span>Progress</span>
                      <span>{candidateStatus.progress_percentage}%</span>
                    </div>
                    <Progress value={candidateStatus.progress_percentage} className="w-full" />
                    <p className="mt-2 text-xs text-gray-500">
                      {candidateStatus.questions_answered}/{candidateStatus.total_questions} questions
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Time Elapsed</p>
                      <p>{formatMinutes(candidateStatus.time_elapsed_minutes)}</p>
                      <p className="text-xs text-gray-500">{formatDate(candidateStatus.last_activity_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Connection</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Wifi
                          className={`h-4 w-4 ${
                            candidateStatus.connection_status === "stable"
                              ? "text-green-600"
                              : candidateStatus.connection_status === "offline"
                                ? "text-red-600"
                                : "text-yellow-600"
                          }`}
                        />
                        <span className="text-xs capitalize text-gray-600">{candidateStatus.connection_status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!snapshot.isLoading && !data?.candidate_statuses.length ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                  No candidates assigned to this exam yet.
                </div>
              ) : null}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Candidate</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Progress</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Time</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Connection</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.candidate_statuses ?? []).map((candidateStatus) => (
                    <tr key={candidateStatus.candidate.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{candidateStatus.candidate.full_name}</p>
                          <p className="text-xs text-gray-500">{candidateStatus.candidate.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={candidateStatus.status} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Progress value={candidateStatus.progress_percentage} className="w-24" />
                            <span className="text-xs text-gray-600">{candidateStatus.progress_percentage}%</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {candidateStatus.questions_answered}/{candidateStatus.total_questions} questions
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-900">{formatMinutes(candidateStatus.time_elapsed_minutes)}</p>
                        <p className="text-xs text-gray-500">{formatDate(candidateStatus.last_activity_at)}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Wifi
                            className={`w-4 h-4 ${
                              candidateStatus.connection_status === "stable"
                                ? "text-green-600"
                                : candidateStatus.connection_status === "offline"
                                  ? "text-red-600"
                                  : "text-yellow-600"
                            }`}
                          />
                          <span className="text-xs capitalize text-gray-600">
                            {candidateStatus.connection_status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!snapshot.isLoading && !data?.candidate_statuses.length ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={5}>
                        No candidates assigned to this exam yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Live Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(data?.alerts ?? []).map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-3 ${
                      alert.severity === "critical"
                        ? "border-red-200 bg-red-50"
                        : "border-yellow-200 bg-yellow-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{alert.candidate.full_name}</p>
                    <p className="mt-1 text-sm text-gray-700">{alert.message}</p>
                    <p className="mt-1 text-xs text-gray-500">{formatDate(alert.occurred_at)}</p>
                  </div>
                ))}
                {!snapshot.isLoading && !(data?.alerts.length ?? 0) ? (
                  <p className="text-sm text-gray-500">No live alerts for this exam.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Violation Cases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(cases.data?.results ?? []).map((caseRecord) => (
                  <div key={caseRecord.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{caseRecord.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{caseRecord.candidate.full_name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {caseRecord.summary || "No summary provided."}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <StatusBadge status={caseRecord.severity} />
                        <StatusBadge status={caseRecord.status} />
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      Events: {caseRecord.event_ids.length} • Evidences: {caseRecord.evidence_ids.length}
                    </div>
                    {caseRecord.status === "open" ? (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => void resolveCase(caseRecord, "dismissed")}>
                          Dismiss
                        </Button>
                        <Button size="sm" onClick={() => void resolveCase(caseRecord, "resolved")}>
                          Resolve
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-gray-500">Resolved: {formatDate(caseRecord.resolved_at)}</p>
                    )}
                  </div>
                ))}
                {!cases.isLoading && !(cases.data?.results.length ?? 0) ? (
                  <p className="text-sm text-gray-500">No violation cases for this exam.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
