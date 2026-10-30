import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Eye, Flag, X } from "lucide-react";

import { apiRequest } from "../lib/http";
import { MathText } from "./MathText";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import { cn } from "./ui/utils";

type PreviewItem = {
  id: number;
  source: "manual" | "random";
  sort_order: number;
  points: string;
  question_id: number;
  question_type: "multiple_choice" | "true_false" | "essay" | string;
  difficulty: string;
  question_text: string;
  options: Array<{ key: string; text: string }>;
  correct_option_keys: string[];
  essay_rubric: string;
  sample_answer: string;
};

export type ExamPreviewPayload = {
  exam: {
    id: number;
    name: string;
    subject: string;
    duration_minutes: number;
    enable_proctoring: boolean;
    shuffle_questions: boolean;
  };
  has_random_rules: boolean;
  items: PreviewItem[];
};

const TYPE_LABELS: Record<string, string> = { multiple_choice: "Trắc nghiệm", true_false: "Đúng/Sai", essay: "Tự luận" };
const DIFFICULTY_LABELS: Record<string, string> = { easy: "Dễ", medium: "Trung bình", hard: "Khó" };

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  return `${hours}:${String(minutes % 60).padStart(2, "0")}:00`;
};

type Props = { examId: number; open: boolean; onOpenChange: (open: boolean) => void };

/**
 * Xem truoc de giong man hinh hoc sinh lam bai: tung cau, dieu huong, danh dau, chon thu dap an.
 * Khong luu gi; cong tac "Hien dap an" de nguoi ra de soat lai dap an/barem.
 */
export function ExamStudentPreview({ examId, open, onOpenChange }: Props) {
  const [payload, setPayload] = useState<ExamPreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [essays, setEssays] = useState<Record<number, string>>({});
  const [marked, setMarked] = useState<Record<number, boolean>>({});
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPayload(null);
    setError(null);
    setIndex(0);
    setAnswers({});
    setEssays({});
    setMarked({});
    apiRequest<ExamPreviewPayload>(`/api/v1/exams/${examId}/preview/`)
      .then(setPayload)
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : "Không tải được bản xem trước."),
      );
  }, [examId, open]);

  const items = payload?.items ?? [];
  const current = items[index];
  const answeredCount = useMemo(
    () => items.filter((item) => answers[item.id] || (essays[item.id] ?? "").trim()).length,
    [answers, essays, items],
  );

  const isAnswered = (item: PreviewItem) => Boolean(answers[item.id] || (essays[item.id] ?? "").trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[95vh] max-h-[95vh] w-[98vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl [&>button]:hidden">
        <DialogTitle className="sr-only">Xem trước đề như thí sinh</DialogTitle>
        <DialogDescription className="sr-only">Mô phỏng màn hình làm bài, không lưu câu trả lời.</DialogDescription>

        <div className="flex items-center justify-between gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900">
          <span className="flex items-center gap-2 font-medium">
            <Eye className="h-4 w-4" />
            Chế độ xem trước — mô phỏng màn hình thí sinh, câu trả lời không được lưu.
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 whitespace-nowrap">
              <Switch checked={showAnswers} onCheckedChange={setShowAnswers} aria-label="Hiện đáp án" />
              Hiện đáp án
            </label>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onOpenChange(false)} aria-label="Đóng xem trước">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error ? <p className="p-6 text-sm text-red-600">{error}</p> : null}
        {!payload && !error ? <p className="p-6 text-sm text-slate-500">Đang tải đề...</p> : null}

        {payload ? (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-slate-900">{payload.exam.name}</h2>
                <p className="text-sm text-slate-600">
                  {items.length ? `Câu hỏi ${index + 1} / ${items.length}` : "Đề chưa có câu hỏi"} · {payload.exam.subject}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="font-mono font-semibold text-blue-900">{formatDuration(payload.exam.duration_minutes)}</span>
                </div>
                <Button disabled title="Không nộp được ở chế độ xem trước">
                  Nộp bài thi
                </Button>
              </div>
            </header>

            {payload.has_random_rules || payload.exam.shuffle_questions ? (
              <p className="border-b border-slate-200 bg-slate-50 px-6 py-2 text-xs text-slate-600">
                {payload.has_random_rules ? "Đề có luật ngẫu nhiên: mỗi thí sinh nhận bộ câu khác nhau, đây là một bộ mẫu. " : ""}
                {payload.exam.shuffle_questions ? "Thứ tự câu sẽ được xáo trộn cho từng thí sinh." : ""}
              </p>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:flex-row">
              {current ? (
                <section className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Câu {index + 1}</Badge>
                    <Badge variant="outline">{TYPE_LABELS[current.question_type] ?? current.question_type}</Badge>
                    <Badge variant="outline">{DIFFICULTY_LABELS[current.difficulty] ?? current.difficulty}</Badge>
                    <Badge variant="outline">{current.points} điểm</Badge>
                    {current.source === "random" ? <Badge className="bg-violet-100 text-violet-800">Câu ngẫu nhiên</Badge> : null}
                    <Button
                      size="sm"
                      variant={marked[current.id] ? "default" : "outline"}
                      className="ml-auto"
                      onClick={() => setMarked({ ...marked, [current.id]: !marked[current.id] })}
                    >
                      <Flag className="mr-1 h-4 w-4" />
                      {marked[current.id] ? "Bỏ đánh dấu" : "Đánh dấu xem lại"}
                    </Button>
                  </div>

                  <div className="text-base leading-relaxed text-slate-900">
                    <MathText text={current.question_text} />
                  </div>

                  {current.question_type === "essay" ? (
                    <Textarea
                      className="mt-6 min-h-40"
                      placeholder="Nhập câu trả lời của bạn tại đây..."
                      value={essays[current.id] ?? ""}
                      onChange={(event) => setEssays({ ...essays, [current.id]: event.target.value })}
                    />
                  ) : (
                    <div className="mt-6 space-y-3" role="radiogroup" aria-label={`Phương án câu ${index + 1}`}>
                      {current.options.map((option) => {
                        const selected = answers[current.id] === option.key;
                        const correct = current.correct_option_keys.includes(option.key);
                        return (
                          <button
                            key={option.key}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setAnswers({ ...answers, [current.id]: option.key })}
                            className={cn(
                              "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                              selected ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300",
                              showAnswers && correct && "border-green-500 bg-green-50",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                                selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-slate-600",
                              )}
                            >
                              {option.key}
                            </span>
                            <span className="flex-1 pt-0.5 text-slate-800">
                              <MathText text={option.text} />
                            </span>
                            {showAnswers && correct ? (
                              <span className="shrink-0 text-xs font-semibold text-green-700">Đáp án đúng</span>
                            ) : null}
                          </button>
                        );
                      })}
                      {current.options.length === 0 ? (
                        <p className="text-sm text-red-600">Câu trắc nghiệm chưa có phương án.</p>
                      ) : null}
                    </div>
                  )}

                  {showAnswers && current.question_type === "essay" ? (
                    <div className="mt-4 space-y-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                      <p>
                        <span className="font-semibold">Barem:</span> {current.essay_rubric || "Chưa có barem."}
                      </p>
                      {current.sample_answer ? (
                        <p>
                          <span className="font-semibold">Đáp án mẫu:</span> {current.sample_answer}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-8 flex justify-between">
                    <Button variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Trước
                    </Button>
                    <Button variant="outline" disabled={index >= items.length - 1} onClick={() => setIndex(index + 1)}>
                      Sau
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </section>
              ) : (
                <p className="flex-1 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                  Đề chưa có câu hỏi nào.
                </p>
              )}

              <aside className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:w-72">
                <h3 className="font-semibold text-slate-900">Điều hướng câu hỏi</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Đã làm {answeredCount}/{items.length}
                </p>
                <div className="mt-4 grid grid-cols-6 gap-2 lg:grid-cols-5">
                  {items.map((item, itemIndex) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setIndex(itemIndex)}
                      aria-label={`Câu ${itemIndex + 1}`}
                      className={cn(
                        "h-9 rounded-lg border text-sm font-semibold",
                        itemIndex === index && "ring-2 ring-blue-500 ring-offset-1",
                        marked[item.id]
                          ? "border-amber-400 bg-amber-100 text-amber-900"
                          : isAnswered(item)
                            ? "border-green-500 bg-green-100 text-green-900"
                            : "border-slate-200 bg-white text-slate-700",
                      )}
                    >
                      {itemIndex + 1}
                    </button>
                  ))}
                </div>
                <div className="mt-4 space-y-1 text-xs text-slate-600">
                  <p className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded border border-green-500 bg-green-100" /> Đã trả lời
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded border border-amber-400 bg-amber-100" /> Đánh dấu xem lại
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded border border-slate-200 bg-white" /> Chưa trả lời
                  </p>
                </div>
                {payload.exam.enable_proctoring ? (
                  <p className="mt-4 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
                    Bài thi có giám sát: khi thi thật, thí sinh phải bật camera, chia sẻ màn hình và ở chế độ toàn màn hình.
                  </p>
                ) : null}
              </aside>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
