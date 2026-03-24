import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, Clock3, Flag, Save } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { apiRequest } from "../lib/http";
import { notify } from "../lib/notify";
import type {
  PracticeAnswerResponse,
  PracticeAutosaveResponse,
  PracticeSessionQuestion,
  PracticeSessionRecord,
  PracticeSubmitResponse,
} from "./practiceShared";
import { formatPracticeDateTime, formatPracticeTimer } from "./practiceShared";

export function PracticeSession() {
  const { t, i18n } = useTranslation("practice");
  const { id } = useParams();
  const navigate = useNavigate();
  const sessionId = Number(id);

  const [session, setSession] = useState<PracticeSessionRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const latestQuestionIndexRef = useRef(0);
  const requestQueueRef = useRef(Promise.resolve());
  const autosavePendingRef = useRef(false);

  const enqueueMutation = async <T,>(task: () => Promise<T>) => {
    const previous = requestQueueRef.current;
    let release = () => undefined;
    requestQueueRef.current = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  };

  const loadSession = async () => {
    if (!sessionId) {
      setError(t("session.invalidSession"));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<PracticeSessionRecord>(`/api/v1/practice/sessions/${sessionId}/`);
      setSession(payload);
      setTimeRemaining(payload.remaining_seconds);
      const nextIndex = Math.max(payload.questions.findIndex((question) => !question.is_answered), 0);
      setCurrentQuestionIndex(nextIndex === -1 ? 0 : nextIndex);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("session.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSession();
  }, [sessionId]);

  useEffect(() => {
    latestQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  useEffect(() => {
    if (!session || session.status !== "in_progress") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTimeRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [session?.id, session?.status]);

  useEffect(() => {
    if (!session || session.status !== "in_progress") {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (autosavePendingRef.current) {
        return;
      }

      autosavePendingRef.current = true;
      void enqueueMutation(async () => {
        try {
          const response = await apiRequest<PracticeAutosaveResponse>(
            `/api/v1/practice/sessions/${session.id}/autosave/`,
            {
              method: "POST",
              body: { payload: { current_question_index: latestQuestionIndexRef.current } },
            },
          );
          setLastSavedAt(response.created_at);
        } finally {
          autosavePendingRef.current = false;
        }
      }).catch(() => undefined);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [session?.id, session?.status]);

  useEffect(() => {
    if (session?.status === "submitted") {
      navigate(`/candidate/practice/sessions/${session.id}/review`, { replace: true });
    }
  }, [navigate, session?.id, session?.status]);

  const updateQuestion = (questionId: number, patch: Partial<PracticeSessionQuestion>) => {
    setSession((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        questions: current.questions.map((question) =>
          question.id === questionId ? { ...question, ...patch } : question,
        ),
      };
    });
  };

  const saveAnswer = async (
    questionId: number,
    payload: Partial<{ selected_option_keys: string[]; is_marked_for_review: boolean }>,
  ) => {
    if (!session) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await enqueueMutation(() =>
        apiRequest<PracticeAnswerResponse>(`/api/v1/practice/sessions/${session.id}/answers/${questionId}/`, {
          method: "PUT",
          body: payload,
        }),
      );
      updateQuestion(questionId, {
        selected_option_keys: response.selected_option_keys,
        is_answered: response.is_answered,
        is_marked_for_review: response.is_marked_for_review,
      });
      setLastSavedAt(response.updated_at);
      notify.success(t("session.saveSuccess"));
    } catch (saveError) {
      notify.error(saveError instanceof Error ? saveError.message : t("session.saveFailed"));
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  };

  const currentQuestion = session?.questions[currentQuestionIndex] ?? null;
  const answeredCount = useMemo(
    () => session?.questions.filter((question) => question.is_answered).length ?? 0,
    [session],
  );
  const completionPercent = session?.total_questions ? (answeredCount / session.total_questions) * 100 : 0;

  const handleOptionChange = async (optionKey: string) => {
    if (!currentQuestion) {
      return;
    }

    updateQuestion(currentQuestion.id, {
      selected_option_keys: [optionKey],
      is_answered: true,
    });
    await saveAnswer(currentQuestion.id, {
      selected_option_keys: [optionKey],
      is_marked_for_review: currentQuestion.is_marked_for_review,
    });
  };

  const toggleMarked = async () => {
    if (!currentQuestion) {
      return;
    }

    const nextMarked = !currentQuestion.is_marked_for_review;
    updateQuestion(currentQuestion.id, { is_marked_for_review: nextMarked });
    await saveAnswer(currentQuestion.id, { is_marked_for_review: nextMarked });
  };

  const handleSubmit = async () => {
    if (!session) {
      return;
    }

    const confirmed = await notify.confirm({
      title: t("session.submitNowTitle"),
      text: t("session.submitNowDescription"),
      confirmText: t("session.submitAction"),
      cancelText: t("session.keepWorking"),
      confirmButtonColor: "#2563eb",
    });
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await enqueueMutation(() =>
        apiRequest<PracticeSubmitResponse>(`/api/v1/practice/sessions/${session.id}/submit/`, {
          method: "POST",
        }),
      );
      setSession((current) =>
        current
          ? {
              ...current,
              status: response.status,
              submitted_at: response.submitted_at,
              correct_count: response.correct_count,
              total_count: response.total_count,
              score_percentage: response.score_percentage,
            }
          : current,
      );
      navigate(`/candidate/practice/sessions/${session.id}/review`);
    } catch (submitError) {
      notify.error(submitError instanceof Error ? submitError.message : t("session.submitFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-16">
        <Card className="mx-auto max-w-xl">
          <CardContent className="p-10 text-center text-sm text-slate-500">
            {t("session.loading")}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !session || !currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-16">
        <Card className="mx-auto max-w-xl">
          <CardContent className="p-10 text-center">
            <p className="text-lg font-semibold text-slate-950">{t("session.unableToOpen")}</p>
            <p className="mt-2 text-sm text-slate-500">{error ?? t("session.unavailable")}</p>
            <Button className="mt-6" asChild>
              <Link to="/candidate/practice">{t("session.backToPractice")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_20%,#f8fafc_100%)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" className="px-0" asChild>
            <Link to="/candidate/practice">
              <ArrowLeft className="h-4 w-4" />
              {t("session.backToPractice")}
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <Badge variant="outline">{session.subject.name}</Badge>
            <Badge variant="outline">
              <Clock3 className="mr-1 h-3.5 w-3.5" />
              {formatPracticeTimer(timeRemaining)}
            </Badge>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {isSubmitting ? t("session.submitting") : t("session.submitAction")}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[280px,minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>{t("session.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                  <span>{t("session.answered")}</span>
                  <span>
                    {answeredCount}/{session.total_questions}
                  </span>
                </div>
                <Progress value={completionPercent} className="h-2.5" />
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <p>{t("session.duration", { minutes: session.duration_minutes })}</p>
                <p>{t("session.marked", { count: session.questions.filter((question) => question.is_marked_for_review).length })}</p>
                <p>
                  {t("session.lastSaved", {
                    time: lastSavedAt ? formatPracticeDateTime(lastSavedAt, i18n.language) : t("session.pending"),
                  })}
                </p>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {session.questions.map((question, index) => {
                  const active = index === currentQuestionIndex;
                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => setCurrentQuestionIndex(index)}
                      className={`rounded-xl border px-0 py-2 text-sm font-medium transition ${
                        active
                          ? "border-blue-600 bg-blue-600 text-white"
                          : question.is_answered
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {question.sort_order}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>{t("session.question", { number: currentQuestion.sort_order })}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {t(`shared.difficulty.${currentQuestion.difficulty}`, { defaultValue: currentQuestion.difficulty })}
                  </p>
                </div>
                <Button variant="outline" onClick={() => void toggleMarked()} disabled={isSaving}>
                  <Flag className="mr-2 h-4 w-4" />
                  {currentQuestion.is_marked_for_review ? t("session.unmark") : t("session.markReview")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-lg font-medium text-slate-950">{currentQuestion.question_text}</p>
              </div>

              <RadioGroup
                value={currentQuestion.selected_option_keys[0] ?? undefined}
                onValueChange={(value) => {
                  void handleOptionChange(value);
                }}
                className="space-y-3"
              >
                {currentQuestion.options.map((option) => {
                  const optionId = `practice-option-${currentQuestion.id}-${option.key}`;
                  const selected = currentQuestion.selected_option_keys.includes(option.key);
                  return (
                    <div
                      key={option.key}
                      className={`rounded-2xl border p-4 transition ${
                        selected ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={option.key} id={optionId} />
                        <Label htmlFor={optionId} className="flex-1 cursor-pointer text-sm font-medium text-slate-800">
                          {option.key}. {option.text}
                        </Label>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex((current) => Math.max(current - 1, 0))}
                  disabled={currentQuestionIndex === 0}
                >
                  {t("session.previous")}
                </Button>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Save className="h-4 w-4" />
                  {isSaving ? t("session.saving") : t("session.immediateSave")}
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    setCurrentQuestionIndex((current) => Math.min(current + 1, session.questions.length - 1))
                  }
                  disabled={currentQuestionIndex === session.questions.length - 1}
                >
                  {t("session.next")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
