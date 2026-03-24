import { useEffect, useState } from "react";
import { BookOpen, Edit, Plus, Search, Trash2 } from "lucide-react";
import { notify } from "../lib/notify";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";
import { cn } from "../components/ui/utils";
import {
  DEFAULT_SUBJECT_COLOR,
  generateSubjectCode,
  getSubjectColorPresentation,
  normalizeSubjectColorValue,
  normalizeSubjectCodeInput,
} from "./subjectManagementUtils";

interface SubjectRecord {
  id: number;
  name: string;
  code: string;
  description: string;
  color: string;
  is_active: boolean;
  questions_count: number;
  exams_count: number;
  created_at: string;
  updated_at: string;
}

interface SubjectFormState {
  name: string;
  code: string;
  description: string;
  color: string;
  is_active: boolean;
}

const PAGE_SIZE = 20;

const EMPTY_SUBJECT_FORM: SubjectFormState = {
  name: "",
  code: "",
  description: "",
  color: DEFAULT_SUBJECT_COLOR,
  is_active: true,
};

const toSubjectFormState = (subject: SubjectRecord): SubjectFormState => ({
  name: subject.name,
  code: subject.code,
  description: subject.description,
  color: normalizeSubjectColorValue(subject.color),
  is_active: subject.is_active,
});

export function SubjectManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectRecord | null>(null);
  const [formState, setFormState] = useState<SubjectFormState>(EMPTY_SUBJECT_FORM);
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState(false);

  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const mutation = useMutationState();

  const subjectsList = useAsyncList(
    async () =>
      apiRequest<PaginatedResponse<SubjectRecord>>("/api/v1/subjects/", {
        query: {
          page,
          search: debouncedSearch || undefined,
          is_active: activeFilter !== "all" ? activeFilter : undefined,
        },
      }),
    [page, debouncedSearch, activeFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeFilter]);

  const subjects = subjectsList.data?.results ?? [];
  const existingSubjectCodes = subjects.map((subject) => subject.code);

  const openCreateDialog = () => {
    setEditingSubject(null);
    setFormState(EMPTY_SUBJECT_FORM);
    setIsCodeManuallyEdited(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (subject: SubjectRecord) => {
    setEditingSubject(subject);
    setFormState(toSubjectFormState(subject));
    setIsCodeManuallyEdited(
      normalizeSubjectCodeInput(subject.code) !== generateSubjectCode(subject.name, existingSubjectCodes, subject.code),
    );
    setIsDialogOpen(true);
  };

  const closeDialog = (nextOpen: boolean) => {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      setEditingSubject(null);
      setFormState(EMPTY_SUBJECT_FORM);
      setIsCodeManuallyEdited(false);
      mutation.setError(null);
    }
  };

  const saveSubject = async () => {
    const resolvedCode =
      normalizeSubjectCodeInput(formState.code) ||
      generateSubjectCode(formState.name, existingSubjectCodes, editingSubject?.code ?? "");

    if (!formState.name.trim() || !resolvedCode) {
      notify.error("Subject name and code are required.");
      return;
    }

    await mutation.run(async () => {
      const payload = {
        name: formState.name.trim(),
        code: resolvedCode,
        description: formState.description.trim(),
        color: normalizeSubjectColorValue(formState.color),
        is_active: formState.is_active,
      };

      if (editingSubject) {
        await apiRequest(`/api/v1/subjects/${editingSubject.id}/`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await apiRequest("/api/v1/subjects/", {
          method: "POST",
          body: payload,
        });
      }

      await subjectsList.reload();
      closeDialog(false);
      notify.success(editingSubject ? "Subject updated." : "Subject created.");
    });
  };

  const handleSubjectNameChange = (name: string) => {
    setFormState((previous) => ({
      ...previous,
      name,
      code: isCodeManuallyEdited
        ? previous.code
        : generateSubjectCode(name, existingSubjectCodes, editingSubject?.code ?? ""),
    }));
  };

  const handleSubjectCodeChange = (value: string) => {
    const normalizedCode = normalizeSubjectCodeInput(value);
    setIsCodeManuallyEdited(normalizedCode.length > 0);
    setFormState((previous) => ({
      ...previous,
      code: normalizedCode,
    }));
  };

  const resetSubjectCode = () => {
    setIsCodeManuallyEdited(false);
    setFormState((previous) => ({
      ...previous,
      code: generateSubjectCode(previous.name, existingSubjectCodes, editingSubject?.code ?? ""),
    }));
  };

  const handleSubjectColorChange = (value: string) => {
    setFormState((previous) => ({
      ...previous,
      color: normalizeSubjectColorValue(value),
    }));
  };

  const renderSubjectIcon = (color: string, className: string) => {
    const presentation = getSubjectColorPresentation(color);

    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg shadow-sm",
          presentation.containerClassName,
          className,
        )}
        style={presentation.containerStyle}
      >
        <BookOpen className="h-5 w-5" style={presentation.iconStyle} />
      </div>
    );
  };

  const deleteSubject = async (subject: SubjectRecord) => {
    const confirmed = await notify.confirm({
      title: "Delete this subject?",
      text: `Subject "${subject.name}" will be permanently removed.`,
      confirmText: "Delete Subject",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) {
      return;
    }

    await mutation.run(async () => {
      await apiRequest(`/api/v1/subjects/${subject.id}/`, {
        method: "DELETE",
      });
      await subjectsList.reload();
      notify.success("Subject deleted.");
    });
  };

  const totalCount = subjectsList.data?.count ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : rangeStart + subjects.length - 1;

  return (
    <div>
      <PageHeader
        title="Subject Management"
        description="Manage subjects, codes, colors, and availability using the backend API."
        action={
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Subject
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search subjects..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(subjectsList.error || mutation.error) && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {subjectsList.error || mutation.error}
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4 md:hidden">
            {subjectsList.isLoading ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                Loading subjects...
              </div>
            ) : subjects.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                No subjects matched the current filters.
              </div>
            ) : (
              subjects.map((subject) => (
                <div key={subject.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    {renderSubjectIcon(subject.color, "mt-0.5 h-11 w-11 flex-shrink-0")}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{subject.name}</p>
                          <p className="text-xs text-gray-500">
                            Updated {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(subject.updated_at))}
                          </p>
                        </div>
                        <Badge variant={subject.is_active ? "outline" : "secondary"}>
                          {subject.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline">{subject.code}</Badge>
                        <Badge variant="outline">{subject.questions_count} questions</Badge>
                        <Badge variant="outline">{subject.exams_count} exams</Badge>
                      </div>

                      <p className="mt-3 text-sm text-gray-600">
                        {subject.description || "No description provided."}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(subject)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void deleteSubject(subject)}
                          disabled={mutation.isSubmitting}
                        >
                          <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Subject
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Code
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Description
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Questions
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Exams
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {subjectsList.isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                      Loading subjects...
                    </td>
                  </tr>
                ) : subjects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                      No subjects matched the current filters.
                    </td>
                  </tr>
                ) : (
                  subjects.map((subject) => (
                    <tr
                      key={subject.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {renderSubjectIcon(subject.color, "h-10 w-10")}
                          <div>
                            <p className="font-medium text-gray-900">{subject.name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Updated {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(subject.updated_at))}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline">{subject.code}</Badge>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-sm text-gray-600 max-w-xs">
                          {subject.description || "No description provided."}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant={subject.is_active ? "outline" : "secondary"}>
                          {subject.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-900">
                        {subject.questions_count}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-900">
                        {subject.exams_count}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEditDialog(subject)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void deleteSubject(subject)}
                            disabled={mutation.isSubmitting}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Showing <strong>{rangeStart}-{rangeEnd}</strong> of <strong>{totalCount}</strong> subjects
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!subjectsList.data?.previous || subjectsList.isLoading}
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              >
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Page {page}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!subjectsList.data?.next || subjectsList.isLoading}
                onClick={() => setPage((previous) => previous + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSubject ? "Edit Subject" : "Add New Subject"}</DialogTitle>
            <DialogDescription>
              Save the subject metadata that powers exams and question banks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="subject-name">Subject Name</Label>
              <Input
                id="subject-name"
                className="mt-2"
                value={formState.name}
                onChange={(event) => handleSubjectNameChange(event.target.value)}
                placeholder="e.g., Mathematics"
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="subject-code">Subject Code</Label>
                <Button type="button" variant="ghost" size="sm" onClick={resetSubjectCode}>
                  Auto-generate
                </Button>
              </div>
              <Input
                id="subject-code"
                className="mt-2"
                value={formState.code}
                onChange={(event) => handleSubjectCodeChange(event.target.value)}
                placeholder="e.g., TCC or IMO"
              />
              <p className="mt-2 text-xs text-gray-500">
                Generated from the subject name using ASCII uppercase initials. Edit this field to override it.
              </p>
            </div>
            <div>
              <Label htmlFor="subject-desc">Description</Label>
              <Textarea
                id="subject-desc"
                className="mt-2"
                rows={4}
                value={formState.description}
                onChange={(event) =>
                  setFormState((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                placeholder="Brief description of the subject"
              />
            </div>
            <div>
              <Label>Color Theme</Label>
              <div className="mt-2 flex items-center gap-3">
                <Input
                  aria-label="Subject color"
                  type="color"
                  className="h-11 w-16 cursor-pointer p-1"
                  value={normalizeSubjectColorValue(formState.color)}
                  onChange={(event) => handleSubjectColorChange(event.target.value)}
                />
                <Input
                  readOnly
                  value={normalizeSubjectColorValue(formState.color)}
                  className="font-mono uppercase"
                />
                {renderSubjectIcon(formState.color, "h-11 w-11 flex-shrink-0")}
              </div>
              <p className="mt-2 text-xs text-gray-500">Choose any RGB color. The picker supports the full 24-bit range.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formState.is_active}
                onCheckedChange={(checked) =>
                  setFormState((previous) => ({
                    ...previous,
                    is_active: checked === true,
                  }))
                }
              />
              <span className="text-sm text-gray-700">Subject is active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveSubject()} disabled={mutation.isSubmitting}>
              {mutation.isSubmitting
                ? editingSubject
                  ? "Saving..."
                  : "Creating..."
                : editingSubject
                  ? "Save Changes"
                  : "Create Subject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
