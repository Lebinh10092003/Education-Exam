import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Award,
  BookOpen,
  CalendarDays,
  Clock3,
  FileCheck,
  FileText,
  RotateCcw,
} from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { apiRequest } from "../lib/http";
import { useAsyncList } from "../hooks/useAsyncList";
import { getExamPrimaryAction } from "./candidateExamShared";

interface CandidateDashboardExam {
  id: number;
  name: string;
  description: string;
  status: string;
  duration_minutes: number;
  passing_score: string;
  max_attempts: number;
  question_count: number;
  enable_proctoring: boolean;
  attempts_used: number;
  attempts_remaining: number;
  active_session_id: number | null;
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
}

interface CandidateDashboardResult {
  id: number;
  workflow_status: string;
  publish_state: string;
  score: string;
  total_marks: string;
  percentage: string;
  result_status: string;
  passed: boolean | null;
  completed_date: string | null;
  published_at: string | null;
  time_taken_minutes: number;
  exam: {
    id: number;
    name: string;
    subject_name: string;
  };
}

interface CandidateDashboardMaterial {
  id: number;
  title: string;
  description: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  download_count: number;
  subject: {
    id: number;
    name: string;
    code: string;
  };
}

interface CandidateDashboardOverview {
  stats: {
    assigned_exam_count: number;
    upcoming_exam_count: number;
    published_result_count: number;
    average_percentage: string;
    active_material_count: number;
  };
  upcoming_exams: CandidateDashboardExam[];
  recent_results: CandidateDashboardResult[];
  recent_materials: CandidateDashboardMaterial[];
}

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "Not scheduled";
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const formatNumber = (value: string | number) => Number(value || 0).toFixed(2).replace(/\.00$/, "");

function ExamCountdownWidget({ opensAt, examName }: { opensAt: string; examName: string }) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const target = new Date(opensAt).getTime();
    
    const calculateTime = () => {
      const now = new Date().getTime();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [opensAt]);

  if (!timeLeft) return null;

  return (
    <div className="mb-6 rounded-2xl border border-blue-200/50 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 p-5 backdrop-blur-md shadow-lg glass-panel">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:text-blue-300">
            Next Exam Countdown
          </span>
          <h3 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{examName}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Exam starts on {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(opensAt))}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {[
            { label: "Days", value: timeLeft.days },
            { label: "Hrs", value: timeLeft.hours },
            { label: "Mins", value: timeLeft.minutes },
            { label: "Secs", value: timeLeft.seconds },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center min-w-[3.5rem] rounded-xl bg-white/70 dark:bg-slate-800/70 p-2 shadow-sm border border-slate-200/50 backdrop-blur-sm">
              <span className="font-mono text-xl font-bold text-blue-600 dark:text-blue-400">
                {String(item.value).padStart(2, "0")}
              </span>
              <span className="text-[10px] uppercase font-medium text-gray-500 dark:text-gray-400">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CandidateDashboard() {
  const dashboard = useAsyncList(
    () => apiRequest<CandidateDashboardOverview>("/api/v1/my-dashboard/overview/"),
    [],
  );

  const overview = dashboard.data;

  const nextUpcomingExam = useMemo(() => {
    if (!overview?.upcoming_exams) return null;
    const now = new Date();
    const upcoming = overview.upcoming_exams
      .filter((e) => e.schedule.opens_at && new Date(e.schedule.opens_at) > now)
      .sort((a, b) => new Date(a.schedule.opens_at!).getTime() - new Date(b.schedule.opens_at!).getTime());
    return upcoming[0] ?? null;
  }, [overview?.upcoming_exams]);

  return (
    <div>
      <PageHeader
        title="Student Portal"
        description="Overview of assigned exams, published results, and active study materials."
        action={
          <>
            <Button variant="outline" asChild>
              <Link to="/candidate/exams">My Exams</Link>
            </Button>
            <Button asChild>
              <Link to="/candidate/practice">Open Practice</Link>
            </Button>
          </>
        }
      />

      {dashboard.error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {dashboard.error}
        </div>
      ) : null}

      {nextUpcomingExam && nextUpcomingExam.schedule.opens_at && (
        <ExamCountdownWidget
          opensAt={nextUpcomingExam.schedule.opens_at}
          examName={nextUpcomingExam.name}
        />
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4">
        <Card className="glass-panel transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
            <CardTitle className="flex items-start gap-2 text-sm leading-snug sm:items-center sm:text-base">
              <FileCheck className="h-4 w-4 text-blue-600" />
              Assigned Exams
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <p className="text-2xl font-bold sm:text-3xl text-gray-900 dark:text-white">{overview?.stats.assigned_exam_count ?? 0}</p>
            <p className="mt-1 text-xs text-gray-600 sm:text-sm dark:text-gray-400">Visible from your current assignments</p>
          </CardContent>
        </Card>
        <Card className="glass-panel transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
            <CardTitle className="flex items-start gap-2 text-sm leading-snug sm:items-center sm:text-base">
              <CalendarDays className="h-4 w-4 text-green-600" />
              Upcoming Windows
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <p className="text-2xl font-bold sm:text-3xl text-gray-900 dark:text-white">{overview?.stats.upcoming_exam_count ?? 0}</p>
            <p className="mt-1 text-xs text-gray-600 sm:text-sm dark:text-gray-400">Exam windows still available</p>
          </CardContent>
        </Card>
        <Card className="glass-panel transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
            <CardTitle className="flex items-start gap-2 text-sm leading-snug sm:items-center sm:text-base">
              <Award className="h-4 w-4 text-purple-600" />
              Published Results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <p className="text-2xl font-bold sm:text-3xl text-gray-900 dark:text-white">{overview?.stats.published_result_count ?? 0}</p>
            <p className="mt-1 text-xs text-gray-600 sm:text-sm dark:text-gray-400">
              {`Average ${formatNumber(overview?.stats.average_percentage ?? 0)}%`}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-panel transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
            <CardTitle className="flex items-start gap-2 text-sm leading-snug sm:items-center sm:text-base">
              <BookOpen className="h-4 w-4 text-orange-600" />
              Active Materials
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <p className="text-2xl font-bold sm:text-3xl text-gray-900 dark:text-white">{overview?.stats.active_material_count ?? 0}</p>
            <p className="mt-1 text-xs text-gray-600 sm:text-sm dark:text-gray-400">Latest references ready to open</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              Upcoming Exams
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.isLoading ? (
              <div className="py-10 text-center text-sm text-gray-500">Loading dashboard...</div>
            ) : overview?.upcoming_exams.length ? (
              overview.upcoming_exams.map((exam) => {
                const action = getExamPrimaryAction(exam);
                return (
                  <div key={exam.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{exam.subject.name}</Badge>
                          <StatusBadge status={exam.status} />
                          {exam.enable_proctoring ? <Badge variant="outline">Proctored</Badge> : null}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">{exam.name}</h3>
                        <p className="mt-1 text-sm text-gray-600">
                          {exam.description || "No description provided."}
                        </p>
                      </div>

                      {!action.disabled ? (
                        <Button asChild>
                          <Link
                            to={action.href}
                            state={action.href.includes("/instructions") ? { exam } : undefined}
                          >
                            {action.href.includes("/candidate/exam/") ? (
                              <RotateCcw className="h-4 w-4" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                            {action.label}
                          </Link>
                        </Button>
                      ) : (
                        <Button disabled>Attempts Used</Button>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4" />
                        <span>{`${exam.duration_minutes} minutes`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        <span>{formatDateTime(exam.schedule.opens_at)}</span>
                      </div>
                      <div className="text-sm">
                        {`Attempts ${exam.attempts_used}/${exam.max_attempts}`}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center text-sm text-gray-500">No upcoming exams right now.</div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-purple-600" />
                Recent Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {overview?.recent_results.length ? (
                overview.recent_results.map((result) => (
                  <div key={result.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{result.exam.name}</p>
                        <p className="text-sm text-gray-500">{result.exam.subject_name}</p>
                      </div>
                      <StatusBadge status={result.publish_state} />
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatNumber(result.score)} / {formatNumber(result.total_marks)}
                        </p>
                        <p className="text-xs text-gray-500">{formatDateTime(result.published_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline">{formatNumber(result.percentage)}%</Badge>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/candidate/results/${result.id}`}>
                            View
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-sm text-gray-500">No published results yet.</div>
              )}

              <Button variant="outline" asChild className="w-full">
                <Link to="/candidate/results">View results</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-orange-600" />
                Latest Materials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {overview?.recent_materials.length ? (
                overview.recent_materials.map((material) => (
                  <div key={material.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{material.subject.name}</Badge>
                    </div>
                    <p className="font-medium text-gray-900">{material.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                      {material.description || "No description provided."}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">{formatDateTime(material.created_at)}</p>
                  </div>
                ))
              ) : (
                <div className="py-6 text-sm text-gray-500">No active materials available.</div>
              )}

              <Button variant="outline" asChild className="w-full">
                <Link to="/candidate/materials">Browse Materials</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
