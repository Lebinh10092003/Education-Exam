import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Calendar,
  Clock3,
  FileText,
  PlayCircle,
  Search,
  Shield,
} from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
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
import {
  type CandidateAssignedExam,
  formatExamSchedule,
  getExamAvailabilityLabel,
  getExamAvailabilityState,
  getExamAvailabilityTone,
  getExamPrimaryAction,
} from "./candidateExamShared";

const PAGE_SIZE = 100;

export function MyExams() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  const examsList = useAsyncList(
    () =>
      apiRequest<PaginatedResponse<CandidateAssignedExam>>("/api/v1/my-exams/", {
        query: { page_size: PAGE_SIZE },
      }),
    [],
  );

  const exams = examsList.data?.results ?? [];
  const subjects = useMemo(
    () => Array.from(new Set(exams.map((exam) => exam.subject.name))).sort(),
    [exams],
  );

  const filteredExams = useMemo(() => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase();
    return exams.filter((exam) => {
      const availability = getExamAvailabilityState(exam);
      const matchesSearch =
        !normalizedSearch ||
        [exam.name, exam.subject.name, exam.description]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesStatus = statusFilter === "all" || availability === statusFilter;
      const matchesSubject = subjectFilter === "all" || exam.subject.name === subjectFilter;
      return matchesSearch && matchesStatus && matchesSubject;
    });
  }, [debouncedSearch, exams, statusFilter, subjectFilter]);

  return (
    <div>
      <PageHeader
        title="My Exams"
        description="Track assigned exams, readiness details, and active sessions from one place."
        action={
          <Button variant="outline" asChild>
            <Link to="/candidate/dashboard">Back to Dashboard</Link>
          </Button>
        }
      />

      {examsList.error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {examsList.error}
        </div>
      ) : null}

      <Card className="mb-6 border-slate-200">
        <CardContent className="grid gap-4 p-6 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search exams or subjects..."
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="resume">In Progress</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="locked">Attempts Used</SelectItem>
            </SelectContent>
          </Select>

          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map((subject) => (
                <SelectItem key={subject} value={subject}>
                  {subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {examsList.isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-slate-500">Loading exams...</CardContent>
        </Card>
      ) : filteredExams.length ? (
        <div className="grid gap-4">
          {filteredExams.map((exam) => {
            const action = getExamPrimaryAction(exam);
            const availability = getExamAvailabilityState(exam);

            return (
              <Card key={exam.id} className="overflow-hidden border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{exam.subject.name}</Badge>
                        <Badge variant="outline" className={getExamAvailabilityTone(exam)}>
                          {getExamAvailabilityLabel(exam)}
                        </Badge>
                        {exam.enable_proctoring ? (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                            Proctored
                          </Badge>
                        ) : null}
                      </div>

                      <CardTitle className="text-xl text-slate-950">{exam.name}</CardTitle>
                      <p className="mt-2 text-sm text-slate-600">
                        {exam.description || "No description provided for this exam."}
                      </p>

                      <div className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span>{formatExamSchedule(exam.schedule.opens_at, exam.schedule.closes_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-slate-400" />
                          <span>{exam.duration_minutes} minutes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-400" />
                          <span>{exam.question_count} questions</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-slate-400" />
                          <span>
                            Attempts {exam.attempts_used}/{exam.max_attempts}
                          </span>
                        </div>
                      </div>

                      {availability === "upcoming" ? (
                        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                          This exam is scheduled for a future window. Open the details page to review instructions before it starts.
                        </div>
                      ) : null}

                      {availability === "locked" ? (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                          You have used all allowed attempts for this exam.
                        </div>
                      ) : null}
                    </div>

                    <div className="w-full shrink-0 xl:w-56">
                      {action.disabled ? (
                        <Button className="w-full" disabled>
                          {action.label}
                        </Button>
                      ) : (
                        <Button asChild className="w-full">
                          <Link
                            to={action.href}
                            state={action.href.includes("/instructions") ? { exam } : undefined}
                          >
                            <PlayCircle className="h-4 w-4" />
                            {action.label}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-10 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-base font-medium text-slate-900">No exams matched the current filters.</p>
            <p className="mt-1 text-sm text-slate-500">Try another search keyword or clear one of the filters.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
