import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, Target, XCircle } from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useAsyncList } from "../hooks/useAsyncList";
import { apiRequest } from "../lib/http";
import type { PracticeReviewRecord } from "./practiceShared";
import { formatPracticeDateTime, formatPracticePercent, getSelectedOptionLabel } from "./practiceShared";

export function PracticeReview() {
  const { t, i18n } = useTranslation("practice");
  const { id } = useParams();
  const sessionId = Number(id);

  const review = useAsyncList(
    () => apiRequest<PracticeReviewRecord>(`/api/v1/practice/sessions/${sessionId}/review/`),
    [sessionId],
  );

  if (review.isLoading) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-slate-500">
          {t("review.loading")}
        </CardContent>
      </Card>
    );
  }

  if (review.error || !review.data) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="text-lg font-semibold text-slate-950">{t("review.unableToLoad")}</p>
          <p className="mt-2 text-sm text-slate-500">{review.error ?? t("review.unavailable")}</p>
          <Button className="mt-6" asChild>
            <Link to="/candidate/practice">{t("review.backToPractice")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { data } = review;

  return (
    <div className="space-y-6">
      <Button variant="ghost" className="px-0 text-slate-600 hover:bg-transparent" asChild>
        <Link to="/candidate/practice">
          <ArrowLeft className="h-4 w-4" />
          {t("review.backToPractice")}
        </Link>
      </Button>

      <PageHeader
        title={t("review.title")}
        description={t("review.description", {
          date: formatPracticeDateTime(data.submitted_at, i18n.language),
          subject: data.subject.name,
        })}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-5">
            <p className="text-sm text-blue-700">{t("review.score")}</p>
            <p className="mt-2 text-4xl font-bold text-slate-950">
              {t("review.scoreValue", { score: formatPracticePercent(data.summary.score_percentage) })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-5">
            <p className="text-sm text-emerald-700">{t("review.correct")}</p>
            <p className="mt-2 text-4xl font-bold text-slate-950">{data.summary.correct_count}</p>
          </CardContent>
        </Card>
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="p-5">
            <p className="text-sm text-rose-700">{t("review.incorrect")}</p>
            <p className="mt-2 text-4xl font-bold text-slate-950">{data.summary.incorrect_count}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("review.sessionSummary")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t("review.subject")}</p>
            <p className="mt-2 font-medium text-slate-950">{data.subject.name}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t("review.started")}</p>
            <p className="mt-2 font-medium text-slate-950">
              {formatPracticeDateTime(data.started_at, i18n.language)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t("review.duration")}</p>
            <p className="mt-2 font-medium text-slate-950">
              {t("review.durationValue", { minutes: data.duration_minutes })}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {data.questions.map((question) => (
          <Card key={question.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{t("review.question", { number: question.sort_order })}</CardTitle>
                  <p className="mt-2 text-sm text-slate-700">{question.question_text}</p>
                </div>
                <Badge className={question.is_correct ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>
                  {question.is_correct ? t("review.correctStatus") : t("review.incorrectStatus")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <XCircle className="h-4 w-4 text-slate-500" />
                    {t("review.yourAnswer")}
                  </div>
                  <p className="mt-2 text-slate-600">
                    {getSelectedOptionLabel(question.options, question.selected_option_keys, t("shared.noAnswer"))}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                  <div className="flex items-center gap-2 font-medium text-emerald-900">
                    <CheckCircle2 className="h-4 w-4" />
                    {t("review.correctAnswer")}
                  </div>
                  <p className="mt-2 text-emerald-800">
                    {getSelectedOptionLabel(question.options, question.correct_option_keys, t("shared.noAnswer"))}
                  </p>
                </div>
              </div>

              {question.explanation_text ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  <div className="flex items-center gap-2 font-medium">
                    <Target className="h-4 w-4" />
                    {t("review.explanation")}
                  </div>
                  <p className="mt-2">{question.explanation_text}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
