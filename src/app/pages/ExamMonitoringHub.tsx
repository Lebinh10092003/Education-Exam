import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowUpRight,
  Eye,
  RefreshCcw,
  Search,
  ShieldAlert,
  TriangleAlert,
  Users,
} from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { RangeSummary } from "../components/RangeSummary";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { apiRequest, type PaginatedResponse } from "../lib/http";

interface SubjectOption {
  id: number;
  name: string;
  code: string;
  color: string;
}

interface ExamMonitoringHubRecord {
  id: number;
  name: string;
  subject_name: string;
  status: "draft" | "scheduled" | "open" | "paused" | "closed" | "archived";
  total_candidates: number;
  total_sessions: number;
  in_progress_sessions: number;
  submitted_sessions: number;
  alert_count: number;
  critical_alert_count: number;
  latest_alert_at: string | null;
  highest_alert_severity: "critical" | "warning" | "quiet";
}

interface MonitoringHubSummary {
  exam_count: number;
  total_candidates: number;
  in_progress_sessions: number;
  alert_count: number;
  critical_exam_count: number;
}

type MonitoringHubResponse = PaginatedResponse<ExamMonitoringHubRecord> & {
  summary: MonitoringHubSummary;
};

const PAGE_SIZE = 20;
const POLLING_INTERVAL_MS = 10_000;

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "No alerts yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

const formatCount = (value: number) => value.toLocaleString("en-US");

export function ExamMonitoringHub() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(searchQuery, 350);

  const subjectsList = useAsyncList(
    async () => apiRequest<PaginatedResponse<SubjectOption>>("/api/v1/subjects/"),
    [],
  );

  const hubList = useAsyncList(
    async () =>
      apiRequest<MonitoringHubResponse>("/api/v1/proctoring/exams/monitoring/", {
        query: {
          page,
          search: debouncedSearch || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          subject: subjectFilter !== "all" ? subjectFilter : undefined,
          severity: severityFilter !== "all" ? severityFilter : undefined,
        },
      }),
    [page, debouncedSearch, statusFilter, subjectFilter, severityFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, subjectFilter, severityFilter]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void hubList.reload().catch(() => undefined);
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hubList.reload]);

  const subjects = subjectsList.data?.results ?? [];
  const exams = hubList.data?.results ?? [];
  const totalCount = hubList.data?.count ?? 0;
  const summary = hubList.data?.summary ?? {
    exam_count: 0,
    total_candidates: 0,
    in_progress_sessions: 0,
    alert_count: 0,
    critical_exam_count: 0,
  };
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : rangeStart + exams.length - 1;
  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    statusFilter !== "all" ||
    subjectFilter !== "all" ||
    severityFilter !== "all";

  const renderSummaryCard = (
    title: string,
    value: number,
    helper: string,
    icon: typeof ShieldAlert,
  ) => {
    const Icon = icon;
    return (
      <Card key={title}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-500">{title}</p>
              <p className="mt-3 text-3xl font-semibold text-gray-900">{formatCount(value)}</p>
              <p className="mt-2 text-sm text-gray-500">{helper}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader
        title="Live Monitoring"
        description="Monitor all proctored exams from one place, then drill into the detailed workspace for a specific exam."
        action={
          <>
            <Link to="/exams">
              <Button variant="outline">
                <ArrowUpRight className="mr-2 h-4 w-4" />
                View Exam List
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => void hubList.reload().catch(() => undefined)}
              disabled={hubList.isLoading}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {renderSummaryCard(
          "Monitored exams",
          summary.exam_count,
          `${formatCount(summary.total_candidates)} assigned candidates across the current result set.`,
          ShieldAlert,
        )}
        {renderSummaryCard(
          "In-progress sessions",
          summary.in_progress_sessions,
          "Candidates actively taking exams right now.",
          Users,
        )}
        {renderSummaryCard(
          "Active alerts",
          summary.alert_count,
          "Warning and critical proctoring alerts captured by the hub.",
          TriangleAlert,
        )}
        {renderSummaryCard(
          "Critical exams",
          summary.critical_exam_count,
          "Exams that currently have at least one critical alert.",
          ShieldAlert,
        )}
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 xl:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search proctored exams..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full xl:w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-full xl:w-[220px]">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={String(subject.id)}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full xl:w-[220px]">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="warning">Warning Only</SelectItem>
                <SelectItem value="critical">Critical Only</SelectItem>
                <SelectItem value="has_alerts">Any Alerts</SelectItem>
                <SelectItem value="quiet">Quiet Exams</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {(hubList.error || subjectsList.error) && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {hubList.error || subjectsList.error}
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4 md:hidden">
            {hubList.isLoading ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                Loading monitoring hub...
              </div>
            ) : exams.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                {hasActiveFilters
                  ? "No proctored exams matched the current filters."
                  : "No proctored exams are available for live monitoring yet."}
              </div>
            ) : (
              exams.map((exam) => (
                <div key={exam.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{exam.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{exam.subject_name}</p>
                    </div>
                    <StatusBadge status={exam.status} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">{formatCount(exam.total_candidates)} candidates</Badge>
                    <Badge variant="outline">{formatCount(exam.in_progress_sessions)} in progress</Badge>
                    <StatusBadge status={exam.highest_alert_severity} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-600">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Alerts</p>
                      <p>{formatCount(exam.alert_count)} total</p>
                      <p>{formatCount(exam.critical_alert_count)} critical</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Latest Alert</p>
                      <p>{formatDateTime(exam.latest_alert_at)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`/exams/${exam.id}?tab=monitoring`}>
                      <Button size="sm" variant="outline">
                        <Eye className="mr-2 h-4 w-4" />
                        Open Monitoring
                      </Button>
                    </Link>
                    <Link to={`/exams/${exam.id}`}>
                      <Button size="sm" variant="outline">
                        <ArrowUpRight className="mr-2 h-4 w-4" />
                        Open Exam
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1080px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Exam</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Candidates</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Sessions</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Alerts</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Highest Severity</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Latest Alert</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hubList.isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-gray-500">
                      Loading monitoring hub...
                    </td>
                  </tr>
                ) : exams.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-gray-500">
                      {hasActiveFilters
                        ? "No proctored exams matched the current filters."
                        : "No proctored exams are available for live monitoring yet."}
                    </td>
                  </tr>
                ) : (
                  exams.map((exam) => (
                    <tr key={exam.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-900">{exam.name}</p>
                        <p className="mt-1 text-xs text-gray-500">{exam.subject_name}</p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={exam.status} />
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        <p>{formatCount(exam.total_candidates)} assigned</p>
                        <p className="text-gray-500">{formatCount(exam.total_sessions)} active records</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        <p>{formatCount(exam.in_progress_sessions)} in progress</p>
                        <p className="text-gray-500">{formatCount(exam.submitted_sessions)} submitted</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        <p>{formatCount(exam.alert_count)} total</p>
                        <p className="text-gray-500">{formatCount(exam.critical_alert_count)} critical</p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={exam.highest_alert_severity} />
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {formatDateTime(exam.latest_alert_at)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <Link to={`/exams/${exam.id}?tab=monitoring`}>
                            <Button size="sm" variant="outline">
                              <Eye className="mr-2 h-4 w-4" />
                              Open Monitoring
                            </Button>
                          </Link>
                          <Link to={`/exams/${exam.id}`}>
                            <Button size="sm" variant="outline">
                              <ArrowUpRight className="mr-2 h-4 w-4" />
                              Open Exam
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <RangeSummary start={rangeStart} end={rangeEnd} total={totalCount} unit="proctored exams" />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hubList.data?.previous || hubList.isLoading}
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              >
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Page {page}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hubList.data?.next || hubList.isLoading}
                onClick={() => setPage((previous) => previous + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
