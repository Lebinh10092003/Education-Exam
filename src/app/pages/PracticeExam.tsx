import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { BookOpenCheck, Clock3, History, PlayCircle, RotateCcw, Sparkles } from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useAsyncList } from "../hooks/useAsyncList";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { notify } from "../lib/notify";
import type {
  PracticeCatalogItem,
  PracticeCatalogResponse,
  PracticeHistoryItem,
  PracticeSessionRecord,
} from "./practiceShared";
import { formatPracticeDateTime, formatPracticePercent } from "./practiceShared";

export function PracticeExam() {
  const { t, i18n } = useTranslation("practice");
  const navigate = useNavigate();
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const catalog = useAsyncList(
    () => apiRequest<PracticeCatalogResponse>("/api/v1/practice/catalog/"),
    [],
  );
  const history = useAsyncList(
    () =>
      apiRequest<PaginatedResponse<PracticeHistoryItem>>("/api/v1/practice/history/", {
        query: { page_size: 20 },
      }),
    [],
  );

  const catalogResults = catalog.data?.results ?? [];

  useEffect(() => {
    if (!selectedSubjectId && catalogResults.length) {
      setSelectedSubjectId(catalogResults[0].subject.id);
    }
  }, [catalogResults, selectedSubjectId]);

  const selectedCatalog = useMemo(
    () => catalogResults.find((item) => item.subject.id === selectedSubjectId) ?? null,
    [catalogResults, selectedSubjectId],
  );

  const generatedQuestionCount = selectedCatalog ? Math.min(selectedCatalog.counts.total, 30) : 0;
  const resumableSessions = (history.data?.results ?? []).filter((item) => item.status === "in_progress");
  const completedSessions = (history.data?.results ?? []).filter((item) => item.status === "submitted");

  const validationMessage = useMemo(() => {
    if (!catalogResults.length) {
      return t("catalog.noInventory");
    }
    if (!selectedCatalog) {
      return t("catalog.selectSubject");
    }
    return null;
  }, [catalogResults.length, selectedCatalog, t]);

  const handleCreateSession = async () => {
    if (!selectedCatalog || validationMessage) {
      notify.error(validationMessage ?? t("catalog.configIncomplete"));
      return;
    }

    setIsCreating(true);
    try {
      const session = await apiRequest<PracticeSessionRecord>("/api/v1/practice/sessions/", {
        method: "POST",
        body: {
          subject_id: selectedCatalog.subject.id,
        },
      });
      navigate(`/candidate/practice/sessions/${session.id}`);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t("catalog.createFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title={t("catalog.title")}
        description={t("catalog.description")}
        action={
          <Button variant="outline" asChild>
            <Link to="/candidate/exams">{t("catalog.openMyExams")}</Link>
          </Button>
        }
      />

      {catalog.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {catalog.error}
        </div>
      ) : null}

      {history.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {history.error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white p-3 text-blue-600 shadow-sm">
                <BookOpenCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-blue-700">{t("catalog.bankReadyQuestions")}</p>
                <p className="text-2xl font-semibold text-slate-950">
                  {catalogResults.reduce((sum, item) => sum + item.counts.total, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white p-3 text-amber-600 shadow-sm">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-amber-700">{t("catalog.resumableSessions")}</p>
                <p className="text-2xl font-semibold text-slate-950">{resumableSessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white p-3 text-emerald-600 shadow-sm">
                <History className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-emerald-700">{t("catalog.completedPracticeSets")}</p>
                <p className="text-2xl font-semibold text-slate-950">{completedSessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr),380px]">
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-950">{t("catalog.startSet")}</h2>
          </div>

          <div className="space-y-6">
            <div className="max-w-md">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                {t("catalog.subject")}
                <select
                  aria-label={t("catalog.subject")}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  value={selectedSubjectId ?? ""}
                  onChange={(event) => setSelectedSubjectId(Number(event.target.value))}
                >
                  {catalogResults.map((item: PracticeCatalogItem) => (
                    <option key={item.subject.id} value={item.subject.id}>
                      {item.subject.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-medium text-slate-950">{t("catalog.randomObjectiveSet")}</p>
                <p className="mt-1">
                  {selectedCatalog
                    ? t("catalog.randomObjectiveDescription", {
                        count: generatedQuestionCount,
                        subject: selectedCatalog.subject.name,
                      })
                    : t("catalog.randomObjectiveFallback")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-900">{t("catalog.automaticTiming")}</p>
                <p className="mt-1">{t("catalog.automaticTimingDescription")}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">{t("catalog.practiceBoundary")}</p>
              <p className="mt-1">{t("catalog.practiceBoundaryDescription")}</p>
            </div>

            {validationMessage ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {validationMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-600">
                {selectedCatalog ? (
                  <>
                    {t("catalog.randomSetSize")}:{" "}
                    <span className="font-semibold text-slate-950">{generatedQuestionCount}</span>
                  </>
                ) : (
                  t("catalog.chooseSubjectPreview")
                )}
              </div>
              <Button onClick={handleCreateSession} disabled={isCreating || Boolean(validationMessage)}>
                <PlayCircle className="mr-2 h-4 w-4" />
                {isCreating ? t("catalog.creating") : t("catalog.startPractice")}
              </Button>
            </div>
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>{t("catalog.subjectAvailability")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {catalogResults.length ? (
              catalogResults.map((item) => {
                const isActive = item.subject.id === selectedSubjectId;
                return (
                  <button
                    key={item.subject.id}
                    type="button"
                    onClick={() => setSelectedSubjectId(item.subject.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? "border-blue-600 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">{item.subject.name}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">{item.subject.code}</p>
                      </div>
                      <Badge variant="outline">{`${item.counts.total} ${t("catalog.total")}`}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                      <span>{t("catalog.easy")}: {item.counts.easy}</span>
                      <span>{t("catalog.medium")}: {item.counts.medium}</span>
                      <span>{t("catalog.hard")}: {item.counts.hard}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                {t("catalog.noInventory")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("catalog.resumeSession")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {resumableSessions.length ? (
              resumableSessions.map((session) => (
                <div key={session.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-950">{session.subject.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {t("catalog.startedAt", { date: formatPracticeDateTime(session.started_at, i18n.language) })}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {t("catalog.answeredProgress", {
                          answered: session.answered_count,
                          total: session.total_questions,
                        })}
                      </p>
                    </div>
                    <Button asChild>
                      <Link to={`/candidate/practice/sessions/${session.id}`}>{t("catalog.resume")}</Link>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                {t("catalog.noResumableSession")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("catalog.latestHistory")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {completedSessions.length ? (
              completedSessions.map((session) => (
                <div key={session.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-950">{session.subject.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {t("catalog.submittedAt", { date: formatPracticeDateTime(session.submitted_at, i18n.language) })}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
                        <span>{formatPracticePercent(session.score_percentage)}</span>
                        <span>
                          {t("catalog.correctProgress", {
                            correct: session.correct_count,
                            total: session.total_count,
                          })}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" asChild>
                      <Link to={`/candidate/practice/sessions/${session.id}/review`}>{t("catalog.review")}</Link>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                {t("catalog.noSubmittedHistory")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="flex flex-col gap-3 p-5 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-slate-500" />
            {t("catalog.namespaceNotice")}
          </div>
          <Link className="font-medium text-blue-700 hover:text-blue-800" to="/candidate/exams">
            {t("catalog.realExamsStay")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
