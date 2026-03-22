import { Link } from "react-router";
import { useEffect, useState } from "react";
import { Copy, Edit, Eye, Plus, Search, Trash2, Users } from "lucide-react";
import { notify } from "../lib/notify";

import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
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
  subject: SubjectOption;
  description: string;
  status: "draft" | "scheduled" | "open" | "paused" | "closed" | "archived";
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

const formatSchedule = (value: string | null, withDate = true) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: withDate ? "short" : undefined,
    timeStyle: "short",
  }).format(new Date(value));
};

export function ExamManagement() {
  const [searchQuery, setSearchQuery] = useState("");
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
          status: statusFilter !== "all" ? statusFilter : undefined,
          subject: subjectFilter !== "all" ? subjectFilter : undefined,
        },
      }),
    [page, debouncedSearch, statusFilter, subjectFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, subjectFilter]);

  const subjects = subjectsList.data?.results ?? [];
  const exams = examsList.data?.results ?? [];
  const totalCount = examsList.data?.count ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : rangeStart + exams.length - 1;

  const cloneExam = async (examId: number) => {
    await mutation.run(async () => {
      await apiRequest(`/api/v1/exams/${examId}/clone/`, {
        method: "POST",
        body: {},
      });
      await examsList.reload();
      notify.success("Exam cloned.");
    });
  };

  const deleteExam = async (exam: ExamRecord) => {
    const confirmed = await notify.confirm({
      title: "Delete this exam?",
      text: `Exam "${exam.name}" will be permanently removed.`,
      confirmText: "Delete Exam",
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
      notify.success("Exam deleted.");
    });
  };

  return (
    <div>
      <PageHeader
        title="Exam Management"
        description="Create, schedule, assign, and monitor exams with live backend data."
        action={
          <Link to="/exams/create">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create New Exam
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
                        <p className="mt-1 text-xs text-gray-500">Updated {formatSchedule(exam.updated_at)}</p>
                      </div>
                      <StatusBadge status={exam.status} />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{exam.subject.name}</Badge>
                      <Badge variant="outline">{exam.current_version?.item_count ?? 0} questions</Badge>
                      <Badge variant="outline">{exam.duration_minutes} min</Badge>
                      {exam.enable_proctoring ? <Badge variant="outline">Proctored</Badge> : null}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">Schedule</p>
                        <p>{formatSchedule(exam.schedule_window?.opens_at ?? null)}</p>
                        <p>to {formatSchedule(exam.schedule_window?.closes_at ?? null, false)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">Assigned</p>
                        <p>{totalCandidates} candidates</p>
                        <p>{exam.assignment_summary.group_count} groups</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
                        <span>Progress</span>
                        <span>{submittedSessions}/{totalCandidates || 0}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200">
                        <div className="h-2 rounded-full bg-green-600" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link to={`/exams/${exam.id}`}>
                        <Button size="sm" variant="outline">
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </Link>
                      {(exam.status === "open" || exam.delivery_summary.in_progress_sessions > 0) && (
                        <Link to={`/exams/${exam.id}/monitor`}>
                          <Button size="sm" variant="outline">
                            <Eye className="mr-2 h-4 w-4" />
                            Monitor
                          </Button>
                        </Link>
                      )}
                      <Link to={`/exams/${exam.id}/edit`}>
                        <Button size="sm" variant="outline">
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      </Link>
                      <Link to={`/exams/${exam.id}/assign`}>
                        <Button size="sm" variant="outline">
                          <Users className="mr-2 h-4 w-4" />
                          Assign
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
            <table className="w-full min-w-[1160px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Exam Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Subject</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Schedule</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Composition</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Assigned</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Progress</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {examsList.isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-gray-500">
                      Loading exams...
                    </td>
                  </tr>
                ) : exams.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-gray-500">
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
                        <td className="py-4 px-4">
                          <p className="font-medium text-gray-900">{exam.name}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Updated {formatSchedule(exam.updated_at)}
                          </p>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="outline">{exam.subject.name}</Badge>
                        </td>
                        <td className="py-4 px-4">
                          <StatusBadge status={exam.status} />
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm">
                            <p className="text-gray-900">
                              {formatSchedule(exam.schedule_window?.opens_at ?? null)}
                            </p>
                            <p className="text-gray-500">
                              to {formatSchedule(exam.schedule_window?.closes_at ?? null, false)}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-700">
                            <p>{exam.current_version?.item_count ?? 0} questions</p>
                            <p className="text-gray-500">
                              {exam.duration_minutes} min • v{exam.current_version?.version_number ?? 1}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
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
                        <td className="py-4 px-4">
                          {totalCandidates > 0 ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[80px]">
                                  <div
                                    className="bg-green-600 h-2 rounded-full"
                                    style={{ width: `${progressPercent}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-600 whitespace-nowrap">
                                  {submittedSessions}/{totalCandidates}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                {exam.delivery_summary.in_progress_sessions} in progress
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">No candidates assigned</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-1">
                            <Link to={`/exams/${exam.id}`}>
                              <Button size="sm" variant="ghost" title="View">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                            {(exam.status === "open" || exam.delivery_summary.in_progress_sessions > 0) && (
                              <Link to={`/exams/${exam.id}/monitor`}>
                                <Button size="sm" variant="ghost" title="Monitor">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </Link>
                            )}
                            <Link to={`/exams/${exam.id}/edit`}>
                              <Button size="sm" variant="ghost" title="Edit">
                                <Edit className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Link to={`/exams/${exam.id}/assign`}>
                              <Button size="sm" variant="ghost" title="Assign">
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
            <p className="text-sm text-gray-600">
              Showing <strong>{rangeStart}-{rangeEnd}</strong> of <strong>{totalCount}</strong> exams
            </p>
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
