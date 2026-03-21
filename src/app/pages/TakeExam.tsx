import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { notify } from "../lib/notify";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Wifi,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { apiRequest } from "../lib/http";

interface SessionQuestion {
  id: number;
  sort_order: number;
  points: string;
  question_text: string;
  question_type: string;
  difficulty: string;
  options: Array<{
    key: string;
    text: string;
    sort_order: number;
  }>;
  selected_option_keys: string[];
  answer_text: string;
  is_answered: boolean;
  is_marked_for_review: boolean;
}

interface CandidateSession {
  id: number;
  exam_id: number;
  exam_name: string;
  subject: {
    id: number;
    name: string;
    code: string;
    color: string;
  };
  status: string;
  attempt_number: number;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  show_results_immediately: boolean;
  enable_proctoring: boolean;
  remaining_seconds: number;
  objective_score: string;
  max_score: string;
  manual_grading_required: boolean;
  answered_count: number;
  marked_count: number;
  total_questions: number;
  questions: SessionQuestion[];
}

interface SessionAnswerResponse {
  session_question: number;
  selected_option_keys: string[];
  answer_text: string;
  is_answered: boolean;
  is_marked_for_review: boolean;
  updated_at: string;
}

interface AutosaveResponse {
  id: number;
  created_at: string;
}

interface SubmissionSummary {
  id: number;
  status: string;
  submitted_at: string;
  objective_score: string;
  max_score: string;
  manual_grading_required: boolean;
}

const formatTime = (seconds: number) => {
  const clampedSeconds = Math.max(0, seconds);
  const hours = Math.floor(clampedSeconds / 3600);
  const minutes = Math.floor((clampedSeconds % 3600) / 60);
  const secs = clampedSeconds % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function TakeExam() {
  const { id } = useParams();
  const navigate = useNavigate();
  const examId = Number(id);

  const [session, setSession] = useState<CandidateSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"stable" | "offline" | "unstable">(
    navigator.onLine ? "stable" : "offline",
  );
  const dirtyEssayQuestionIdsRef = useRef<Set<number>>(new Set());
  const latestQuestionIndexRef = useRef(0);
  const requestQueueRef = useRef(Promise.resolve());
  const heartbeatPendingRef = useRef(false);
  const autosavePendingRef = useRef(false);
  const capabilityRegisteredSessionIdRef = useRef<number | null>(null);

  const enqueueSessionMutation = async <T,>(task: () => Promise<T>) => {
    const previous = requestQueueRef.current;
    let releaseCurrent = () => undefined;
    requestQueueRef.current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    await previous;
    try {
      return await task();
    } finally {
      releaseCurrent();
    }
  };

  const updateQuestion = (questionId: number, patch: Partial<SessionQuestion>) => {
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

  useEffect(() => {
    latestQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  const saveAnswer = async (
    questionId: number,
    payload: Partial<{
      selected_option_keys: string[];
      answer_text: string;
      is_marked_for_review: boolean;
    }>,
    options?: { silent?: boolean },
  ) => {
    if (!session) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await enqueueSessionMutation(() =>
        apiRequest<SessionAnswerResponse>(`/api/v1/exam-sessions/${session.id}/answers/${questionId}/`, {
          method: "PUT",
          body: payload,
        }),
      );
      updateQuestion(questionId, {
        selected_option_keys: response.selected_option_keys,
        answer_text: response.answer_text,
        is_answered: response.is_answered,
        is_marked_for_review: response.is_marked_for_review,
      });
      setLastSavedAt(response.updated_at);
      dirtyEssayQuestionIdsRef.current.delete(questionId);
      if (!options?.silent) {
        notify.success("Answer saved.");
      }
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save answer.";
      notify.error(message);
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  };

  const persistEssayAnswer = async (questionIndex = currentQuestionIndex) => {
    const currentSession = session;
    if (!currentSession) {
      return;
    }
    const question = currentSession.questions[questionIndex];
    if (!question || question.question_type !== "essay" || !dirtyEssayQuestionIdsRef.current.has(question.id)) {
      return;
    }
    await saveAnswer(
      question.id,
      {
        answer_text: question.answer_text,
        is_marked_for_review: question.is_marked_for_review,
      },
      { silent: true },
    );
  };

  const loadSession = async () => {
    if (!examId) {
      setError("Invalid exam identifier.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextSession = await apiRequest<CandidateSession>(`/api/v1/exams/${examId}/start-session/`, {
        method: "POST",
      });
      setSession(nextSession);
      setTimeRemaining(nextSession.remaining_seconds);
      const nextIndex = Math.max(
        nextSession.questions.findIndex((question) => !question.is_answered),
        0,
      );
      setCurrentQuestionIndex(nextIndex === -1 ? 0 : nextIndex);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load exam session.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSession();
  }, [examId]);

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

    const autosave = () => {
      if (autosavePendingRef.current) {
        return;
      }

      autosavePendingRef.current = true;
      void enqueueSessionMutation(async () => {
        try {
          const response = await apiRequest<AutosaveResponse>(`/api/v1/exam-sessions/${session.id}/autosave/`, {
            method: "POST",
            body: { payload: { current_question_index: latestQuestionIndexRef.current } },
          });
          setLastSavedAt(response.created_at);
        } catch {
          setConnectionStatus("unstable");
        } finally {
          autosavePendingRef.current = false;
        }
      });
    };

    const intervalId = window.setInterval(() => {
      autosave();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [session?.id, session?.status]);

  useEffect(() => {
    if (!session || !session.enable_proctoring || session.status !== "in_progress") {
      return;
    }

    const registerCapability = () => {
      if (capabilityRegisteredSessionIdRef.current === session.id) {
        return;
      }

      capabilityRegisteredSessionIdRef.current = session.id;
      void enqueueSessionMutation(() =>
        apiRequest(`/api/v1/proctoring/sessions/${session.id}/capability/`, {
          method: "POST",
          body: {
            client_type: "web",
            client_version: "vite-react",
            capabilities: {
              fullscreen_enabled: document.fullscreenEnabled,
              online: navigator.onLine,
              user_agent: navigator.userAgent,
            },
            attestation_payload: {},
            user_agent: navigator.userAgent,
          },
        }),
      ).catch(() => {
        capabilityRegisteredSessionIdRef.current = null;
      });
    };

    const sendHeartbeat = () => {
      if (heartbeatPendingRef.current) {
        return;
      }

      heartbeatPendingRef.current = true;
      const nextStatus = navigator.onLine ? "stable" : "offline";
      setConnectionStatus(nextStatus);
      void enqueueSessionMutation(async () => {
        try {
          await apiRequest(`/api/v1/proctoring/sessions/${session.id}/heartbeats/`, {
            method: "POST",
            body: {
              connection_status: nextStatus,
              payload: { current_question_index: latestQuestionIndexRef.current },
            },
          });
        } catch {
          setConnectionStatus("unstable");
        } finally {
          heartbeatPendingRef.current = false;
        }
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        void enqueueSessionMutation(() =>
          apiRequest(`/api/v1/proctoring/sessions/${session.id}/events/`, {
            method: "POST",
            body: {
              event_type: "tab_switch",
              severity: "warning",
              metadata: {
                message: "Candidate switched away from the exam tab.",
              },
            },
          }),
        ).catch(() => undefined);
      }
    };

    const handleOnline = () => setConnectionStatus("stable");
    const handleOffline = () => setConnectionStatus("offline");

    registerCapability();
    sendHeartbeat();

    const heartbeatInterval = window.setInterval(() => {
      sendHeartbeat();
    }, 20000);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.clearInterval(heartbeatInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [session?.enable_proctoring, session?.id, session?.status]);

  const currentQuestion = session?.questions[currentQuestionIndex] ?? null;

  const answeredCount = useMemo(
    () => session?.questions.filter((question) => question.is_answered).length ?? 0,
    [session],
  );
  const markedCount = useMemo(
    () => session?.questions.filter((question) => question.is_marked_for_review).length ?? 0,
    [session],
  );

  const goToQuestion = async (nextIndex: number) => {
    if (!session || nextIndex < 0 || nextIndex >= session.questions.length) {
      return;
    }
    try {
      await persistEssayAnswer();
      setCurrentQuestionIndex(nextIndex);
    } catch {
      // Error already surfaced via notify.
    }
  };

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

  const handleEssayChange = (nextText: string) => {
    if (!currentQuestion) {
      return;
    }
    dirtyEssayQuestionIdsRef.current.add(currentQuestion.id);
    updateQuestion(currentQuestion.id, {
      answer_text: nextText,
      is_answered: Boolean(nextText.trim()),
    });
  };

  const toggleMarked = async () => {
    if (!currentQuestion) {
      return;
    }
    const nextMarked = !currentQuestion.is_marked_for_review;
    updateQuestion(currentQuestion.id, { is_marked_for_review: nextMarked });
    await saveAnswer(currentQuestion.id, { is_marked_for_review: nextMarked }, { silent: true });
  };

  const handleSubmit = async () => {
    if (!session) {
      return;
    }

    setIsSubmitting(true);
    try {
      await persistEssayAnswer();
      const response = await enqueueSessionMutation(() =>
        apiRequest<SubmissionSummary>(`/api/v1/exam-sessions/${session.id}/submit/`, {
          method: "POST",
        }),
      );
      setSession((current) =>
        current
          ? {
              ...current,
              status: response.status,
              submitted_at: response.submitted_at,
              objective_score: response.objective_score,
              max_score: response.max_score,
              manual_grading_required: response.manual_grading_required,
            }
          : current,
      );
      notify.success("Exam submitted.");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to submit exam.";
      notify.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmSubmit = async () => {
    if (!session) {
      return;
    }

    const confirmed = await notify.confirm({
      title: "Submit exam now?",
      html: `
        <div style="text-align:left">
          <p style="margin:0 0 12px;">Review your progress before final submission. This action cannot be undone.</p>
          <div style="display:grid;gap:8px;">
            <div><strong>Total questions:</strong> ${session.questions.length}</div>
            <div><strong>Answered:</strong> ${answeredCount}</div>
            <div><strong>Unanswered:</strong> ${session.questions.length - answeredCount}</div>
            ${markedCount > 0 ? `<div><strong>Marked for review:</strong> ${markedCount}</div>` : ""}
          </div>
        </div>
      `,
      confirmText: "Submit Exam",
      cancelText: "Go Back",
      confirmButtonColor: "#2563eb",
    });

    if (!confirmed) {
      return;
    }

    await handleSubmit();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading exam session...</p>
      </div>
    );
  }

  if (error || !session || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <Card className="w-full max-w-lg">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Unable to open exam</h1>
            <p className="text-sm text-gray-600 mb-6">{error ?? "This exam session is unavailable."}</p>
            <Button asChild>
              <Link to="/candidate/practice">Back to My Exams</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session.status === "submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <Card className="w-full max-w-xl">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">Exam Submitted</h1>
              <p className="mt-2 text-sm text-gray-600">
                {session.exam_name} was submitted at{" "}
                {session.submitted_at ? formatDateTime(session.submitted_at) : "just now"}.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Objective Score</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {session.objective_score}/{session.max_score}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Evaluation Status</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {session.manual_grading_required ? "Pending grading" : "Finalized"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 mb-6">
              {session.show_results_immediately && !session.manual_grading_required
                ? "Results are available immediately for this exam."
                : "Results will appear after manual grading and publication."}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => navigate(0)}>
                Refresh
              </Button>
              <Button asChild>
                <Link to="/candidate/practice">Back to My Exams</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-bold text-lg text-gray-900">{session.exam_name}</h1>
            <p className="text-sm text-gray-600">
              Question {currentQuestionIndex + 1} of {session.questions.length} • Attempt {session.attempt_number}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <div className="flex min-w-[8rem] items-center gap-2">
              <Wifi
                className={`w-4 h-4 ${
                  connectionStatus === "stable"
                    ? "text-green-600"
                    : connectionStatus === "offline"
                      ? "text-red-600"
                      : "text-yellow-600"
                }`}
              />
              <span className="text-sm text-gray-600 capitalize">{connectionStatus}</span>
            </div>

            <div className="flex min-w-[10rem] items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${lastSavedAt ? "text-green-600" : "text-gray-400"}`} />
              <span className="text-sm text-gray-600">
                {lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString("en-GB")}` : "Autosave pending"}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="font-mono font-semibold text-blue-900">{formatTime(timeRemaining)}</span>
            </div>

            <Button className="w-full sm:w-auto" onClick={() => void confirmSubmit()} disabled={isSubmitting}>
              Submit Exam
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 sm:p-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                  <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-gray-900">
                          Question {currentQuestionIndex + 1}
                        </h2>
                        <Badge variant="outline">{currentQuestion.difficulty}</Badge>
                        <Badge variant="outline">{currentQuestion.question_type.replace(/_/g, " ")}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">{currentQuestion.points} points</p>
                    </div>
                    <Button variant="outline" size="sm" className="w-full gap-2 sm:w-auto" onClick={() => void toggleMarked()}>
                      <Flag className="w-4 h-4" />
                      {currentQuestion.is_marked_for_review ? "Unmark" : "Mark for Review"}
                    </Button>
                  </div>
                  <p className="text-base leading-relaxed text-gray-800 sm:text-lg">{currentQuestion.question_text}</p>
                </div>

                {currentQuestion.question_type === "essay" ? (
                  <Textarea
                    rows={10}
                    value={currentQuestion.answer_text}
                    onChange={(event) => handleEssayChange(event.target.value)}
                    onBlur={() => void persistEssayAnswer()}
                    placeholder="Enter your answer here..."
                  />
                ) : (
                  <div className="space-y-3">
                    <RadioGroup
                      value={currentQuestion.selected_option_keys[0] ?? undefined}
                      onValueChange={(value) => void handleOptionChange(value)}
                    >
                      {currentQuestion.options.map((option, index) => {
                        const isSelected = currentQuestion.selected_option_keys.includes(option.key);
                        return (
                          <label
                            key={option.key}
                            className={`flex items-start gap-4 rounded-lg border-2 p-4 transition-colors ${
                              isSelected
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            <RadioGroupItem value={option.key} id={`option-${option.key}`} />
                            <Label htmlFor={`option-${option.key}`} className="flex-1 cursor-pointer text-base">
                              <span className="font-medium text-gray-700 mr-2">{String.fromCharCode(65 + index)}.</span>
                              {option.text}
                            </Label>
                          </label>
                        );
                      })}
                    </RadioGroup>
                  </div>
                )}

                <div className="mt-8 flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <Button className="w-full sm:w-auto" variant="outline" onClick={() => void goToQuestion(currentQuestionIndex - 1)} disabled={currentQuestionIndex === 0}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => void goToQuestion(currentQuestionIndex + 1)}
                    disabled={currentQuestionIndex === session.questions.length - 1}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-24">
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Question Navigator</h3>

                <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Answered:</span>
                    <span className="font-semibold text-green-600">
                      {answeredCount}/{session.questions.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Marked:</span>
                    <span className="font-semibold text-orange-600">{markedCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Unanswered:</span>
                    <span className="font-semibold text-red-600">
                      {session.questions.length - answeredCount}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {session.questions.map((question, index) => (
                    <button
                      key={question.id}
                      onClick={() => void goToQuestion(index)}
                      className={`aspect-square rounded-lg flex items-center justify-center text-sm font-semibold transition-all relative ${
                        currentQuestionIndex === index
                          ? "bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2"
                          : question.is_answered
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      type="button"
                    >
                      {index + 1}
                      {question.is_marked_for_review ? (
                        <Flag className="w-3 h-3 absolute -top-1 -right-1 text-orange-500 fill-orange-500" />
                      ) : null}
                    </button>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 bg-green-100 rounded" />
                    <span className="text-gray-600">Answered</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 bg-gray-100 rounded" />
                    <span className="text-gray-600">Not Answered</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 bg-blue-600 rounded" />
                    <span className="text-gray-600">Current</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Flag className="w-4 h-4 text-orange-500 fill-orange-500" />
                    <span className="text-gray-600">Marked</span>
                  </div>
                  {isSaving ? <p className="text-xs text-blue-600 pt-2">Saving answer...</p> : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

    </div>
  );
}
