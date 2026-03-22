import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Clock,
  FileCheck,
  MessageSquare,
  Search,
  Send,
} from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { notify } from "../lib/notify";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";

interface ExamOption {
  id: number;
  name: string;
}

interface ManualGradingTaskRecord {
  id: number;
  status: "pending" | "graded";
  max_points: string;
  question_text: string;
  answer_text: string;
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
  graded_at: string | null;
  manual_grade?: {
    score_awarded: string;
    feedback: string;
    graded_at: string;
    graded_by: {
      id: number;
      email: string;
      full_name: string;
    };
  } | null;
}

const PAGE_SIZE = 20;

const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";

export function ManualGrading() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [examFilter, setExamFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedTask, setSelectedTask] = useState<ManualGradingTaskRecord | null>(null);
  const [scoreAwarded, setScoreAwarded] = useState("");
  const [feedback, setFeedback] = useState("");

  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const mutation = useMutationState();

  const examsList = useAsyncList(
    () => apiRequest<PaginatedResponse<ExamOption>>("/api/v1/exams/", { query: { page_size: 100 } }),
    [],
  );

  const tasksList = useAsyncList(
    () =>
      apiRequest<PaginatedResponse<ManualGradingTaskRecord>>("/api/v1/grading/tasks/", {
        query: {
          page,
          search: debouncedSearch || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          exam: examFilter === "all" ? undefined : examFilter,
        },
      }),
    [page, debouncedSearch, statusFilter, examFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, examFilter]);

  useEffect(() => {
    if (!selectedTask) {
      setScoreAwarded("");
      setFeedback("");
      return;
    }

    setScoreAwarded(selectedTask.manual_grade?.score_awarded ?? "");
    setFeedback(selectedTask.manual_grade?.feedback ?? "");
  }, [selectedTask]);

  const tasks = tasksList.data?.results ?? [];
  const exams = examsList.data?.results ?? [];
  const totalCount = tasksList.data?.count ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : rangeStart + tasks.length - 1;

  const stats = useMemo(() => {
    const pending = tasks.filter((task) => task.status === "pending").length;
    const graded = tasks.filter((task) => task.status === "graded").length;
    return {
      pending,
      graded,
      inProgress: pending > 0 ? 1 : 0,
    };
  }, [tasks]);

  const submitGrade = async () => {
    if (!selectedTask) {
      return;
    }

    if (!scoreAwarded.trim()) {
      notify.error("Score is required.");
      return;
    }

    try {
      const updatedTask = await mutation.run(() =>
        apiRequest<ManualGradingTaskRecord>(`/api/v1/grading/tasks/${selectedTask.id}/grade/`, {
          method: "POST",
          body: {
            score_awarded: scoreAwarded,
            feedback,
          },
        }),
      );
      notify.success("Manual grade saved.");
      setSelectedTask(updatedTask);
      await tasksList.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save the manual grade.";
      notify.error(message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Manual Grading Queue"
        description="Review subjective answers and submit grades using the live grading task API."
      />

      {(tasksList.error || examsList.error || mutation.error) ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {tasksList.error ?? examsList.error ?? mutation.error}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-amber-600" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.pending}</p>
            <p className="mt-1 text-sm text-gray-600">Pending tasks on this page</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCheck className="h-4 w-4 text-blue-600" />
              In Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.inProgress}</p>
            <p className="mt-1 text-sm text-gray-600">Active review panel</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Graded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.graded}</p>
            <p className="mt-1 text-sm text-gray-600">Already graded on this page</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by candidate, exam, or answer text..."
                className="pl-10"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="graded">Graded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={examFilter} onValueChange={setExamFilter}>
              <SelectTrigger className="w-full lg:w-[260px]">
                <SelectValue placeholder="Exam" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exams</SelectItem>
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={String(exam.id)}>
                    {exam.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 md:hidden">
            {tasksList.isLoading ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                Loading manual grading tasks...
              </div>
            ) : tasks.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                No grading tasks matched the current filters.
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{task.candidate.full_name}</p>
                      <p className="truncate text-sm text-gray-500">{task.candidate.email}</p>
                      <p className="mt-2 text-sm text-gray-700">{task.exam.name}</p>
                      <p className="text-xs text-gray-500">{task.exam.subject_name}</p>
                    </div>
                    <Badge
                      className={
                        task.status === "graded"
                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                          : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                      }
                    >
                      {task.status}
                    </Badge>
                  </div>

                  <p className="mt-4 line-clamp-3 text-sm text-gray-700">{task.question_text}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline">{task.max_points} pts</Badge>
                    {task.manual_grade?.graded_by?.full_name ? (
                      <Badge variant="outline">By {task.manual_grade.graded_by.full_name}</Badge>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <Button variant="outline" size="sm" onClick={() => setSelectedTask(task)}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Review Answer
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Candidate</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Exam</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Question</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Max Points</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Graded At</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasksList.isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                      Loading manual grading tasks...
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                      No grading tasks matched the current filters.
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-900">{task.candidate.full_name}</p>
                        <p className="text-xs text-gray-500">{task.candidate.email}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-gray-900">{task.exam.name}</p>
                        <p className="text-xs text-gray-500">{task.exam.subject_name}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        <p className="line-clamp-2">{task.question_text}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{task.max_points}</td>
                      <td className="px-4 py-4">
                        <Badge
                          className={
                            task.status === "graded"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                          }
                        >
                          {task.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {formatDateTime(task.graded_at)}
                      </td>
                      <td className="px-4 py-4">
                        <Button variant="outline" size="sm" onClick={() => setSelectedTask(task)}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Showing <strong>{rangeStart}</strong>-<strong>{rangeEnd}</strong> of{" "}
              <strong>{totalCount}</strong> grading task(s)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!tasksList.data?.previous || tasksList.isLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Page {page}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!tasksList.data?.next || tasksList.isLoading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet open={selectedTask !== null} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{selectedTask?.candidate.full_name}</SheetTitle>
            <SheetDescription>{selectedTask?.exam.name}</SheetDescription>
          </SheetHeader>

          {selectedTask ? (
            <div className="space-y-6 py-6">
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge variant="outline">{selectedTask.exam.subject_name}</Badge>
                  <Badge variant="outline">{selectedTask.max_points} pts</Badge>
                  <Badge
                    className={
                      selectedTask.status === "graded"
                        ? "bg-green-100 text-green-800 hover:bg-green-100"
                        : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                    }
                  >
                    {selectedTask.status}
                  </Badge>
                </div>
                <h3 className="font-medium text-gray-900">Question</h3>
                <p className="mt-2 text-sm text-gray-700">{selectedTask.question_text}</p>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-medium text-gray-900">Candidate Answer</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                  {selectedTask.answer_text || "No answer text submitted."}
                </p>
              </div>

              <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                <div>
                  <Label htmlFor="score-awarded">Score Awarded</Label>
                  <Input
                    id="score-awarded"
                    type="number"
                    step="0.01"
                    min="0"
                    max={selectedTask.max_points}
                    className="mt-2"
                    value={scoreAwarded}
                    onChange={(event) => setScoreAwarded(event.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="feedback">Feedback</Label>
                  <Textarea
                    id="feedback"
                    className="mt-2"
                    rows={6}
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    placeholder="Add grading notes or feedback for the submission"
                  />
                </div>

                {selectedTask.manual_grade ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    Last graded by {selectedTask.manual_grade.graded_by.full_name} on{" "}
                    {formatDateTime(selectedTask.manual_grade.graded_at)}.
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <Button onClick={() => void submitGrade()} disabled={mutation.isSubmitting}>
                    <Send className="mr-2 h-4 w-4" />
                    {mutation.isSubmitting ? "Saving..." : "Submit Grade"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
