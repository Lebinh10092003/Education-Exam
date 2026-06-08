import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Search, Upload, UserPlus } from "lucide-react";
import { notify } from "../lib/notify";

import { ImportTemplateActions } from "../components/imports/ImportTemplateActions";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { apiRequest } from "../lib/http";
import { examStudentImportTemplate } from "../lib/importTemplates";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";

interface ExamAssignmentExam {
  id: number;
  name: string;
  mode: "exam" | "class";
  subject: {
    id: number;
    name: string;
    code: string;
    color: string;
  };
  assignment_summary: {
    assigned_group_ids: number[];
    total_candidates: number;
  };
}

interface GroupAssignmentRecord {
  id: number;
  name: string;
  member_count: number;
  assigned: boolean;
}

interface StudentImportErrorRecord {
  row_number: number;
  identifier: string;
  message: string;
}

interface StudentImportSummary {
  total_rows: number;
  created_users: number;
  updated_users: number;
  assigned_users: number;
  skipped_rows: number;
  failed_rows: number;
  errors: StudentImportErrorRecord[];
}

export function ExamAssignment() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<StudentImportSummary | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const assignmentMutation = useMutationState();
  const importMutation = useMutationState();

  const examDetails = useAsyncList(
    async () => {
      if (!id) {
        throw new Error("Exam id is required.");
      }
      return apiRequest<ExamAssignmentExam>(`/api/v1/exams/${id}/`);
    },
    [id],
  );

  const groupsList = useAsyncList(
    async () => {
      if (!id) {
        return { count: 0, results: [] as GroupAssignmentRecord[] };
      }

      return apiRequest<{ count: number; results: GroupAssignmentRecord[] }>(
        `/api/v1/exams/${id}/group-assignments/`,
        {
          query: {
            search: debouncedSearch || undefined,
          },
        },
      );
    },
    [id, debouncedSearch],
  );

  useEffect(() => {
    if (examDetails.data?.assignment_summary.assigned_group_ids) {
      setSelectedGroupIds(examDetails.data.assignment_summary.assigned_group_ids);
    }
  }, [examDetails.data?.assignment_summary.assigned_group_ids]);

  const toggleGroup = (groupId: number) => {
    setSelectedGroupIds((previous) =>
      previous.includes(groupId)
        ? previous.filter((selectedId) => selectedId !== groupId)
        : [...previous, groupId],
    );
  };

  const saveAssignments = async () => {
    if (!id) {
      return;
    }

    await assignmentMutation.run(async () => {
      await apiRequest(`/api/v1/exams/${id}/group-assignments/`, {
        method: "POST",
        body: {
          group_ids: selectedGroupIds,
        },
      });
      await Promise.all([examDetails.reload(), groupsList.reload()]);
      notify.success(isClass ? "Đã gán học viên vào lớp." : "Đã gán nhóm thí sinh vào kỳ thi.");
      navigate("/exams");
    });
  };

  const uploadStudentImport = async () => {
    if (!id) {
      return;
    }

    if (!importFile) {
      notify.error("Choose a CSV file to import.");
      return;
    }

    const formData = new FormData();
    formData.set("file", importFile);

    await importMutation.run(async () => {
      const summary = await apiRequest<StudentImportSummary>(`/api/v1/exams/${id}/student-import/`, {
        method: "POST",
        body: formData,
      });
      setImportSummary(summary);
      await Promise.all([examDetails.reload(), groupsList.reload()]);
      if (summary.failed_rows > 0) {
        notify.info(`Imported with ${summary.failed_rows} row error(s).`);
      } else {
        notify.success("Students imported successfully.");
      }
    });
  };

  const exam = examDetails.data;
  const isClass = exam?.mode === "class";
  const groups = groupsList.data?.results ?? [];
  const combinedError =
    examDetails.error || groupsList.error || assignmentMutation.error || importMutation.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isClass ? "Gán học viên vào lớp" : "Gán nhóm thí sinh vào kỳ thi"}
        description={
          exam
            ? `${exam.name} • ${exam.subject.name} • ${exam.assignment_summary.total_candidates} ${isClass ? "học viên" : "thí sinh"}`
            : isClass
              ? "Tải danh sách nhóm học viên"
              : "Tải danh sách nhóm thí sinh"
        }
        action={
          <Button
            onClick={() => void saveAssignments()}
            disabled={assignmentMutation.isSubmitting || examDetails.isLoading}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {assignmentMutation.isSubmitting
              ? "Đang lưu..."
              : isClass
                ? "Lưu gán học viên"
                : "Lưu gán nhóm thí sinh"}
          </Button>
        }
      />

      {combinedError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {combinedError}
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Tìm nhóm..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-3">
            {groupsList.isLoading ? (
              <div className="py-12 text-center text-sm text-gray-500">
                {isClass ? "Đang tải nhóm học viên..." : "Đang tải nhóm thí sinh..."}
              </div>
            ) : groups.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">Không có nhóm nào phù hợp.</div>
            ) : (
              groups.map((group) => (
                <label
                  key={group.id}
                  className="flex cursor-pointer items-center gap-4 rounded-lg border-2 p-4 transition-colors hover:bg-gray-50"
                >
                  <Checkbox
                    checked={selectedGroupIds.includes(group.id)}
                    onCheckedChange={() => toggleGroup(group.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{group.name}</p>
                      {group.assigned && <Badge variant="outline">Đã gán</Badge>}
                    </div>
                    <p className="text-sm text-gray-500">
                      {group.member_count} thành viên
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>
            {isClass ? "Import học viên trực tiếp vào lớp" : "Import thí sinh trực tiếp vào kỳ thi"}
          </CardTitle>
          <p className="text-sm text-gray-600">
            Upload a CSV to create or update `student` accounts by CCCD, then assign them straight
            to this {isClass ? "class" : "exam"}. New passwords default to the generated username.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Generated usernames follow the format `name.ddmmyyyy.class`, for example
            `le.van.binh.24082003.12`. If email is blank, the backend will generate
            `username@student.local`.
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-import-file">Student CSV File</Label>
            <Input
              id="student-import-file"
              type="file"
              accept=".csv"
              onChange={(event) => {
                setImportFile(event.target.files?.[0] ?? null);
                setImportSummary(null);
              }}
            />
            {importFile ? (
              <p className="text-xs text-gray-500">
                Selected file: <strong>{importFile.name}</strong>
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Open the CSV template</p>
              <p className="text-xs text-gray-500">
                Preview the required columns and download a starter file before importing.
              </p>
            </div>
            <ImportTemplateActions template={examStudentImportTemplate} selectedFormat="csv" />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void uploadStudentImport()} disabled={importMutation.isSubmitting}>
              <Upload className="mr-2 h-4 w-4" />
              {importMutation.isSubmitting ? "Importing..." : "Import Students"}
            </Button>
          </div>

          {importSummary ? (
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Created</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{importSummary.created_users}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Updated</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{importSummary.updated_users}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Đã gán</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{importSummary.assigned_users}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Failed</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{importSummary.failed_rows}</p>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                Processed <strong>{importSummary.total_rows}</strong> row(s) with{" "}
                <strong>{importSummary.skipped_rows}</strong> skipped.
              </div>

              {importSummary.errors.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-900">Rows that still need attention</p>
                  <div className="mt-3 space-y-2">
                    {importSummary.errors.map((error) => (
                      <div
                        key={`${error.row_number}-${error.identifier}-${error.message}`}
                        className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-amber-900"
                      >
                        Row {error.row_number}
                        {error.identifier ? ` • ${error.identifier}` : ""}: {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
