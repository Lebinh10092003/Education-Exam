import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  Eye,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Play,
  Search,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { cn } from "../components/ui/utils";
import { LiveMonitoring } from "./LiveMonitoring";
import { ExamQualityCheckDialog } from "../components/ExamQualityCheckDialog";
import { ExamStudentPreview } from "../components/ExamStudentPreview";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { getStoredTokens } from "../lib/storage";
import { buildApiUrl } from "../lib/env";
import { formatCertificateLevel } from "./disciplineShared";
import { notify } from "../lib/notify";
import { useAsyncList } from "../hooks/useAsyncList";
import { useMutationState } from "../hooks/useMutationState";

interface ExamDetailRecord {
  id: number;
  name: string;
  mode: "exam" | "class";
  description: string;
  status: "draft" | "scheduled" | "open" | "paused" | "closed" | "archived";
  /** Trang thai thuc te theo lich (draft|scheduled|open|paused|closed|results). */
  lifecycle_phase?: string | null;
  duration_minutes: number;
  passing_score: number;
  max_attempts: number;
  shuffle_questions: boolean;
  show_results_immediately: boolean;
  enable_proctoring: boolean;
  subject: {
    id: number;
    name: string;
    code: string;
    color: string;
  };
  current_version: {
    id: number;
    version_number: number;
    item_count: number;
    items: Array<{
      id: number;
      source: "manual" | "random";
      sort_order: number;
      points: string;
      question: {
        id: number;
        question_id: number;
        revision_number: number;
        question_text: string;
        question_type: string;
        difficulty: string;
      };
    }>;
    random_rules: Array<{
      id: number;
      sort_order: number;
      difficulty: string;
      question_type: string;
      tag_ids: number[];
      count: number;
    }>;
  } | null;
  schedule_window: {
    opens_at: string | null;
    closes_at: string | null;
  } | null;
  assignment_summary: {
    group_count: number;
    user_count: number;
    total_candidates: number;
    assigned_group_ids: number[];
    assigned_user_ids: number[];
    assigned_groups: Array<{
      id: number;
      name: string;
      member_count: number;
    }>;
  };
  delivery_summary: {
    total_sessions: number;
    in_progress_sessions: number;
    submitted_sessions: number;
  };
  created_at: string;
  updated_at: string;
}

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const formatBoolean = (value: boolean) => (value ? "Enabled" : "Disabled");
const examModeBadgeClassNames = {
  exam: "border-blue-200 bg-blue-50 text-blue-700",
  class: "border-emerald-200 bg-emerald-50 text-emerald-700",
} as const;

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

interface CandidateRecord {
  id: number;
  full_name: string;
  email: string;
  username: string;
  has_submitted: boolean;
}

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

const exportResultsFile = async (format: "csv" | "xlsx", examId: string) => {
  const endpoint = format === "csv" ? "export-csv" : "export-xlsx";
  const extension = format === "csv" ? "csv" : "xlsx";
  await downloadApiFile(
    `/api/v1/results/${endpoint}/?exam=${examId}`,
    `eduexam-results.${extension}`,
    format === "csv" ? "Đã xuất kết quả CSV." : "Đã xuất kết quả XLSX.",
  );
};

const exportUnsubmittedFile = async (examId: string, examName: string) => {
  await downloadApiFile(
    `/api/v1/results/exam-unsubmitted-export/?exam=${examId}`,
    `thi_sinh_chua_thi_${examName}.xlsx`,
    "Đã xuất danh sách thí sinh chưa thi (XLSX).",
  );
};

type ExamTab = "details" | "assignments" | "questions" | "rules" | "monitoring" | "results";
type NonMonitoringExamTab = Exclude<ExamTab, "monitoring">;

const queryTabValues = new Set<ExamTab>(["details", "assignments", "questions", "rules", "monitoring", "results"]);

const getQueryTab = (value: string | null): ExamTab | null =>
  value && queryTabValues.has(value as ExamTab) ? (value as ExamTab) : null;

export function ExamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = getQueryTab(searchParams.get("tab"));
  const [currentTab, setCurrentTab] = useState<NonMonitoringExamTab>(
    queryTab && queryTab !== "monitoring" ? queryTab : "details",
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [qualityCheckOpen, setQualityCheckOpen] = useState(false);
  const mutation = useMutationState();

  const examDetail = useAsyncList(
    async () => {
      if (!id) {
        throw new Error("Exam id is required.");
      }

      return apiRequest<ExamDetailRecord>(`/api/v1/exams/${id}/`);
    },
    [id],
  );

  const bulkPublishResults = async () => {
    if (!examDetail.data?.id) return;
    try {
      const { default: Swal } = await import("sweetalert2");
      const confirm = await Swal.fire({
        title: "Công bố tất cả?",
        text: `Tất cả kết quả đã hoàn tất chấm điểm của kỳ thi này sẽ được công bố.`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Đồng ý",
        cancelButtonText: "Hủy",
      });
      if (confirm.isConfirmed) {
        const res = await apiRequest<{ published_count: number }>("/api/v1/results/bulk-publish/", {
          method: "POST",
          body: { exam_id: examDetail.data.id },
        });
        notify.success(`Đã công bố thành công ${res.published_count} kết quả thi.`);
        void resultsList.reload();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Có lỗi xảy ra khi công bố điểm.";
      notify.error(message);
    }
  };


  const exam = examDetail.data;
  const isClass = exam?.mode === "class";

  const [resultsSearch, setResultsSearch] = useState("");
  const [activeResultsSubTab, setActiveResultsSubTab] = useState<"submitted" | "unsubmitted">("submitted");
  const activeTab: ExamTab =
    exam && exam.mode === "exam" && queryTab === "monitoring" && exam.enable_proctoring
      ? "monitoring"
      : exam && exam.mode === "exam" && queryTab && queryTab !== "monitoring"
        ? queryTab
        : currentTab;

  const resultsList = useAsyncList(
    async () => {
      if (!id || isClass || activeTab !== "results") {
        return { count: 0, results: [] as ResultRecord[] };
      }
      return apiRequest<PaginatedResponse<ResultRecord>>("/api/v1/results/", {
        query: { exam: id, page_size: 1000 },
      });
    },
    [id, isClass, activeTab],
  );

  const candidatesList = useAsyncList(
    async () => {
      if (!id || isClass || activeTab !== "results") {
        return [] as CandidateRecord[];
      }
      return apiRequest<CandidateRecord[]>("/api/v1/results/candidates/", {
        query: { exam: id },
      });
    },
    [id, isClass, activeTab],
  );
  const filteredResults = useMemo(() => {
    const allResults = resultsList.data?.results ?? [];
    if (!resultsSearch.trim()) {
      return allResults;
    }
    const query = resultsSearch.toLowerCase();
    return allResults.filter(
      (r) =>
        r.candidate.full_name.toLowerCase().includes(query) ||
        r.candidate.email.toLowerCase().includes(query)
    );
  }, [resultsList.data, resultsSearch]);

  const filteredUnsubmitted = useMemo(() => {
    const allCandidates = candidatesList.data ?? [];
    const unsubmitted = allCandidates.filter((c) => !c.has_submitted);
    if (!resultsSearch.trim()) {
      return unsubmitted;
    }
    const query = resultsSearch.toLowerCase();
    return unsubmitted.filter(
      (c) =>
        c.full_name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.username.toLowerCase().includes(query)
    );
  }, [candidatesList.data, resultsSearch]);

  const stats = useMemo(() => {
    if (!exam) {
      return {
        assigned: 0,
        directUsers: 0,
        groups: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
      };
    }

    const assigned = exam.assignment_summary.total_candidates;
    const directUsers = exam.assignment_summary.user_count;
    const groups = exam.assignment_summary.group_count;
    const completed = exam.delivery_summary.submitted_sessions;
    const inProgress = exam.delivery_summary.in_progress_sessions;
    const notStarted = Math.max(assigned - completed - inProgress, 0);

    return { assigned, directUsers, groups, completed, inProgress, notStarted };
  }, [exam]);

  const updateTab = (nextTab: ExamTab) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextTab === "monitoring") {
      nextSearchParams.set("tab", "monitoring");
    } else if (nextTab === "results") {
      nextSearchParams.set("tab", "results");
      setCurrentTab(nextTab);
    } else {
      nextSearchParams.delete("tab");
      setCurrentTab(nextTab);
    }
    setSearchParams(nextSearchParams);
  };

  const cloneExam = async () => {
    if (!exam) {
      return;
    }

    try {
      const created = await mutation.run(() =>
        apiRequest<ExamDetailRecord>(`/api/v1/exams/${exam.id}/clone/`, {
          method: "POST",
          body: {},
        }),
      );
      await notify.success(isClass ? "Class cloned." : "Exam cloned.");
      navigate(`/exams/${created.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : isClass ? "Unable to clone the class." : "Unable to clone the exam.";
      notify.error(message);
    }
  };

  const deleteExam = async () => {
    if (!exam) {
      return;
    }

    const confirmed = await notify.confirm({
      title: isClass ? "Delete this class?" : "Delete this exam?",
      text: `${isClass ? "Class" : "Exam"} "${exam.name}" will be permanently removed.`,
      confirmText: isClass ? "Delete Class" : "Delete Exam",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) {
      return;
    }

    try {
      await mutation.run(() =>
        apiRequest(`/api/v1/exams/${exam.id}/`, {
          method: "DELETE",
        }),
      );
      await notify.success(isClass ? "Class deleted." : "Exam deleted.");
      navigate("/exams");
    } catch (error) {
      const message = error instanceof Error ? error.message : isClass ? "Unable to delete the class." : "Unable to delete the exam.";
      notify.error(message);
    }
  };

  if (examDetail.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {examDetail.error}
      </div>
    );
  }

  if (examDetail.isLoading || !exam) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-gray-500">
          Loading exam details...
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {!isClass ? (
        <ExamQualityCheckDialog examId={exam.id} open={qualityCheckOpen} onOpenChange={setQualityCheckOpen} />
      ) : null}
      <PageHeader
        title={exam.name}
        description={
          exam.description ||
          (isClass
            ? "Learning class overview, enrollment summary, and subject access scope."
            : "Live exam overview, assignment summary, and current question composition.")
        }
        action={
          <div className="flex flex-wrap gap-2">
            {!isClass ? (
              <Button variant="outline" onClick={() => setQualityCheckOpen(true)}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Kiểm tra đề
              </Button>
            ) : null}
            {!isClass && exam.current_version && (
              <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                <Eye className="mr-2 h-4 w-4" />
                {"Preview Exam"}
              </Button>
            )}
            <Link to={`/exams/${exam.id}/assign`}>
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                {isClass ? "Manage Enrollment" : "Assign Candidates"}
              </Button>
            </Link>
            {!isClass && exam.enable_proctoring ? (
              <Link to={`/exams/${exam.id}?tab=monitoring`}>
                <Button variant="outline">
                  <Play className="mr-2 h-4 w-4" />
                  Live Monitor
                </Button>
              </Link>
            ) : null}
            <Link to={`/exams/${exam.id}/edit`}>
              <Button variant="outline">
                <Settings2 className="mr-2 h-4 w-4" />
                {isClass ? "Edit Class" : "Edit Exam"}
              </Button>
            </Link>
          </div>
        }
      />

      {(examDetail.error || mutation.error) ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {examDetail.error ?? mutation.error}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-blue-600" />
              {isClass ? "Enrolled" : "Assigned"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.assigned}</p>
            <p className="mt-1 text-sm text-gray-600">
              {isClass ? "Total learners with access" : "Total assignment scope"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-green-600" />
              {isClass ? "Direct Users" : "Submitted"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{isClass ? stats.directUsers : stats.completed}</p>
            <p className="mt-1 text-sm text-gray-600">
              {isClass ? "Assigned without a group" : "Completed sessions"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Play className="h-4 w-4 text-amber-600" />
              {isClass ? "Groups" : "In Progress"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{isClass ? stats.groups : stats.inProgress}</p>
            <p className="mt-1 text-sm text-gray-600">
              {isClass ? "Assigned learning groups" : "Active sessions now"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-gray-600" />
              {isClass ? "Mode" : "Not Started"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isClass ? (
              <>
                <Badge variant="outline" className={examModeBadgeClassNames[exam.mode]}>
                  Class
                </Badge>
                <p className="mt-3 text-sm text-gray-600">Materials and practice access only</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-gray-900">{stats.notStarted}</p>
                <p className="mt-1 text-sm text-gray-600">Awaiting first session</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={(value) => updateTab(value as ExamTab)} className="space-y-6">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="assignments">Assignments</TabsTrigger>
                {!isClass ? <TabsTrigger value="questions">Questions</TabsTrigger> : null}
                {!isClass ? <TabsTrigger value="rules">Random Rules</TabsTrigger> : null}
                {!isClass && exam.enable_proctoring ? <TabsTrigger value="monitoring">Monitoring</TabsTrigger> : null}
                {!isClass ? <TabsTrigger value="results">Results</TabsTrigger> : null}
              </TabsList>

              <TabsContent value="details" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Subject</p>
                    <p className="mt-2 font-medium text-gray-900">{exam.subject.name}</p>
                    <p className="text-xs text-gray-500">{exam.subject.code}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Mode</p>
                    <div className="mt-2">
                      <Badge variant="outline" className={examModeBadgeClassNames[exam.mode]}>
                        {isClass ? "Class" : "Exam"}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Status</p>
                    <div className="mt-2">
                      <StatusBadge status={(exam.lifecycle_phase === "results" ? "closed" : exam.lifecycle_phase || exam.status) as never} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">{isClass ? "Access Starts" : "Schedule Opens"}</p>
                    <p className="mt-2 font-medium text-gray-900">
                      {formatDateTime(exam.schedule_window?.opens_at ?? null)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">{isClass ? "Access Ends" : "Schedule Closes"}</p>
                    <p className="mt-2 font-medium text-gray-900">
                      {formatDateTime(exam.schedule_window?.closes_at ?? null)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">{isClass ? "Learning Access" : "Duration"}</p>
                    <p className="mt-2 font-medium text-gray-900">
                      {isClass ? "Subject materials and practice" : `${exam.duration_minutes} minutes`}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">{isClass ? "Roster Type" : "Passing Score"}</p>
                    <p className="mt-2 font-medium text-gray-900">{isClass ? "Learning roster" : `${exam.passing_score}%`}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">{isClass ? "Direct User Assignments" : "Max Attempts"}</p>
                    <p className="mt-2 font-medium text-gray-900">{isClass ? exam.assignment_summary.user_count : exam.max_attempts}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Current Version</p>
                    <p className="mt-2 font-medium text-gray-900">
                      {exam.current_version ? `v${exam.current_version.version_number}` : "No version"}
                    </p>
                  </div>
                </div>

                {isClass ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    Assigned learners inherit subject materials and practice access from this class.
                    Class records are not shown in the candidate exam delivery list and do not run
                    live proctoring sessions.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-gray-200 p-4">
                      <p className="text-sm text-gray-500">Shuffle Questions</p>
                      <p className="mt-2 font-medium text-gray-900">
                        {formatBoolean(exam.shuffle_questions)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-4">
                      <p className="text-sm text-gray-500">Show Results Immediately</p>
                      <p className="mt-2 font-medium text-gray-900">
                        {formatBoolean(exam.show_results_immediately)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-4">
                      <p className="text-sm text-gray-500">Proctoring</p>
                      <p className="mt-2 font-medium text-gray-900">
                        {formatBoolean(exam.enable_proctoring)}
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="assignments" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Assigned Groups</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {exam.assignment_summary.group_count}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Direct Users</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {exam.assignment_summary.user_count}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">{isClass ? "Total Learners" : "Total Candidates"}</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {exam.assignment_summary.total_candidates}
                    </p>
                  </div>
                </div>

                {exam.assignment_summary.assigned_groups.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                    {isClass ? "No groups enrolled yet." : "No groups assigned yet."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {exam.assignment_summary.assigned_groups.map((group) => (
                      <div
                        key={group.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{group.name}</p>
                          <p className="text-sm text-gray-500">{group.member_count} members</p>
                        </div>
                        <Badge variant="outline">{isClass ? "Enrollment Group" : `Group #${group.id}`}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="questions" className="space-y-3">
                {exam.current_version?.items.length ? (
                  exam.current_version.items.map((item) => (
                    <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Q{item.sort_order}</Badge>
                        <Badge variant="outline" className="capitalize">
                          {item.question.question_type.replaceAll("_", " ")}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {item.question.difficulty}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {item.source}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-900">{item.question.question_text}</p>
                      <p className="mt-2 text-xs text-gray-500">
                        Revision {item.question.revision_number} • {item.points} point(s)
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                    No question composition is available yet.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rules" className="space-y-3">
                {exam.current_version?.random_rules.length ? (
                  exam.current_version.random_rules.map((rule) => (
                    <div key={rule.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Rule {rule.sort_order}</Badge>
                        {rule.difficulty ? <Badge variant="outline">{rule.difficulty}</Badge> : null}
                        {rule.question_type ? <Badge variant="outline">{rule.question_type}</Badge> : null}
                        <Badge variant="outline">{rule.count} question(s)</Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        Tags: {rule.tag_ids.length ? rule.tag_ids.join(", ") : "Any"}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                    This exam does not use random selection rules.
                  </div>
                )}
              </TabsContent>

              {!isClass && exam.enable_proctoring ? (
                <TabsContent value="monitoring" className="space-y-3">
                  <LiveMonitoring embedded examId={exam.id} />
                </TabsContent>
              ) : null}

              {!isClass ? (
                <TabsContent value="results" className="space-y-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-2">
                      <Button
                        variant={activeResultsSubTab === "submitted" ? "default" : "outline"}
                        onClick={() => setActiveResultsSubTab("submitted")}
                      >
                        Đã nộp bài ({filteredResults.length})
                      </Button>
                      <Button
                        variant={activeResultsSubTab === "unsubmitted" ? "default" : "outline"}
                        onClick={() => setActiveResultsSubTab("unsubmitted")}
                      >
                        Chưa thi ({filteredUnsubmitted.length})
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {exam.status === "closed" || exam.status === "archived" ? (
                        <Button
                          className="bg-blue-600 text-white hover:bg-blue-700 font-semibold"
                          onClick={() => void bulkPublishResults()}
                          disabled={resultsList.isLoading}
                        >
                          Công bố tất cả điểm thi
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        onClick={() => void exportResultsFile("csv", exam.id.toString())}
                        disabled={resultsList.isLoading}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Xuất kết quả CSV
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void exportResultsFile("xlsx", exam.id.toString())}
                        disabled={resultsList.isLoading}
                      >
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Xuất kết quả XLSX
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void exportUnsubmittedFile(exam.id.toString(), exam.name)}
                        disabled={candidatesList.isLoading}
                      >
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Xuất DS chưa thi (XLSX)
                      </Button>
                    </div>
                  </div>

                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Tìm theo tên hoặc email..."
                      className="pl-10"
                      value={resultsSearch}
                      onChange={(e) => setResultsSearch(e.target.value)}
                    />
                  </div>

                  {activeResultsSubTab === "submitted" ? (
                    <div className="rounded-lg border border-gray-200 bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Thí sinh</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Điểm số</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tỷ lệ %</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Phạt</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Trạng thái</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Thời gian nộp</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Thời gian làm bài</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Hành động</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resultsList.isLoading ? (
                              <tr>
                                <td colSpan={8} className="py-8 text-center text-sm text-gray-500">
                                  Đang tải danh sách kết quả...
                                </td>
                              </tr>
                            ) : filteredResults.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="py-8 text-center text-sm text-gray-500">
                                  Không có kết quả nào.
                                </td>
                              </tr>
                            ) : (
                              filteredResults.map((result) => {
                                const percentage = Number(result.percentage);
                                return (
                                  <tr key={result.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-4 px-4">
                                      <p className="font-medium text-gray-900">{result.candidate.full_name}</p>
                                      <p className="text-xs text-gray-500">{result.candidate.email}</p>
                                    </td>
                                    <td className="py-4 px-4 text-sm text-gray-900">
                                      {result.score}/{result.total_marks}
                                    </td>
                                    <td className="py-4 px-4">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-20 rounded-full bg-gray-200">
                                          <div
                                            className={`h-2 rounded-full ${
                                              percentage >= (exam.passing_score ?? 60) ? "bg-green-600" : "bg-red-600"
                                            }`}
                                            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                                          />
                                        </div>
                                        <span className="text-sm text-gray-900">{percentage.toFixed(2)}%</span>
                                      </div>
                                    </td>
                                    <td className="py-4 px-4 text-sm text-gray-600">
                                      {result.penalty_percent_applied}%
                                    </td>
                                    <td className="py-4 px-4">
                                      <StatusBadge status={result.result_status} />
                                    </td>
                                    <td className="py-4 px-4 text-sm text-gray-600">
                                      {formatDateTime(result.completed_date)}
                                    </td>
                                    <td className="py-4 px-4 text-sm text-gray-600">
                                      {formatDuration(result.time_taken_minutes)}
                                    </td>
                                    <td className="py-4 px-4 text-sm">
                                      <Button size="sm" variant="ghost" title="Rà bài" asChild>
                                        <Link to={`/results/${result.id}/review`}>
                                          <FileSearch className="h-4 w-4 mr-1" />
                                          Rà bài
                                        </Link>
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-200 bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Thí sinh</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tài khoản</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {candidatesList.isLoading ? (
                              <tr>
                                <td colSpan={3} className="py-8 text-center text-sm text-gray-500">
                                  Đang tải danh sách thí sinh...
                                </td>
                              </tr>
                            ) : filteredUnsubmitted.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="py-8 text-center text-sm text-gray-500">
                                  Tất cả thí sinh đã thi hoặc không có thí sinh nào được gán.
                                </td>
                              </tr>
                            ) : (
                              filteredUnsubmitted.map((candidate) => (
                                <tr key={candidate.id} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="py-4 px-4">
                                    <p className="font-medium text-gray-900">{candidate.full_name}</p>
                                    <p className="text-xs text-gray-500">{candidate.email}</p>
                                  </td>
                                  <td className="py-4 px-4 text-sm font-mono text-gray-600">
                                    {candidate.username}
                                  </td>
                                  <td className="py-4 px-4">
                                    <Badge variant="secondary" className="border-amber-200 bg-amber-50 text-amber-700">
                                      Chưa thi
                                    </Badge>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>
              ) : null}
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isClass ? (
              <Button variant="outline" className="w-full justify-start" onClick={() => setQualityCheckOpen(true)}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Kiểm tra đề
              </Button>
            ) : null}
            {!isClass && exam.current_version && (
              <Button variant="outline" className="w-full justify-start" onClick={() => setPreviewOpen(true)}>
                <Eye className="mr-2 h-4 w-4" />
                {"Preview Exam"}
              </Button>
            )}
            <Link to={`/exams/${exam.id}/assign`} className="block">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                {isClass ? "Manage Enrollment" : "Manage Assignments"}
              </Button>
            </Link>
            {!isClass && exam.enable_proctoring ? (
              <Link to={`/exams/${exam.id}?tab=monitoring`} className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Eye className="mr-2 h-4 w-4" />
                  Monitor Delivery
                </Button>
              </Link>
            ) : null}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => void cloneExam()}
              disabled={mutation.isSubmitting}
            >
              <Copy className="mr-2 h-4 w-4" />
              {isClass ? "Clone Class" : "Clone Exam"}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700"
              onClick={() => void deleteExam()}
              disabled={mutation.isSubmitting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isClass ? "Delete Class" : "Delete Exam"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <ExamStudentPreview examId={exam.id} open={previewOpen} onOpenChange={setPreviewOpen} />
    </div>
  );
}
