import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, RefreshCw } from "lucide-react";

import { apiRequest } from "../lib/http";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { cn } from "./ui/utils";

type IssueLevel = "error" | "warning" | "info";

export type ExamQualityIssue = {
  level: IssueLevel;
  code: string;
  message: string;
  question_id?: number;
  position?: number;
};

export type ExamQualityReport = {
  exam: { id: number; name: string; status: string; subject: string };
  ready: boolean;
  summary: { errors: number; warnings: number; info: number };
  issues: ExamQualityIssue[];
  stats: {
    question_count?: number;
    total_points?: string;
    assigned_candidates?: number;
    duration_minutes?: number;
    by_type?: Record<string, number>;
    by_difficulty?: Record<string, number>;
    random_rules?: Array<{ sort_order: number; required: number; available: number }>;
  };
};

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: "Trắc nghiệm",
  true_false: "Đúng/Sai",
  essay: "Tự luận",
};
const DIFFICULTY_LABELS: Record<string, string> = { easy: "Dễ", medium: "Trung bình", hard: "Khó" };

const LEVEL_STYLES: Record<IssueLevel, { icon: typeof AlertCircle; className: string; label: string }> = {
  error: { icon: AlertCircle, className: "border-red-200 bg-red-50 text-red-800", label: "Lỗi" },
  warning: { icon: AlertTriangle, className: "border-amber-200 bg-amber-50 text-amber-900", label: "Cảnh báo" },
  info: { icon: Info, className: "border-blue-200 bg-blue-50 text-blue-800", label: "Thông tin" },
};

const formatCounts = (counts: Record<string, number> | undefined, labels: Record<string, string>) =>
  Object.entries(counts ?? {})
    .map(([key, value]) => `${labels[key] ?? key}: ${value}`)
    .join(" · ") || "—";

type Props = {
  examId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ExamQualityCheckDialog({ examId, open, onOpenChange }: Props) {
  const [report, setReport] = useState<ExamQualityReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setReport(await apiRequest<ExamQualityReport>(`/api/v1/exams/${examId}/quality-check/`));
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Không kiểm tra được đề.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void runCheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, examId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kiểm tra đề</DialogTitle>
          <DialogDescription>
            Rà soát câu hỏi, luật sinh đề ngẫu nhiên, lịch thi và phân công thí sinh trước khi mở đề.
          </DialogDescription>
        </DialogHeader>

        {isLoading && !report ? <p className="py-6 text-center text-sm text-slate-500">Đang kiểm tra đề...</p> : null}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {report ? (
          <div className="space-y-4">
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4",
                report.ready ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50",
              )}
            >
              {report.ready ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              )}
              <div>
                <p className={cn("font-semibold", report.ready ? "text-green-900" : "text-red-900")}>
                  {report.ready ? "Đề sẵn sàng để thi" : "Đề chưa sẵn sàng"}
                </p>
                <p className="text-sm text-slate-700">
                  {report.summary.errors} lỗi · {report.summary.warnings} cảnh báo · {report.summary.info} thông tin
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs text-slate-500">Số câu</dt>
                <dd className="text-lg font-semibold text-slate-900">{report.stats.question_count ?? 0}</dd>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs text-slate-500">Tổng điểm</dt>
                <dd className="text-lg font-semibold text-slate-900">{report.stats.total_points ?? "0"}</dd>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs text-slate-500">Thí sinh</dt>
                <dd className="text-lg font-semibold text-slate-900">{report.stats.assigned_candidates ?? 0}</dd>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs text-slate-500">Thời gian</dt>
                <dd className="text-lg font-semibold text-slate-900">{report.stats.duration_minutes ?? "—"} phút</dd>
              </div>
            </dl>
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">Loại câu:</span>{" "}
              {formatCounts(report.stats.by_type, TYPE_LABELS)}
              <br />
              <span className="font-medium text-slate-800">Độ khó:</span>{" "}
              {formatCounts(report.stats.by_difficulty, DIFFICULTY_LABELS)}
            </p>

            {report.stats.random_rules && report.stats.random_rules.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-800">Luật sinh đề ngẫu nhiên</p>
                <ul className="space-y-1 text-sm">
                  {report.stats.random_rules.map((rule) => (
                    <li key={rule.sort_order} className="flex justify-between rounded border border-slate-200 px-3 py-1.5">
                      <span>Luật #{rule.sort_order}: cần {rule.required} câu</span>
                      <span className={rule.available < rule.required ? "font-semibold text-red-700" : "text-slate-600"}>
                        ngân hàng có {rule.available}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {report.issues.length > 0 ? (
              <ul className="space-y-2" aria-label="Danh sách vấn đề">
                {report.issues.map((issue, index) => {
                  const style = LEVEL_STYLES[issue.level];
                  const Icon = style.icon;
                  return (
                    <li
                      key={`${issue.code}-${index}`}
                      className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", style.className)}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <Badge variant="outline" className="mr-2 border-current text-[11px]">
                          {style.label}
                        </Badge>
                        {issue.message}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">Không phát hiện vấn đề nào.</p>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => void runCheck()} disabled={isLoading}>
                <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                Kiểm tra lại
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
