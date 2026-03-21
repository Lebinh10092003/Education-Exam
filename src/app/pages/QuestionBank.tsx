import { useEffect, useState } from "react";
import { Download, Edit, Eye, Plus, Search, Trash2 } from "lucide-react";
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
import { ImportTemplateActions } from "../components/imports/ImportTemplateActions";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { questionImportTemplate } from "../lib/importTemplates";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";

interface SubjectOption {
  id: number;
  name: string;
  code: string;
  color: string;
}

interface QuestionTag {
  id: number;
  name: string;
  slug: string;
}

interface QuestionOption {
  key: string;
  text: string;
  sort_order: number;
}

interface QuestionAnswerKey {
  correct_option_keys: string[];
  acceptable_answers: string[];
  essay_rubric: string;
  sample_answer: string;
}

interface QuestionRevision {
  id: number;
  revision_number: number;
  question_text: string;
  options: QuestionOption[];
  answer_key: QuestionAnswerKey;
  created_at: string;
}

interface QuestionRecord {
  id: number;
  difficulty: "easy" | "medium" | "hard";
  question_type: "multiple_choice" | "essay" | "true_false";
  subject: SubjectOption;
  tags: QuestionTag[];
  current_revision: QuestionRevision;
  created_at: string;
  updated_at: string;
}

interface QuestionImportBatch {
  id: number;
  source_format: "csv" | "json";
  file_name: string;
  status: string;
  total_records: number;
  success_count: number;
  error_count: number;
  created_at: string;
}

interface QuestionFormOption {
  key: string;
  text: string;
}

interface QuestionFormState {
  subject_id: string;
  difficulty: QuestionRecord["difficulty"];
  question_type: QuestionRecord["question_type"];
  question_text: string;
  tags_text: string;
  options: QuestionFormOption[];
  correct_option_keys: string[];
  acceptable_answers_text: string;
  essay_rubric: string;
  sample_answer: string;
}

const PAGE_SIZE = 20;
const MULTIPLE_CHOICE_DEFAULT_OPTIONS = ["A", "B", "C", "D"];
const TRUE_FALSE_OPTIONS: QuestionFormOption[] = [
  { key: "TRUE", text: "True" },
  { key: "FALSE", text: "False" },
];

const difficultyColors = {
  easy: "bg-green-100 text-green-800 hover:bg-green-100",
  medium: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  hard: "bg-red-100 text-red-800 hover:bg-red-100",
} as const;

const difficultyLabels = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
} as const;

const questionTypeLabels = {
  multiple_choice: "Multiple Choice",
  essay: "Essay",
  true_false: "True / False",
} as const;

const makeMultipleChoiceOptions = (existing?: QuestionFormOption[]) => {
  const filled = existing?.filter((option) => option.text.trim()) ?? [];
  if (filled.length > 0) {
    return filled.map((option, index) => ({
      key: MULTIPLE_CHOICE_DEFAULT_OPTIONS[index] ?? `OPT_${index + 1}`,
      text: option.text,
    }));
  }

  return MULTIPLE_CHOICE_DEFAULT_OPTIONS.map((key) => ({ key, text: "" }));
};

const buildDefaultFormState = (): QuestionFormState => ({
  subject_id: "",
  difficulty: "easy",
  question_type: "multiple_choice",
  question_text: "",
  tags_text: "",
  options: makeMultipleChoiceOptions(),
  correct_option_keys: [],
  acceptable_answers_text: "",
  essay_rubric: "",
  sample_answer: "",
});

const toFormState = (question: QuestionRecord): QuestionFormState => ({
  subject_id: String(question.subject.id),
  difficulty: question.difficulty,
  question_type: question.question_type,
  question_text: question.current_revision.question_text,
  tags_text: question.tags.map((tag) => tag.name).join(", "),
  options:
    question.question_type === "essay"
      ? []
      : question.current_revision.options.map((option) => ({
          key: option.key,
          text: option.text,
        })),
  correct_option_keys: question.current_revision.answer_key.correct_option_keys,
  acceptable_answers_text: question.current_revision.answer_key.acceptable_answers.join(", "),
  essay_rubric: question.current_revision.answer_key.essay_rubric,
  sample_answer: question.current_revision.answer_key.sample_answer,
});

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function QuestionBank() {
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionRecord | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuestionRecord | null>(null);
  const [formState, setFormState] = useState<QuestionFormState>(buildDefaultFormState);
  const [importFormat, setImportFormat] = useState<"csv" | "json">("csv");
  const [importFile, setImportFile] = useState<File | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const questionMutation = useMutationState();
  const importMutation = useMutationState();

  const subjectsList = useAsyncList(
    async () => apiRequest<PaginatedResponse<SubjectOption>>("/api/v1/subjects/"),
    [],
  );

  const questionsList = useAsyncList(
    async () =>
      apiRequest<PaginatedResponse<QuestionRecord>>("/api/v1/questions/", {
        query: {
          page,
          search: debouncedSearch || undefined,
          subject: subjectFilter !== "all" ? subjectFilter : undefined,
          difficulty: difficultyFilter !== "all" ? difficultyFilter : undefined,
          question_type: typeFilter !== "all" ? typeFilter : undefined,
        },
      }),
    [page, debouncedSearch, subjectFilter, difficultyFilter, typeFilter],
  );

  const importBatches = useAsyncList(
    async () => apiRequest<PaginatedResponse<QuestionImportBatch>>("/api/v1/question-imports/"),
    [],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, subjectFilter, difficultyFilter, typeFilter]);

  const questions = questionsList.data?.results ?? [];
  const subjects = subjectsList.data?.results ?? [];
  const totalCount = questionsList.data?.count ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : rangeStart + questions.length - 1;

  const openCreateDialog = () => {
    setEditingQuestion(null);
    setFormState(buildDefaultFormState());
    setIsQuestionDialogOpen(true);
  };

  const openEditDialog = (question: QuestionRecord) => {
    setEditingQuestion(question);
    setFormState(toFormState(question));
    setIsQuestionDialogOpen(true);
  };

  const closeQuestionDialog = (nextOpen: boolean) => {
    setIsQuestionDialogOpen(nextOpen);
    if (!nextOpen) {
      setEditingQuestion(null);
      setFormState(buildDefaultFormState());
      questionMutation.setError(null);
    }
  };

  const handleQuestionTypeChange = (questionType: QuestionFormState["question_type"]) => {
    setFormState((previous) => {
      if (questionType === "essay") {
        return {
          ...previous,
          question_type: questionType,
          options: [],
          correct_option_keys: [],
        };
      }

      if (questionType === "true_false") {
        return {
          ...previous,
          question_type: questionType,
          options: TRUE_FALSE_OPTIONS,
          correct_option_keys: previous.correct_option_keys.filter((key) =>
            TRUE_FALSE_OPTIONS.some((option) => option.key === key),
          ),
        };
      }

      return {
        ...previous,
        question_type: questionType,
        options: makeMultipleChoiceOptions(previous.options),
        correct_option_keys: previous.correct_option_keys.filter((key) =>
          MULTIPLE_CHOICE_DEFAULT_OPTIONS.includes(key),
        ),
      };
    });
  };

  const updateOptionText = (optionKey: string, text: string) => {
    setFormState((previous) => ({
      ...previous,
      options: previous.options.map((option) =>
        option.key === optionKey ? { ...option, text } : option,
      ),
    }));
  };

  const addOption = () => {
    setFormState((previous) => {
      const nextKey =
        MULTIPLE_CHOICE_DEFAULT_OPTIONS[previous.options.length] ??
        `OPT_${previous.options.length + 1}`;
      return {
        ...previous,
        options: [...previous.options, { key: nextKey, text: "" }],
      };
    });
  };

  const removeOption = (optionKey: string) => {
    setFormState((previous) => ({
      ...previous,
      options: previous.options.filter((option) => option.key !== optionKey),
      correct_option_keys: previous.correct_option_keys.filter((key) => key !== optionKey),
    }));
  };

  const toggleCorrectOption = (optionKey: string) => {
    setFormState((previous) => ({
      ...previous,
      correct_option_keys: previous.correct_option_keys.includes(optionKey)
        ? previous.correct_option_keys.filter((key) => key !== optionKey)
        : [...previous.correct_option_keys, optionKey],
    }));
  };

  const saveQuestion = async () => {
    if (!formState.subject_id || !formState.question_text.trim()) {
      notify.error("Subject and question text are required.");
      return;
    }

    const payload: Record<string, unknown> = {
      subject_id: Number(formState.subject_id),
      difficulty: formState.difficulty,
      question_type: formState.question_type,
      question_text: formState.question_text.trim(),
      tags: formState.tags_text
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      acceptable_answers: formState.acceptable_answers_text
        .split(",")
        .map((answer) => answer.trim())
        .filter(Boolean),
      essay_rubric: formState.essay_rubric.trim(),
      sample_answer: formState.sample_answer.trim(),
    };

    if (formState.question_type === "essay") {
      payload.options = [];
      payload.correct_option_keys = [];
    } else {
      payload.options = formState.options
        .map((option, index) => ({
          key: option.key,
          text: option.text.trim(),
          sort_order: index + 1,
        }))
        .filter((option) => option.text);
      payload.correct_option_keys = formState.correct_option_keys;
    }

    await questionMutation.run(async () => {
      if (editingQuestion) {
        await apiRequest(`/api/v1/questions/${editingQuestion.id}/`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await apiRequest("/api/v1/questions/", {
          method: "POST",
          body: payload,
        });
      }

      await questionsList.reload();
      closeQuestionDialog(false);
      notify.success(editingQuestion ? "Question updated." : "Question created.");
    });
  };

  const deleteQuestion = async (question: QuestionRecord) => {
    const confirmed = await notify.confirm({
      title: "Delete this question?",
      text: "This will permanently remove the question and all of its revisions.",
      confirmText: "Delete Question",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) {
      return;
    }

    await questionMutation.run(async () => {
      await apiRequest(`/api/v1/questions/${question.id}/`, {
        method: "DELETE",
      });
      await questionsList.reload();
      notify.success("Question deleted.");
    });
  };

  const uploadImportBatch = async () => {
    if (!importFile) {
      notify.error("Choose a file to import.");
      return;
    }

    const formData = new FormData();
    formData.set("source_format", importFormat);
    formData.set("file", importFile);

    await importMutation.run(async () => {
      await apiRequest("/api/v1/question-imports/", {
        method: "POST",
        body: formData,
      });
      setImportFile(null);
      setIsImportDialogOpen(false);
      await Promise.all([questionsList.reload(), importBatches.reload()]);
      notify.success("Question import completed.");
    });
  };

  return (
    <div>
      <PageHeader
        title="Question Bank"
        description="Manage revisioned questions, answer keys, and imports using the backend."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
              <Download className="w-4 h-4 mr-2" />
              Import Questions
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-full xl:w-[220px]">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={String(subject.id)}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger className="w-full xl:w-[200px]">
                <SelectValue placeholder="All Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulty</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full xl:w-[220px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                <SelectItem value="essay">Essay</SelectItem>
                <SelectItem value="true_false">True / False</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {importBatches.data?.results?.[0] && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Latest import: <strong>{importBatches.data.results[0].file_name}</strong> •{" "}
              {importBatches.data.results[0].success_count}/
              {importBatches.data.results[0].total_records} succeeded
            </div>
          )}
        </CardContent>
      </Card>

      {(questionsList.error || subjectsList.error || questionMutation.error || importMutation.error) && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {questionsList.error || subjectsList.error || questionMutation.error || importMutation.error}
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4 md:hidden">
            {questionsList.isLoading ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                Loading questions...
              </div>
            ) : questions.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                No questions matched the current filters.
              </div>
            ) : (
              questions.map((question) => (
                <div key={question.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{question.current_revision.question_text}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Updated {formatDateTime(question.updated_at)} • v{question.current_revision.revision_number}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setPreviewQuestion(question)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(question)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void deleteQuestion(question)}
                        disabled={questionMutation.isSubmitting}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">{question.subject.name}</Badge>
                    <Badge className={difficultyColors[question.difficulty]}>
                      {difficultyLabels[question.difficulty]}
                    </Badge>
                    <Badge variant="outline">{questionTypeLabels[question.question_type]}</Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {question.tags.length > 0 ? (
                      question.tags.map((tag) => (
                        <Badge key={tag.id} variant="outline" className="text-xs">
                          {tag.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">No tags</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Question</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Subject</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Difficulty</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tags</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Revision</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {questionsList.isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                      Loading questions...
                    </td>
                  </tr>
                ) : questions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                      No questions matched the current filters.
                    </td>
                  </tr>
                ) : (
                  questions.map((question) => (
                    <tr key={question.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <p className="font-medium text-gray-900 max-w-md">
                          {question.current_revision.question_text}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Updated {formatDateTime(question.updated_at)}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline">{question.subject.name}</Badge>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={difficultyColors[question.difficulty]}>
                          {difficultyLabels[question.difficulty]}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {questionTypeLabels[question.question_type]}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1">
                          {question.tags.length > 0 ? (
                            question.tags.map((tag) => (
                              <Badge key={tag.id} variant="outline" className="text-xs">
                                {tag.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-gray-500">No tags</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        v{question.current_revision.revision_number}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setPreviewQuestion(question)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEditDialog(question)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void deleteQuestion(question)}
                            disabled={questionMutation.isSubmitting}
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
              Showing <strong>{rangeStart}-{rangeEnd}</strong> of <strong>{totalCount}</strong> questions
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!questionsList.data?.previous || questionsList.isLoading}
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
                disabled={!questionsList.data?.next || questionsList.isLoading}
                onClick={() => setPage((previous) => previous + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Questions</DialogTitle>
            <DialogDescription>
              Upload a CSV or JSON file and let the backend create revisioned questions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>File Format</Label>
              <Select value={importFormat} onValueChange={(value: "csv" | "json") => setImportFormat(value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Upload File</Label>
              <Input
                type="file"
                className="mt-2"
                accept={importFormat === "csv" ? ".csv" : ".json"}
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Need a backend-compatible sample file?</p>
                <p className="text-xs text-gray-500">
                  Preview the expected structure or download a ready-to-fill template.
                </p>
              </div>
              <ImportTemplateActions
                template={questionImportTemplate}
                selectedFormat={importFormat}
              />
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Required import fields include `subject_code`, `difficulty`, `question_type`, and `question_text`.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void uploadImportBatch()} disabled={importMutation.isSubmitting}>
              {importMutation.isSubmitting ? "Importing..." : "Import Questions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuestionDialogOpen} onOpenChange={closeQuestionDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Edit Question" : "Create New Question"}</DialogTitle>
            <DialogDescription>
              Save question content, objective answer keys, and essay grading metadata.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div>
              <Label htmlFor="question-subject">Subject</Label>
              <Select
                value={formState.subject_id}
                onValueChange={(value) =>
                  setFormState((previous) => ({
                    ...previous,
                    subject_id: value,
                  }))
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={String(subject.id)}>
                      {subject.name} ({subject.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="question-text">Question</Label>
              <Textarea
                id="question-text"
                className="mt-2"
                rows={4}
                value={formState.question_text}
                onChange={(event) =>
                  setFormState((previous) => ({
                    ...previous,
                    question_text: event.target.value,
                  }))
                }
                placeholder="Enter your question here..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Difficulty</Label>
                <Select
                  value={formState.difficulty}
                  onValueChange={(value: QuestionFormState["difficulty"]) =>
                    setFormState((previous) => ({
                      ...previous,
                      difficulty: value,
                    }))
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Question Type</Label>
                <Select value={formState.question_type} onValueChange={handleQuestionTypeChange}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="essay">Essay</SelectItem>
                    <SelectItem value="true_false">True / False</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formState.question_type !== "essay" && (
              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Answer Options</h4>
                    <p className="text-sm text-gray-500">Mark one or more correct options.</p>
                  </div>
                  {formState.question_type === "multiple_choice" && (
                    <Button type="button" variant="outline" size="sm" onClick={addOption}>
                      Add Option
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {formState.options.map((option) => (
                    <div key={option.key} className="flex items-center gap-3">
                      <Checkbox
                        checked={formState.correct_option_keys.includes(option.key)}
                        onCheckedChange={() => toggleCorrectOption(option.key)}
                      />
                      <div className="w-10 text-sm font-semibold text-gray-600">{option.key}</div>
                      <Input
                        className="flex-1"
                        value={option.text}
                        onChange={(event) => updateOptionText(option.key, event.target.value)}
                        placeholder={`Option ${option.key}`}
                        disabled={formState.question_type === "true_false"}
                      />
                      {formState.question_type === "multiple_choice" && formState.options.length > 2 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(option.key)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formState.question_type === "essay" && (
              <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                <div>
                  <Label htmlFor="acceptable-answers">Acceptable Answers</Label>
                  <Input
                    id="acceptable-answers"
                    className="mt-2"
                    value={formState.acceptable_answers_text}
                    onChange={(event) =>
                      setFormState((previous) => ({
                        ...previous,
                        acceptable_answers_text: event.target.value,
                      }))
                    }
                    placeholder="Comma separated keywords or short answers"
                  />
                </div>
                <div>
                  <Label htmlFor="essay-rubric">Essay Rubric</Label>
                  <Textarea
                    id="essay-rubric"
                    className="mt-2"
                    rows={3}
                    value={formState.essay_rubric}
                    onChange={(event) =>
                      setFormState((previous) => ({
                        ...previous,
                        essay_rubric: event.target.value,
                      }))
                    }
                    placeholder="Describe grading rubric"
                  />
                </div>
                <div>
                  <Label htmlFor="sample-answer">Sample Answer</Label>
                  <Textarea
                    id="sample-answer"
                    className="mt-2"
                    rows={3}
                    value={formState.sample_answer}
                    onChange={(event) =>
                      setFormState((previous) => ({
                        ...previous,
                        sample_answer: event.target.value,
                      }))
                    }
                    placeholder="Provide a sample answer for graders"
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="question-tags">Tags</Label>
              <Input
                id="question-tags"
                className="mt-2"
                value={formState.tags_text}
                onChange={(event) =>
                  setFormState((previous) => ({
                    ...previous,
                    tags_text: event.target.value,
                  }))
                }
                placeholder="e.g., calculus, derivatives"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeQuestionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveQuestion()} disabled={questionMutation.isSubmitting}>
              {questionMutation.isSubmitting
                ? editingQuestion
                  ? "Saving..."
                  : "Creating..."
                : editingQuestion
                  ? "Save Changes"
                  : "Create Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewQuestion)} onOpenChange={(open) => !open && setPreviewQuestion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Question Preview</DialogTitle>
            <DialogDescription>
              Revision {previewQuestion?.current_revision.revision_number ?? 0} •{" "}
              {previewQuestion ? formatDateTime(previewQuestion.updated_at) : ""}
            </DialogDescription>
          </DialogHeader>
          {previewQuestion && (
            <div className="space-y-4 py-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{previewQuestion.subject.name}</Badge>
                <Badge className={difficultyColors[previewQuestion.difficulty]}>
                  {difficultyLabels[previewQuestion.difficulty]}
                </Badge>
                <Badge variant="outline">{questionTypeLabels[previewQuestion.question_type]}</Badge>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Question</p>
                <p className="mt-2 text-gray-900 whitespace-pre-wrap">
                  {previewQuestion.current_revision.question_text}
                </p>
              </div>

              {previewQuestion.question_type !== "essay" && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Options</p>
                  <div className="mt-3 space-y-2">
                    {previewQuestion.current_revision.options.map((option) => (
                      <div
                        key={option.key}
                        className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                      >
                        <span className="text-sm text-gray-900">
                          {option.key}. {option.text}
                        </span>
                        {previewQuestion.current_revision.answer_key.correct_option_keys.includes(option.key) && (
                          <Badge variant="outline">Correct</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewQuestion.question_type === "essay" && (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Acceptable Answers</p>
                    <p className="mt-1 text-sm text-gray-900">
                      {previewQuestion.current_revision.answer_key.acceptable_answers.join(", ") || "None"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Rubric</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
                      {previewQuestion.current_revision.answer_key.essay_rubric || "No rubric"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Sample Answer</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
                      {previewQuestion.current_revision.answer_key.sample_answer || "No sample answer"}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-500">Tags</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {previewQuestion.tags.map((tag) => (
                    <Badge key={tag.id} variant="outline">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
