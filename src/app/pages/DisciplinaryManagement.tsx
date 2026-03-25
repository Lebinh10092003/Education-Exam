import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Download, ExternalLink, Search, Shield } from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { notify } from "../lib/notify";
import {
  type DisciplinaryExamSummaryRecord,
  downloadDisciplineWorkbook,
  formatDisciplineDate,
} from "./disciplineShared";

export function DisciplinaryManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 250);
  const mutation = useMutationState();
  const examList = useAsyncList(
    () => apiRequest<PaginatedResponse<DisciplinaryExamSummaryRecord>>("/api/v1/discipline/exams/"),
    [],
  );

  const filteredExams = useMemo(() => {
    const normalized = debouncedSearch.trim().toLowerCase();
    const results = examList.data?.results ?? [];
    if (!normalized) {
      return results;
    }
    return results.filter((exam) =>
      [exam.name, exam.subject_name].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [debouncedSearch, examList.data?.results]);

  const exportExam = async (exam: DisciplinaryExamSummaryRecord) => {
    try {
      await mutation.run(() =>
        downloadDisciplineWorkbook(
          `/api/v1/discipline/exams/${exam.id}/export/`,
          `eduexam-discipline-summary-exam-${exam.id}.xlsx`,
        ),
      );
      notify.success("Disciplinary summary exported.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to export disciplinary summary.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Discipline & Certificates"
        description="Review violating candidates by exam, apply penalties, and keep certificates aligned with penalized scores."
      />

      {(examList.error || mutation.error) ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {examList.error ?? mutation.error}
        </div>
      ) : null}

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by exam or subject..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" />
            Exam Discipline Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {examList.isLoading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">Loading disciplinary exams...</div>
          ) : filteredExams.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 font-semibold">Exam</th>
                    <th className="px-4 py-3 font-semibold">Violating Candidates</th>
                    <th className="px-4 py-3 font-semibold">Cases</th>
                    <th className="px-4 py-3 font-semibold">Approved</th>
                    <th className="px-4 py-3 font-semibold">Pending</th>
                    <th className="px-4 py-3 font-semibold">Result Sync</th>
                    <th className="px-4 py-3 font-semibold">Certificate</th>
                    <th className="px-4 py-3 font-semibold">Last Updated</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExams.map((exam) => (
                    <tr key={exam.id} className="border-b border-gray-100 align-top">
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-900">{exam.name}</p>
                        <p className="text-xs text-gray-500">{exam.subject_name}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{exam.unique_violating_candidates}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{exam.total_cases}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{exam.approved_records}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{exam.pending_review_count}</td>
                      <td className="px-4 py-4">
                        <Badge variant="outline">{exam.result_sync_status}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={exam.certificate_status === "configured" ? "default" : "outline"}>
                          {exam.certificate_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{formatDisciplineDate(exam.last_updated)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/discipline/exams/${exam.id}`}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open Sheet
                            </Link>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void exportExam(exam)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              No exams with disciplinary data matched the current search.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
