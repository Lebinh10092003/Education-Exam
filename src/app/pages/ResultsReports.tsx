import { useMemo, useState } from "react";
import { Link } from "react-router";
import { notify } from "../lib/notify";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Eye, FileSearch, FileSpreadsheet, Search, TrendingUp } from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";
import { buildApiUrl } from "../lib/env";
import { getStoredTokens } from "../lib/storage";
import { formatCertificateLevel } from "./disciplineShared";

interface ExamOption {
  id: number;
  name: string;
}

interface ResultRecord {
  id: number;
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
  workflow_status: string;
  publish_state: string;
  score: string;
  original_score: string;
  total_marks: string;
  percentage: string;
  original_percentage: string;
  penalty_percent_applied: string;
  certificate_level: string;
  result_status: string;
  passed: boolean;
  completed_date: string | null;
  time_taken_minutes: number;
  published_at: string | null;
}

interface ResultSummary {
  pass_count: number;
  fail_count: number;
  pending_count: number;
  average_percentage: string;
  score_distribution: Array<{
    range: string;
    count: number;
  }>;
}

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "-";

const formatDuration = (minutes: number) => {
  if (!minutes) {
    return "0m";
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) {
    return `${remainingMinutes}m`;
  }
  return `${hours}h ${remainingMinutes}m`;
};

const buildResultExportQuery = (searchQuery: string, examFilter: string) => {
  const queryParams = new URLSearchParams();
  if (searchQuery) {
    queryParams.append("search", searchQuery);
  }
  if (examFilter !== "all") {
    queryParams.append("exam", examFilter);
  }
  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : "";
};

const downloadApiFile = async (path: string, fallbackFileName: string, successMessage: string) => {
  try {
    const tokens = getStoredTokens();
    const headers: HeadersInit = {};
    if (tokens?.access) {
      headers["Authorization"] = `Bearer ${tokens.access}`;
    }

    const response = await fetch(buildApiUrl(path), { headers });

    if (!response.ok) {
      throw new Error(`Unable to export file: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fallbackFileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
    notify.success(successMessage);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export file.";
    notify.error(message);
  }
};

const exportResultsFile = async (format: "csv" | "xlsx", searchQuery: string, examFilter: string) => {
  const endpoint = format === "csv" ? "export-csv" : "export-xlsx";
  const extension = format === "csv" ? "csv" : "xlsx";
  await downloadApiFile(
    `/api/v1/results/${endpoint}/${buildResultExportQuery(searchQuery, examFilter)}`,
    `eduexam-results.${extension}`,
    format === "csv" ? "Đã xuất kết quả CSV." : "Đã xuất kết quả XLSX.",
  );
};

const exportExamRosterFile = async (examFilter: string) => {
  if (examFilter === "all") {
    notify.error("Chọn một kỳ thi trước khi xuất danh sách thí sinh.");
    return;
  }
  await downloadApiFile(
    `/api/v1/results/exam-roster-export/?exam=${encodeURIComponent(examFilter)}`,
    `eduexam-exam-roster-${examFilter}.xlsx`,
    "Đã xuất danh sách thí sinh theo kỳ thi.",
  );
};


export function ResultsReports() {
  const [searchQuery, setSearchQuery] = useState("");
  const [examFilter, setExamFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedResult, setSelectedResult] = useState<ResultRecord | null>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const mutation = useMutationState();

  const resultsList = useAsyncList(
    () =>
      apiRequest<PaginatedResponse<ResultRecord>>("/api/v1/results/", {
        query: {
          page,
          search: debouncedSearch,
          exam: examFilter === "all" ? undefined : examFilter,
        },
      }),
    [page, debouncedSearch, examFilter],
  );
  const summary = useAsyncList(() => apiRequest<ResultSummary>("/api/v1/results/summary/"), []);
  const exams = useAsyncList(
    () =>
      apiRequest<PaginatedResponse<ExamOption>>("/api/v1/exams/", {
        query: { page_size: 100, mode: "exam" },
      }),
    [],
  );

  const passFailData = useMemo(
    () => [
      { name: "Pass", value: summary.data?.pass_count ?? 0, color: "#10b981" },
      { name: "Fail", value: summary.data?.fail_count ?? 0, color: "#ef4444" },
      { name: "Pending", value: summary.data?.pending_count ?? 0, color: "#f59e0b" },
    ],
    [summary.data],
  );

  const publishResult = async (result: ResultRecord) => {
    const confirmed = await notify.confirm({
      title: "Publish this result?",
      text: `${result.candidate.full_name} will be able to view the published result for ${result.exam.name}.`,
      confirmText: "Publish Result",
      confirmButtonColor: "#2563eb",
    });
    if (!confirmed) {
      return;
    }

    try {
      await mutation.run(() =>
        apiRequest(`/api/v1/results/${result.id}/publish/`, {
          method: "POST",
        }),
      );
      notify.success("Result published.");
      await Promise.all([resultsList.reload(), summary.reload()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to publish result.";
      notify.error(message);
    }
  };

  const bulkPublishResults = async () => {
    if (examFilter === "all") {
      notify.error("Chọn một kỳ thi trước khi công bố điểm hàng loạt.");
      return;
    }

    const examName = exams.data?.results.find((e) => String(e.id) === examFilter)?.name ?? "";

    const confirmed = await notify.confirm({
      title: "Công bố tất cả điểm thi?",
      text: `Tất cả kết quả thi đã hoàn tất chấm điểm của kỳ thi "${examName}" sẽ được công bố công khai.`,
      confirmText: "Công bố ngay",
      confirmButtonColor: "#2563eb",
    });
    if (!confirmed) {
      return;
    }

    try {
      const res = await mutation.run(() =>
        apiRequest<{ published_count: number }>("/api/v1/results/bulk-publish/", {
          method: "POST",
          body: {
            exam_id: Number(examFilter),
          },
        }),
      );
      notify.success(`Đã công bố thành công ${res.published_count} kết quả thi.`);
      await Promise.all([resultsList.reload(), summary.reload()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể công bố tất cả kết quả.";
      notify.error(message);
    }
  };

  const downloadSingleResult = (result: ResultRecord) => {
    const payload = JSON.stringify(result, null, 2);
    const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `result-${result.id}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  };

  const results = resultsList.data?.results ?? [];
  const totalResults = resultsList.data?.count ?? 0;
  const pageSize = results.length || 20;
  const startRow = totalResults === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = totalResults === 0 ? 0 : startRow + results.length - 1;

  return (
    <div>
      <PageHeader
        title="Results & Reports"
        description="Live result data, publishing, and report export from the backend."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void exportResultsFile("csv", debouncedSearch, examFilter)}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => void exportResultsFile("xlsx", debouncedSearch, examFilter)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export XLSX
            </Button>
            <Button
              variant="outline"
              onClick={() => void exportExamRosterFile(examFilter)}
              disabled={examFilter === "all"}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Xuất DS thí sinh
            </Button>
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700 font-semibold"
              onClick={() => void bulkPublishResults()}
              disabled={examFilter === "all" || mutation.isSubmitting}
            >
              Công bố tất cả điểm thi
            </Button>
          </div>
        }
      />

      {(resultsList.error || summary.error || mutation.error) ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {resultsList.error ?? summary.error ?? mutation.error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Score Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={summary.data?.score_distribution ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="range" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pass / Fail / Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={passFailData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {passFailData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-1 gap-3 text-center text-sm sm:grid-cols-3">
              {passFailData.map((entry) => (
                <div key={entry.name} className="rounded-lg border border-gray-200 p-3">
                  <p className="text-gray-500">{entry.name}</p>
                  <p className="font-semibold text-gray-900">{entry.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by candidate or exam..."
                className="pl-10"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={examFilter}
              onValueChange={(value) => {
                setExamFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder="All Exams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exams</SelectItem>
                {(exams.data?.results ?? []).map((exam) => (
                  <SelectItem key={exam.id} value={String(exam.id)}>
                    {exam.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4 md:hidden">
            {results.map((result) => {
              const percentage = Number(result.percentage);
              return (
                <div key={result.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{result.candidate.full_name}</p>
                      <p className="truncate text-sm text-gray-500">{result.candidate.email}</p>
                      <p className="mt-2 text-sm text-gray-700">{result.exam.name}</p>
                      <p className="text-xs text-gray-500">{result.exam.subject_name}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <StatusBadge status={result.publish_state} />
                      <StatusBadge status={result.result_status} />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Score</p>
                      <p>{result.score}/{result.total_marks}</p>
                      <p className="text-xs text-gray-500">Original {result.original_score}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Time Taken</p>
                      <p>{formatDuration(result.time_taken_minutes)}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wide text-gray-400">Percentage</span>
                        <span className="text-sm text-gray-900">{percentage.toFixed(2)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full ${percentage >= 60 ? "bg-green-600" : "bg-red-600"}`}
                          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-gray-400">Penalty / Certificate</p>
                      <p>
                        {result.penalty_percent_applied}% penalty, {formatCertificateLevel(result.certificate_level)}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-gray-400">Completed</p>
                      <p>{formatDate(result.completed_date)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedResult(result)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadSingleResult(result)}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/results/${result.id}/review`}>
                        <FileSearch className="mr-2 h-4 w-4" />
                        Rà bài
                      </Link>
                    </Button>
                    {result.workflow_status === "finalized" && result.publish_state !== "published" ? (
                      <Button size="sm" onClick={() => void publishResult(result)}>
                        Publish
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!resultsList.isLoading && !results.length ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                No results found for the current filters.
              </div>
            ) : null}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1320px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Candidate</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Exam</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Score</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Penalty</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Percentage</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Certificate</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Workflow</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Publish</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Time Taken</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => {
                  const percentage = Number(result.percentage);
                  return (
                    <tr key={result.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4 min-w-[190px]">
                        <p className="font-semibold text-gray-900 leading-snug">{result.candidate.full_name}</p>
                        <p className="text-xs text-gray-500">{result.candidate.email}</p>
                      </td>
                      <td className="py-4 px-4 min-w-[200px] max-w-[280px]">
                        <p className="text-sm leading-snug text-gray-700">{result.exam.name}</p>
                        <p className="text-xs text-gray-500">{result.exam.subject_name}</p>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="font-semibold">{result.score}/{result.total_marks}</div>
                        <div className="text-xs text-gray-500">Orig. {result.original_score}</div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {result.penalty_percent_applied}%
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 rounded-full bg-gray-200">
                            <div
                              className={`h-2 rounded-full ${
                                percentage >= 60 ? "bg-green-600" : "bg-red-600"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-900">{percentage.toFixed(2)}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">{formatCertificateLevel(result.certificate_level)}</td>
                      <td className="py-4 px-4">
                        <StatusBadge status={result.result_status} />
                      </td>
                      <td className="py-4 px-4">
                        <StatusBadge status={result.publish_state} />
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-600">{formatDate(result.completed_date)}</td>
                      <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-600">{formatDuration(result.time_taken_minutes)}</td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedResult(result)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => downloadSingleResult(result)}>
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" title="Rà bài" asChild>
                            <Link to={`/results/${result.id}/review`}>
                              <FileSearch className="h-4 w-4" />
                            </Link>
                          </Button>
                          {result.workflow_status === "finalized" && result.publish_state !== "published" ? (
                            <Button size="sm" variant="outline" onClick={() => void publishResult(result)}>
                              Publish
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!resultsList.isLoading && !results.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={11}>
                      No results found for the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Showing <strong>{startRow}</strong>-<strong>{endRow}</strong> of <strong>{totalResults}</strong> results
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={endRow >= totalResults}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={selectedResult !== null} onOpenChange={(open) => !open && setSelectedResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedResult?.candidate.full_name}</DialogTitle>
            <DialogDescription>{selectedResult?.exam.name}</DialogDescription>
          </DialogHeader>
          {selectedResult ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-gray-500">Score</p>
                  <p className="font-semibold text-gray-900">
                    {selectedResult.score}/{selectedResult.total_marks}
                  </p>
                  <p className="text-xs text-gray-500">Original: {selectedResult.original_score}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-gray-500">Percentage</p>
                  <p className="font-semibold text-gray-900">{Number(selectedResult.percentage).toFixed(2)}%</p>
                  <p className="text-xs text-gray-500">Original: {selectedResult.original_percentage}%</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-gray-500">Workflow</p>
                  <p className="font-semibold text-gray-900">{selectedResult.workflow_status}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-gray-500">Penalty / Certificate</p>
                  <p className="font-semibold text-gray-900">
                    {selectedResult.penalty_percent_applied}% / {formatCertificateLevel(selectedResult.certificate_level)}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                Completed: {formatDate(selectedResult.completed_date)}
                <br />
                Time taken: {formatDuration(selectedResult.time_taken_minutes)}
                <br />
                Published: {formatDate(selectedResult.published_at)}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedResult(null)}>
              Close
            </Button>
            {selectedResult && selectedResult.workflow_status === "finalized" && selectedResult.publish_state !== "published" ? (
              <Button onClick={() => void publishResult(selectedResult)}>
                Publish Result
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
