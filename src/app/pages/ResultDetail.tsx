import { useMemo } from "react";
import { Link, useLocation, useParams } from "react-router";
import {
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  Clock3,
  FileText,
  Target,
  TrendingUp,
} from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { useAsyncList } from "../hooks/useAsyncList";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import {
  type CandidateResultRecord,
  formatResultDate,
  formatResultNumber,
  getPerformanceBand,
  getPerformanceMessage,
  toResultNumber,
} from "./candidateResultsShared";

const emptyResults: PaginatedResponse<CandidateResultRecord> = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

export function ResultDetail() {
  const { id } = useParams();
  const location = useLocation();
  const locationResult = (location.state as { result?: CandidateResultRecord } | null)?.result ?? null;

  const resultsList = useAsyncList(
    () =>
      locationResult
        ? Promise.resolve(emptyResults)
        : apiRequest<PaginatedResponse<CandidateResultRecord>>("/api/v1/my-results/", {
            query: { page_size: 100 },
          }),
    [id, Boolean(locationResult)],
  );

  const result = useMemo(() => {
    if (locationResult) {
      return locationResult;
    }
    return resultsList.data?.results.find((record) => String(record.id) === String(id)) ?? null;
  }, [id, locationResult, resultsList.data?.results]);

  if (!locationResult && resultsList.isLoading) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-slate-500">
          Loading result details...
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-base font-medium text-slate-900">Result details could not be found.</p>
          <p className="mt-1 text-sm text-slate-500">Return to the results list and open the published record again.</p>
          <Button asChild className="mt-6">
            <Link to="/candidate/results">Back to Results</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const percentage = toResultNumber(result.percentage);
  const band = getPerformanceBand(result.percentage);

  return (
    <div>
      <Button variant="ghost" className="mb-4 px-0 text-slate-600 hover:bg-transparent" asChild>
        <Link to="/candidate/results">
          <ArrowLeft className="h-4 w-4" />
          Back to Results
        </Link>
      </Button>

      <PageHeader
        title={result.exam.name}
        description="Detailed summary for this published candidate result."
      />

      {resultsList.error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {resultsList.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr),360px]">
        <div className="space-y-6">
          <Card className="border-blue-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_100%)]">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{result.exam.subject_name}</Badge>
                    <StatusBadge status={result.publish_state} />
                    <Badge variant="outline">{band}</Badge>
                  </div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Published Score</p>
                  <p className="mt-2 text-5xl font-bold text-slate-950">{formatResultNumber(result.percentage)}%</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {formatResultNumber(result.score)} / {formatResultNumber(result.total_marks)} points
                  </p>
                </div>

                <div className="rounded-3xl bg-slate-950 px-6 py-5 text-white lg:min-w-64">
                  <p className="text-sm text-slate-300">Performance Summary</p>
                  <p className="mt-3 text-lg font-semibold">{getPerformanceMessage(result)}</p>
                  <div className="mt-5 space-y-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <span>Workflow</span>
                      <span className="font-medium text-white">{result.workflow_status.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Result status</span>
                      <span className="font-medium text-white">{result.result_status}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Final score</p>
                    <p className="text-2xl font-semibold text-slate-950">{formatResultNumber(result.score)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total marks</p>
                    <p className="text-2xl font-semibold text-slate-950">{formatResultNumber(result.total_marks)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-amber-100 p-3 text-amber-600">
                    <Clock3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Time taken</p>
                    <p className="text-2xl font-semibold text-slate-950">{result.time_taken_minutes}m</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-violet-100 p-3 text-violet-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Band</p>
                    <p className="text-2xl font-semibold text-slate-950">{band}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Score Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Percentage</span>
                  <span className="font-medium text-slate-900">{formatResultNumber(result.percentage)}%</span>
                </div>
                <Progress value={percentage} className="h-3" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Published at</p>
                  <p className="mt-2 font-medium text-slate-900">{formatResultDate(result.published_at)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Completed at</p>
                  <p className="mt-2 font-medium text-slate-900">{formatResultDate(result.completed_date)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Result Record
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Candidate</span>
                <span className="text-right font-medium text-slate-900">{result.candidate.full_name}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Email</span>
                <span className="text-right font-medium text-slate-900">{result.candidate.email}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Result status</span>
                <span className="text-right font-medium text-slate-900">{result.result_status}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Publish state</span>
                <span className="text-right font-medium text-slate-900">{result.publish_state}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next Step</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>
                This build exposes published totals, timing, and workflow state from the current API.
              </p>
              <p>
                Question-by-question review is not available yet in the backend contract, so this detail page stays aligned with real data instead of using mock answers.
              </p>
              <Button variant="outline" asChild className="w-full">
                <Link to="/candidate/materials">Review Study Materials</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
