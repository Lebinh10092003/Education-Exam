import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  FileText,
  Shield,
} from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { useAsyncList } from "../hooks/useAsyncList";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import {
  type CandidateAssignedExam,
  canLaunchExam,
  formatExamSchedule,
  getExamAvailabilityLabel,
  getExamAvailabilityState,
  getExamAvailabilityTone,
} from "./candidateExamShared";

const emptyExamResponse: PaginatedResponse<CandidateAssignedExam> = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

export function ExamInstructions() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const locationExam = (location.state as { exam?: CandidateAssignedExam } | null)?.exam ?? null;
  const [checklist, setChecklist] = useState({
    device: false,
    internet: false,
    rules: false,
    workspace: false,
  });

  const fallbackExams = useAsyncList(
    () =>
      locationExam
        ? Promise.resolve(emptyExamResponse)
        : apiRequest<PaginatedResponse<CandidateAssignedExam>>("/api/v1/my-exams/", {
            query: { page_size: 100 },
          }),
    [id, Boolean(locationExam)],
  );

  const exam = useMemo(() => {
    if (locationExam) {
      return locationExam;
    }
    return fallbackExams.data?.results.find((record) => String(record.id) === String(id)) ?? null;
  }, [fallbackExams.data?.results, id, locationExam]);

  const allChecked = Object.values(checklist).every(Boolean);
  const availability = exam ? getExamAvailabilityState(exam) : null;

  if (!locationExam && fallbackExams.isLoading) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-slate-500">
          Loading exam instructions...
        </CardContent>
      </Card>
    );
  }

  if (!exam) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-base font-medium text-slate-900">Exam details could not be found.</p>
          <p className="mt-1 text-sm text-slate-500">Return to My Exams and open the assignment again.</p>
          <Button asChild className="mt-6">
            <Link to="/candidate/exams">Back to My Exams</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <Button variant="ghost" className="mb-4 px-0 text-slate-600 hover:bg-transparent" asChild>
        <Link to="/candidate/exams">
          <ArrowLeft className="h-4 w-4" />
          Back to My Exams
        </Link>
      </Button>

      <PageHeader
        title={exam.name}
        description="Review the exam window, rules, and readiness checklist before entering the live exam session."
      />

      {fallbackExams.error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fallbackExams.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr),380px]">
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
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
            <CardTitle className="text-2xl text-slate-950">Exam Readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Schedule
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {formatExamSchedule(exam.schedule.opens_at, exam.schedule.closes_at)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Clock3 className="h-4 w-4 text-blue-600" />
                  Duration
                </div>
                <p className="mt-2 text-sm text-slate-600">{exam.duration_minutes} minutes</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Question Set
                </div>
                <p className="mt-2 text-sm text-slate-600">{exam.question_count} questions</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Shield className="h-4 w-4 text-blue-600" />
                  Attempts
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {exam.attempts_used}/{exam.max_attempts} used
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                <div className="space-y-2 text-sm text-amber-900">
                  <p className="font-semibold">Before you begin</p>
                  <p>Stay on a stable network, keep only one exam tab open, and avoid refreshing the page during the session.</p>
                  <p>If proctoring is enabled, camera and fullscreen requirements may be enforced after launch.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {(
                [
                  ["device", "My device is charged and ready for the full exam duration."],
                  ["internet", "My internet connection is stable enough for a continuous session."],
                  ["rules", "I understand the exam rules and attempt policy."],
                  ["workspace", "My workspace is quiet and free from interruptions."],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <Checkbox
                    checked={checklist[key]}
                    onCheckedChange={(checked) =>
                      setChecklist((current) => ({ ...current, [key]: checked === true }))
                    }
                    className="mt-0.5"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Launch Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl bg-slate-950 px-5 py-6 text-white">
              <p className="text-sm text-slate-300">Subject</p>
              <p className="mt-1 text-xl font-semibold">{exam.subject.name}</p>
              <p className="mt-4 text-sm text-slate-300">Passing score</p>
              <p className="mt-1 text-lg font-medium">{exam.passing_score}</p>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-4">
                <span>Status</span>
                <span className="font-medium text-slate-900">{getExamAvailabilityLabel(exam)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Window</span>
                <span className="text-right text-slate-900">
                  {availability === "available" || availability === "resume" ? "Open now" : getExamAvailabilityLabel(exam)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Checklist</span>
                <span className="font-medium text-slate-900">
                  {Object.values(checklist).filter(Boolean).length}/4 confirmed
                </span>
              </div>
            </div>

            {canLaunchExam(exam) ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4" />
                  <span>Complete the checklist to enable the final launch button.</span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                This exam cannot be launched yet. Review the details here and return when the window opens.
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={!canLaunchExam(exam) || !allChecked}
              onClick={() => navigate(`/candidate/exam/${exam.id}`)}
            >
              {availability === "resume" ? "Resume Exam" : "Start Exam"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
