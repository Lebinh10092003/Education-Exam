import { useMemo, useState } from "react";
import { Link } from "react-router";
import { BookOpen, CalendarDays, Clock, PlayCircle, RotateCcw, Search } from "lucide-react";

import { apiRequest, type PaginatedResponse } from "../lib/http";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";

interface AssignedExam {
  id: number;
  name: string;
  description: string;
  status: string;
  duration_minutes: number;
  passing_score: string;
  max_attempts: number;
  question_count: number;
  enable_proctoring: boolean;
  subject: {
    id: number;
    name: string;
    code: string;
    color: string;
  };
  schedule: {
    opens_at: string | null;
    closes_at: string | null;
  };
  attempts_used: number;
  attempts_remaining: number;
  active_session_id: number | null;
}

const formatSchedule = (opensAt: string | null, closesAt: string | null) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  if (!opensAt && !closesAt) {
    return "No schedule window";
  }
  if (opensAt && closesAt) {
    return `${formatter.format(new Date(opensAt))} → ${formatter.format(new Date(closesAt))}`;
  }
  return opensAt ? `Opens ${formatter.format(new Date(opensAt))}` : `Closes ${formatter.format(new Date(closesAt!))}`;
};

export function PracticeExam() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 250);
  const examsList = useAsyncList(
    () => apiRequest<PaginatedResponse<AssignedExam>>("/api/v1/my-exams/", { query: { page_size: 100 } }),
    [],
  );

  const filteredExams = useMemo(() => {
    const exams = examsList.data?.results ?? [];
    if (!debouncedSearch) {
      return exams;
    }
    const normalizedSearch = debouncedSearch.toLowerCase();
    return exams.filter((exam) =>
      [exam.name, exam.subject.name, exam.description].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      ),
    );
  }, [debouncedSearch, examsList.data]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Exams</h1>
          <p className="text-gray-600 mt-2">Assigned exams and active sessions for the current candidate.</p>
        </div>

        {examsList.error ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {examsList.error}
          </div>
        ) : null}

        <div className="mb-6 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-10"
            placeholder="Search assigned exams..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredExams.map((exam) => {
            const isResume = Boolean(exam.active_session_id);
            const canStart = exam.attempts_remaining > 0 || isResume;

            return (
              <Card key={exam.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <Badge variant="outline">{exam.subject.name}</Badge>
                    <div className="flex gap-2">
                      <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{exam.status}</Badge>
                      {exam.enable_proctoring ? (
                        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Proctored</Badge>
                      ) : null}
                    </div>
                  </div>
                  <CardTitle className="text-lg">{exam.name}</CardTitle>
                  <p className="text-sm text-gray-600">{exam.description || "No description provided."}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 mb-5 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      <span>{exam.question_count} questions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{exam.duration_minutes} minutes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" />
                      <span>{formatSchedule(exam.schedule.opens_at, exam.schedule.closes_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Attempts</span>
                      <span className="font-medium text-gray-900">
                        {exam.attempts_used}/{exam.max_attempts}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Passing Score</span>
                      <span className="font-medium text-gray-900">{exam.passing_score}</span>
                    </div>
                  </div>
                  {canStart ? (
                    <Link to={`/candidate/exam/${exam.id}`}>
                      <Button className="w-full">
                        {isResume ? <RotateCcw className="w-4 h-4 mr-2" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                        {isResume ? "Resume Exam" : "Start Exam"}
                      </Button>
                    </Link>
                  ) : (
                    <Button className="w-full" disabled>
                      Attempts Exhausted
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {!examsList.isLoading && !filteredExams.length ? (
          <Card className="mt-6">
            <CardContent className="p-8 text-center text-sm text-gray-500">
              No exams match the current search.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
