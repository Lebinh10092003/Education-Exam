import { Link, useParams } from "react-router";
import { ArrowLeft, Download, FileSearch } from "lucide-react";

import { MathText } from "../components/MathText";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useAsyncList } from "../hooks/useAsyncList";
import { buildApiUrl } from "../lib/env";
import { apiRequest } from "../lib/http";
import { notify } from "../lib/notify";
import { getStoredTokens } from "../lib/storage";

interface ReviewOption {
  key: string;
  text: string;
  is_correct: boolean;
  is_selected: boolean;
}

interface ReviewQuestion {
  id: number;
  sort_order: number;
  points: string | number;
  awarded_points: string | number | null;
  question_text: string;
  question_type: string;
  difficulty: string;
  options: ReviewOption[];
  selected_option_keys: string[];
  correct_option_keys: string[];
  answer_text: string;
  is_answered: boolean;
  is_correct: boolean | null;
  essay_rubric: string;
  sample_answer: string;
  manual_feedback: string;
  manual_score_awarded: string | number | null;
}

interface ResultReviewPayload {
  id: number;
  candidate: {
    id: number;
    email: string;
    full_name: string;
    username: string;
  };
  exam: {
    id: number;
    name: string;
    subject_name: string;
  };
  session: {
    id: number;
    status: string;
    attempt_number: number;
    started_at: string;
    submitted_at: string | null;
    objective_score: string | number;
    max_score: string | number;
  };
  result: {
    workflow_status: string;
    publish_state: string;
    score: string;
    total_marks: string;
    percentage: string;
    result_status: string;
    completed_date: string | null;
  };
  questions: ReviewQuestion[];
}

const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
};

const downloadReviewExport = async (resultId: string) => {
  try {
    const tokens = getStoredTokens();
    const headers: HeadersInit = {};
    if (tokens?.access) {
      headers.Authorization = `Bearer ${tokens.access}`;
    }
    const response = await fetch(buildApiUrl(`/api/v1/results/${resultId}/review-export/`), { headers });
    if (!response.ok) {
      throw new Error(`Unable to export review file: ${response.statusText}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `eduexam-result-review-${resultId}.xlsx`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
    notify.success("Đã xuất file rà bài.");
  } catch (error) {
    notify.error(error instanceof Error ? error.message : "Không thể xuất file rà bài.");
  }
};

export function AdminResultReview() {
  const { id } = useParams();
  const review = useAsyncList(
    async () => {
      if (!id) {
        throw new Error("Result id is required.");
      }
      return apiRequest<ResultReviewPayload>(`/api/v1/results/${id}/review/`);
    },
    [id],
  );

  if (review.isLoading) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-slate-500">
          Đang tải bài làm...
        </CardContent>
      </Card>
    );
  }

  if (!review.data) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <FileSearch className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-base font-medium text-slate-900">Không tìm thấy bài làm.</p>
          {review.error ? <p className="mt-1 text-sm text-red-600">{review.error}</p> : null}
          <Button asChild className="mt-6">
            <Link to="/results">Về danh sách kết quả</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const payload = review.data;

  return (
    <div className="space-y-6">
      <Button variant="ghost" className="px-0 text-slate-600 hover:bg-transparent" asChild>
        <Link to="/results">
          <ArrowLeft className="h-4 w-4" />
          Về danh sách kết quả
        </Link>
      </Button>

      <PageHeader
        title={`Rà bài - ${payload.candidate.full_name}`}
        description={`${payload.exam.name} • ${payload.exam.subject_name} • lần thi ${payload.session.attempt_number}`}
        action={
          <Button onClick={() => id && void downloadReviewExport(id)}>
            <Download className="mr-2 h-4 w-4" />
            Xuất file rà bài
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Điểm</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {payload.result.score}/{payload.result.total_marks}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Tỷ lệ</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{payload.result.percentage}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Trạng thái</p>
            <div className="mt-3">
              <StatusBadge status={payload.result.result_status} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Nộp bài</p>
            <p className="mt-2 text-sm font-medium text-slate-950">{formatDate(payload.session.submitted_at)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin thí sinh</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-3">
          <div>
            <p className="text-slate-500">Họ tên</p>
            <p className="mt-1 font-medium text-slate-950">{payload.candidate.full_name}</p>
          </div>
          <div>
            <p className="text-slate-500">Email</p>
            <p className="mt-1 font-medium text-slate-950">{payload.candidate.email}</p>
          </div>
          <div>
            <p className="text-slate-500">Tài khoản</p>
            <p className="mt-1 font-mono text-slate-950">{payload.candidate.username}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {payload.questions.map((question) => (
          <Card key={question.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-base">Câu {question.sort_order}</CardTitle>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{question.question_type.replace(/_/g, " ")}</Badge>
                    <Badge variant="outline">{question.difficulty}</Badge>
                    <Badge variant="outline">Điểm tối đa {displayValue(question.points)}</Badge>
                    <Badge variant={question.is_correct === true ? "outline" : "secondary"}>
                      {question.is_correct === null ? "Tự luận" : question.is_correct ? "Đúng" : "Sai"}
                    </Badge>
                  </div>
                </div>
                <div className="text-sm text-slate-600">
                  Điểm đạt: <strong>{displayValue(question.awarded_points ?? question.manual_score_awarded)}</strong>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-900">
                <MathText text={question.question_text} />
              </div>

              {question.options.length > 0 ? (
                <div className="space-y-2">
                  {question.options.map((option) => (
                    <div
                      key={option.key}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        option.is_correct
                          ? "border-emerald-200 bg-emerald-50"
                          : option.is_selected
                            ? "border-blue-200 bg-blue-50"
                            : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span>
                          <span className="font-semibold">{option.key}.</span>{" "}
                          <MathText text={option.text} />
                        </span>
                        <span className="flex gap-1">
                          {option.is_selected ? <Badge variant="outline">Thí sinh chọn</Badge> : null}
                          {option.is_correct ? <Badge variant="outline">Đáp án đúng</Badge> : null}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {question.answer_text ? (
                <div>
                  <p className="text-sm font-medium text-slate-700">Bài làm tự luận</p>
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900">
                    <MathText text={question.answer_text} />
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-slate-500">Đáp án thí sinh</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {question.selected_option_keys.join(", ") || displayValue(question.answer_text)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-slate-500">Đáp án đúng</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {question.correct_option_keys.join(", ") || displayValue(question.sample_answer)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-slate-500">Feedback chấm tự luận</p>
                  <p className="mt-1 text-slate-900">{displayValue(question.manual_feedback)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
