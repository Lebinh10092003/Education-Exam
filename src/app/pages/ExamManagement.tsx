import { Link } from "react-router";
import { useEffect, useState } from "react";
import { Activity, BarChart3, Copy, Edit, Eye, Plus, Search, Trash2, Users } from "lucide-react";
import { notify } from "../lib/notify";

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
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";

interface SubjectOption {
  id: number;
  name: string;
  code: string;
  color: string;
}

interface ExamRecord {
  id: number;
  name: string;
  mode: "exam" | "class";
  subject: SubjectOption;
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
  current_version: {
    id: number;
    version_number: number;
    item_count: number;
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

const PAGE_SIZE = 20;
const examModeLabels = {
  exam: "Exam",
  class: "Class",
} as const;

const examModeBadgeClassNames = {
  exam: "border-blue-200 bg-blue-50 text-blue-700",
  class: "border-emerald-200 bg-emerald-50 text-emerald-700",
} as const;

const formatSchedule = (value: string | null, withDate = true) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: withDate ? "short" : undefined,
    timeStyle: "short",
  }).format(new Date(value));
};

// Trang thai theo lich: de "dang mo" nhung da qua gio dong -> hien "Da dong".
const displayExamStatus = (exam: { status: string; lifecycle_phase?: string | null }) => {
  const phase = exam.lifecycle_phase;
  if (!phase) return exam.status as never;
  return (phase === "results" ? "closed" : phase) as never;
};

export function ExamManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const mutation = useMutationState();

  const subjectsList = useAsyncList(
    async () => apiRequest<PaginatedResponse<SubjectOption>>("/api/v1/subjects/"),
    [],
  );

  const examsList = useAsyncList(
    async () =>
      apiRequest<PaginatedResponse<ExamRecord>>("/api/v1/exams/", {
        query: {
          page,
          search: debouncedSearch || undefined,
          mode: modeFilter !== "all" ? modeFilter : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          subject: subjectFilter !== "all" ? subjectFilter : undefined,
        },
      }),
    [page, debouncedSearch, modeFilter, statusFilter, subjectFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, modeFilter, statusFilter, subjectFilter]);

  const subjects = subjectsList.data?.results ?? [];
  const exams = examsList.data?.results ?? [];
  const totalCount = examsList.data?.count ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : rangeStart + exams.length - 1;

  const cloneExam = async (examId: number) => {
    await mutation.run(async () => {
      const currentExam = exams.find((item) => item.id === examId);
      await apiRequest(`/api/v1/exams/${examId}/clone/`, {
        method: "POST",
        body: {},
      });
      await examsList.reload();
      notify.success(currentExam?.mode === "class" ? "Class cloned." : "Exam cloned.");
    });
  };

  const deleteExam = async (exam: ExamRecord) => {
    const confirmed = await notify.confirm({
      title: exam.mode === "class" ? "Delete this class?" : "Delete this exam?",
      text: `${exam.mode === "class" ? "Class" : "Exam"} "${exam.name}" will be permanently removed.`,
      confirmText: exam.mode === "class" ? "Delete Class" : "Delete Exam",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) {
      return;
    }

    await mutation.run(async () => {
      await apiRequest(`/api/v1/exams/${exam.id}/`, {
        method: "DELETE",
      });
      await examsList.reload();
      notify.success(exam.mode === "class" ? "Class deleted." : "Exam deleted.");
    });
  };

  return (
    <div>
      <PageHeader
        title="Exam Management"
        description="Create, schedule, assign and manage exams or learning classes."
        action={
          <Link to="/exams/create">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Exam / Class
            </Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 xl:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search exams..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-full xl:w-[180px]">
                <SelectValue placeholder="All Modes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="exam">Exam</SelectItem>
                <SelectItem value="class">Class</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full xl:w-[200px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
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
          </div>
        </CardContent>
      </Card>

      {(examsList.error || subjectsList.error || mutation.error) && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {examsList.error || subjectsList.error || mutation.error}
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4 md:hidden">
            {examsList.isLoading ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                Loading exams...
              </div>
            ) : exams.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                No exams matched the current filters.
              </div>
            ) : (
              exams.map((exam) => {
                const totalCandidates = exam.assignment_summary.total_candidates;
                const submittedSessions = exam.delivery_summary.submitted_sessions;
                const progressPercent =
                  totalCandidates > 0 ? Math.min(100, (submittedSessions / totalCandidates) * 100) : 0;

                return (
                  <div key={exam.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">{exam.name}</p>
                        <p className="mt-1 text-xs text-gray-500">{`Updated ${formatSchedule(exam.updated_at)}`}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge
                          variant="outline"
                          className={examModeBadgeClassNames[exam.mode]}
                        >
                          {examModeLabels[exam.mode]}
                        </Badge>
                        <StatusBadge status={displayExamStatus(exam)} />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{exam.subject.name}</Badge>
                      {exam.mode === "exam" ? (
                        <>
                          <Badge variant="outline">{`${exam.current_version?.item_count ?? 0} questions`}</Badge>
                          <Badge variant="outline">{exam.duration_minutes} min</Badge>
                          {exam.enable_proctoring ? <Badge variant="outline">Proctored</Badge> : null}
                        </>
                      ) : (
                        <Badge variant="outline">Learning access only</Badge>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">
                          {exam.mode === "exam" ? "Schedule" : "Access"}
                        </p>
                        {exam.mode === "exam" ? (
                          <>
                            <p>{formatSchedule(exam.schedule_window?.opens_at ?? null)}</p>
                            <p>to {formatSchedule(exam.schedule_window?.closes_at ?? null, false)}</p>
                          </>
                        ) : (
                          <>
                            <p>Learning container</p>
                            <p>No delivery window</p>
                          </>
                        )}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">
                          {exam.mode === "exam" ? "Gán nhóm" : "Ghi danh"}
                        </p>
                        <p>{totalCandidates} {exam.mode === "exam" ? "candidates" : "learners"}</p>
                        <p>{exam.assignment_summary.group_count} groups</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      {exam.mode === "exam" ? (
                        <>
                          <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
                            <span>Progress</span>
                            <span>{submittedSessions}/{totalCandidates || 0}</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-200">
                            <div className="h-2 rounded-full bg-green-600" style={{ width: `${progressPercent}%` }} />
                          </div>
                        </>
                      ) : (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                          Class records grant subject materials and practice access without a fixed delivery session.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link to={`/exams/${exam.id}`}>
                        <Button size="sm" variant="outline">
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </Link>
                      {exam.mode === "exam" ? (
                        <Link to={`/exams/${exam.id}?tab=results`}>
                          <Button size="sm" variant="outline">
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Results
                          </Button>
                        </Link>
                      ) : null}
                      {exam.mode === "exam" &&
                        (exam.status === "open" || exam.delivery_summary.in_progress_sessions > 0) && (
                        <Link to={`/exams/${exam.id}?tab=monitoring`}>
                          <Button size="sm" variant="outline">
                            <Activity className="mr-2 h-4 w-4" />
                            Monitor
                          </Button>
                        </Link>
                        )}
                      <Link to={`/exams/${exam.id}/edit`}>
                        <Button size="sm" variant="outline">
                          <Edit className="mr-2 h-4 w-4" />
                          {exam.mode === "exam" ? "Edit" : "Edit Class"}
                        </Button>
                      </Link>
                      <Link to={`/exams/${exam.id}/assign`}>
                        <Button size="sm" variant="outline">
                          <Users className="mr-2 h-4 w-4" />
                          {exam.mode === "exam" ? "Assign" : "Enroll"}
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void cloneExam(exam.id)}
                        disabled={mutation.isSubmitting}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Clone
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void deleteExam(exam)}
                        disabled={mutation.isSubmitting}
                      >
                        <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1320px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Exam Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Mode</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Subject</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Schedule</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Composition</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Gán nhóm</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Progress</th>
                  <th className="sticky right-0 z-[1] text-left py-3 px-4 text-sm font-semibold text-gray-700 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {examsList.isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-sm text-gray-500">
                      Loading exams...
                    </td>
                  </tr>
                ) : exams.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-sm text-gray-500">
                      No exams matched the current filters.
                    </td>
                  </tr>
                ) : (
                  exams.map((exam) => {
                    const totalCandidates = exam.assignment_summary.total_candidates;
                    const submittedSessions = exam.delivery_summary.submitted_sessions;
                    const progressPercent =
                      totalCandidates > 0 ? Math.min(100, (submittedSessions / totalCandidates) * 100) : 0;

                    return (
                      <tr key={exam.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4 min-w-[220px] max-w-[300px]">
                          <p className="font-semibold text-gray-900 leading-snug">{exam.name}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {`Updated ${formatSchedule(exam.updated_at)}`}
                          </p>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="outline" className={examModeBadgeClassNames[exam.mode]}>
                            {examModeLabels[exam.mode]}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="outline">{exam.subject.name}</Badge>
                        </td>
                        <td className="py-4 px-4">
                          <StatusBadge status={displayExamStatus(exam)} />
                        </td>
                        <td className="py-4 px-4">
                          {exam.mode === "exam" ? (
                            <div className="text-sm whitespace-nowrap">
                              <p className="text-gray-900">
                                {formatSchedule(exam.schedule_window?.opens_at ?? null)}
                              </p>
                              <p className="text-gray-500">
                                → {formatSchedule(exam.schedule_window?.closes_at ?? null, false)}
                              </p>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600">
                              <p className="text-gray-900">Learning container</p>
                              <p className="text-gray-500">No delivery window</p>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {exam.mode === "exam" ? (
                            <div className="text-sm text-gray-700 whitespace-nowrap">
                              <p>{`${exam.current_version?.item_count ?? 0} questions`}</p>
                              <p className="text-gray-500">
                                {`${exam.duration_minutes} min • v${exam.current_version?.version_number ?? 1}`}
                              </p>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-700 min-w-[170px]">
                              <p>Practice & materials access</p>
                              <p className="text-gray-500">No fixed paper is delivered</p>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 min-w-[180px]">
                          {exam.assignment_summary.assigned_groups.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {exam.assignment_summary.assigned_groups.slice(0, 2).map((group) => (
                                <Badge key={group.id} variant="outline" className="text-xs">
                                  {group.name}
                                </Badge>
                              ))}
                              {exam.assignment_summary.assigned_groups.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{exam.assignment_summary.assigned_groups.length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Not assigned</span>
                          )}
                        </td>
                        <td className="py-4 px-4 min-w-[170px]">
                          {exam.mode === "class" ? (
                            <span className="text-sm text-emerald-700">Learning access only</span>
                          ) : totalCandidates > 0 ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[80px] overflow-hidden">
                                  <div
                                    className="brand-gradient h-2 rounded-full"
                                    style={{ width: `${progressPercent}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-600 whitespace-nowrap">
                                  {submittedSessions}/{totalCandidates}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                {`${exam.delivery_summary.in_progress_sessions} in progress`}
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">No candidates assigned</span>
                          )}
                        </td>
                        <td className="sticky right-0 bg-white py-4 px-4 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)] dark:bg-[var(--shell-surface)]">
                          <div className="flex gap-1">
                            <Link to={`/exams/${exam.id}`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                title={exam.mode === "exam" ? "View" : "View Class"}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                            {exam.mode === "exam" ? (
                              <Link to={`/exams/${exam.id}?tab=results`}>
                                <Button size="sm" variant="ghost" title="Results">
                                  <BarChart3 className="w-4 h-4" />
                                </Button>
                              </Link>
                            ) : null}
                            {exam.mode === "exam" &&
                              (exam.status === "open" || exam.delivery_summary.in_progress_sessions > 0) && (
                              <Link to={`/exams/${exam.id}?tab=monitoring`}>
                                <Button size="sm" variant="ghost" title="Monitor">
                                  <Activity className="w-4 h-4" />
                                </Button>
                              </Link>
                              )}
                            <Link to={`/exams/${exam.id}/edit`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                title={exam.mode === "exam" ? "Edit" : "Edit Class"}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Link to={`/exams/${exam.id}/assign`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                title={exam.mode === "exam" ? "Assign" : "Enroll"}
                              >
                                <Users className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Clone"
                              onClick={() => void cloneExam(exam.id)}
                              disabled={mutation.isSubmitting}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Delete"
                              onClick={() => void deleteExam(exam)}
                              disabled={mutation.isSubmitting}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <RangeSummary start={rangeStart} end={rangeEnd} total={totalCount} unit="records" />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!examsList.data?.previous || examsList.isLoading}
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
                disabled={!examsList.data?.next || examsList.isLoading}
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
