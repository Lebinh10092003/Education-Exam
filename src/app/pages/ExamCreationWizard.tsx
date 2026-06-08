import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, ChevronLeft, ChevronRight, Search, Upload } from "lucide-react";
import { notify } from "../lib/notify";

import { ImportTemplateActions } from "../components/imports/ImportTemplateActions";
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
import { examStudentImportTemplate, questionImportTemplate } from "../lib/importTemplates";
import { validateQuestionImportFile } from "../lib/questionImportValidation";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";

const examSteps = [
  { id: 1, name: "Basic Info", description: "Exam details" },
  { id: 2, name: "Questions", description: "Select questions" },
  { id: 3, name: "Assignment", description: "Schedule & assign" },
];

const classSteps = [
  { id: 1, name: "Basic Info", description: "Class details" },
  { id: 2, name: "Learning Access", description: "How practice is unlocked" },
  { id: 3, name: "Enrollment", description: "Assign learner groups" },
] as const;

interface SubjectOption {
  id: number;
  name: string;
  code: string;
  color: string;
}

interface GroupOption {
  id: number;
  name: string;
  member_count: number;
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

interface QuestionRecord {
  id: number;
  difficulty: "easy" | "medium" | "hard";
  question_type: "multiple_choice" | "essay" | "true_false";
  subject: SubjectOption;
  current_revision: {
    question_text: string;
  };
}

interface QuestionImportBatchResult {
  id: number;
  source_format: "csv" | "json" | "xlsx";
  file_name: string;
  status: string;
  total_records: number;
  success_count: number;
  error_count: number;
  created_question_ids: number[];
  errors: Array<{
    id: number;
    row_number: number;
    message: string;
    field_name?: string;
    raw_payload?: unknown;
  }>;
  created_at: string;
}

interface ExamRecord {
  id: number;
  name: string;
  mode: "exam" | "class";
  subject: SubjectOption;
  description: string;
  status: "draft" | "scheduled" | "open" | "paused" | "closed" | "archived";
  duration_minutes: number;
  passing_score: number;
  max_attempts: number;
  shuffle_questions: boolean;
  show_results_immediately: boolean;
  enable_proctoring: boolean;
  current_version: {
    items: Array<{
      source: "manual" | "random";
      question: {
        question_id: number;
        difficulty: "easy" | "medium" | "hard";
      };
    }>;
    random_rules: Array<{
      difficulty: "" | "easy" | "medium" | "hard";
      count: number;
    }>;
  } | null;
  schedule_window: {
    opens_at: string | null;
    closes_at: string | null;
  } | null;
  assignment_summary: {
    assigned_group_ids: number[];
  };
}

interface RandomRuleState {
  easy: string;
  medium: string;
  hard: string;
}

interface ExamFormState {
  name: string;
  mode: "exam" | "class";
  subject_id: string;
  description: string;
  status: ExamRecord["status"];
  duration_minutes: string;
  passing_score: string;
  max_attempts: string;
  manual_question_ids: number[];
  random_rule_counts: RandomRuleState;
  selected_group_ids: number[];
  opening_at: string;
  closing_at: string;
  shuffle_questions: boolean;
  show_results_immediately: boolean;
  enable_proctoring: boolean;
}

const buildDefaultFormState = (): ExamFormState => ({
  name: "",
  mode: "exam",
  subject_id: "",
  description: "",
  status: "draft",
  duration_minutes: "60",
  passing_score: "60",
  max_attempts: "1",
  manual_question_ids: [],
  random_rule_counts: {
    easy: "",
    medium: "",
    hard: "",
  },
  selected_group_ids: [],
  opening_at: "",
  closing_at: "",
  shuffle_questions: false,
  show_results_immediately: false,
  enable_proctoring: true,
});

const toLocalDateTimeValue = (value: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toFormState = (exam: ExamRecord): ExamFormState => {
  const manualQuestionIds =
    exam.current_version?.items
      .filter((item) => item.source === "manual")
      .map((item) => item.question.question_id) ?? [];

  const randomRuleCounts = { easy: "", medium: "", hard: "" };
  exam.current_version?.random_rules.forEach((rule) => {
    if (rule.difficulty && rule.difficulty in randomRuleCounts) {
      const currentValue = Number(randomRuleCounts[rule.difficulty as keyof RandomRuleState] || "0");
      randomRuleCounts[rule.difficulty as keyof RandomRuleState] = String(currentValue + rule.count);
    }
  });

  return {
    name: exam.name,
    mode: exam.mode,
    subject_id: String(exam.subject.id),
    description: exam.description,
    status: exam.status,
    duration_minutes: String(exam.duration_minutes),
    passing_score: String(exam.passing_score),
    max_attempts: String(exam.max_attempts),
    manual_question_ids: manualQuestionIds,
    random_rule_counts: randomRuleCounts,
    selected_group_ids: exam.assignment_summary.assigned_group_ids,
    opening_at: toLocalDateTimeValue(exam.schedule_window?.opens_at ?? null),
    closing_at: toLocalDateTimeValue(exam.schedule_window?.closes_at ?? null),
    shuffle_questions: exam.shuffle_questions,
    show_results_immediately: exam.show_results_immediately,
    enable_proctoring: exam.enable_proctoring,
  };
};

const questionTypeLabels = {
  multiple_choice: "Multiple Choice",
  essay: "Essay",
  true_false: "True / False",
} as const;

export function ExamCreationWizard() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [currentStep, setCurrentStep] = useState(1);
  const [questionSearchQuery, setQuestionSearchQuery] = useState("");
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [formState, setFormState] = useState<ExamFormState>(buildDefaultFormState);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFormat, setImportFormat] = useState<"csv" | "json" | "xlsx">("csv");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<QuestionImportBatchResult | null>(null);
  const [studentImportFile, setStudentImportFile] = useState<File | null>(null);
  const [studentImportSummary, setStudentImportSummary] = useState<StudentImportSummary | null>(null);

  const debouncedQuestionSearch = useDebouncedValue(questionSearchQuery, 300);
  const debouncedGroupSearch = useDebouncedValue(groupSearchQuery, 300);
  const mutation = useMutationState();
  const importMutation = useMutationState();
  const studentImportMutation = useMutationState();

  const subjectsList = useAsyncList(
    async () => apiRequest<PaginatedResponse<SubjectOption>>("/api/v1/subjects/"),
    [],
  );

  const groupsList = useAsyncList(
    async () =>
      apiRequest<PaginatedResponse<GroupOption>>("/api/v1/groups/", {
        query: {
          search: debouncedGroupSearch || undefined,
        },
      }),
    [debouncedGroupSearch],
  );

  const questionsList = useAsyncList(
    async () => {
      if (!formState.subject_id) {
        return { count: 0, next: null, previous: null, results: [] as QuestionRecord[] };
      }

      return apiRequest<PaginatedResponse<QuestionRecord>>("/api/v1/questions/", {
        query: {
          subject: formState.subject_id,
          search: debouncedQuestionSearch || undefined,
        },
      });
    },
    [formState.subject_id, debouncedQuestionSearch],
  );

  const examDetails = useAsyncList(
    async () => {
      if (!id) {
        return null as ExamRecord | null;
      }
      return apiRequest<ExamRecord>(`/api/v1/exams/${id}/`);
    },
    [id],
  );

  useEffect(() => {
    if (examDetails.data) {
      setFormState(toFormState(examDetails.data));
    }
  }, [examDetails.data]);

  const updateRandomRuleCount = (difficulty: keyof RandomRuleState, value: string) => {
    setFormState((previous) => ({
      ...previous,
      random_rule_counts: {
        ...previous.random_rule_counts,
        [difficulty]: value,
      },
    }));
  };

  const toggleManualQuestion = (questionId: number) => {
    setFormState((previous) => ({
      ...previous,
      manual_question_ids: previous.manual_question_ids.includes(questionId)
        ? previous.manual_question_ids.filter((id) => id !== questionId)
        : [...previous.manual_question_ids, questionId],
    }));
  };

  const toggleGroup = (groupId: number) => {
    setFormState((previous) => ({
      ...previous,
      selected_group_ids: previous.selected_group_ids.includes(groupId)
        ? previous.selected_group_ids.filter((id) => id !== groupId)
        : [...previous.selected_group_ids, groupId],
    }));
  };

  const handleSubjectChange = (subjectId: string) => {
    setFormState((previous) => ({
      ...previous,
      subject_id: subjectId,
      manual_question_ids: previous.subject_id === subjectId ? previous.manual_question_ids : [],
      random_rule_counts:
        previous.subject_id === subjectId
          ? previous.random_rule_counts
          : { easy: "", medium: "", hard: "" },
    }));
    setImportResult(null);
  };

  const buildRandomRulesPayload = () =>
    (Object.entries(formState.random_rule_counts) as Array<[keyof RandomRuleState, string]>)
      .filter(([, value]) => Number(value) > 0)
      .map(([difficulty, value]) => ({
        difficulty,
        count: Number(value),
      }));

  const currentSteps = formState.mode === "class" ? classSteps : examSteps;

  const validateStep = (step: number) => {
    if (step === 1) {
      if (!formState.name.trim() || !formState.subject_id) {
        notify.error("Exam name and subject are required.");
        return false;
      }
      return true;
    }

    if (step === 2) {
      if (formState.mode === "class") {
        return true;
      }
      if (
        formState.manual_question_ids.length === 0 &&
        buildRandomRulesPayload().length === 0
      ) {
        notify.error("Select at least one manual question or one random rule.");
        return false;
      }
      return true;
    }

    return true;
  };

  const nextStep = () => {
    if (currentStep < 3 && validateStep(currentStep)) {
      setCurrentStep((previous) => previous + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((previous) => previous - 1);
    }
  };

  const handleFinish = async () => {
    if (!validateStep(3)) {
      return;
    }

    const isClass = formState.mode === "class";
    const randomRules = isClass ? [] : buildRandomRulesPayload();
    const manualQuestionIds = isClass ? [] : formState.manual_question_ids;

    const payload = {
      name: formState.name.trim(),
      mode: formState.mode,
      subject_id: Number(formState.subject_id),
      description: formState.description.trim(),
      status: formState.status,
      duration_minutes: Number(formState.duration_minutes),
      passing_score: Number(formState.passing_score),
      max_attempts: Number(formState.max_attempts),
      manual_question_ids: manualQuestionIds,
      random_rules: randomRules,
      group_ids: formState.selected_group_ids,
      opening_at: isClass ? null : formState.opening_at || null,
      closing_at: isClass ? null : formState.closing_at || null,
      shuffle_questions: isClass ? false : formState.shuffle_questions,
      show_results_immediately: isClass ? false : formState.show_results_immediately,
      enable_proctoring: isClass ? false : formState.enable_proctoring,
    };

    await mutation.run(async () => {
      if (isEditing && id) {
        await apiRequest(`/api/v1/exams/${id}/`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await apiRequest("/api/v1/exams/", {
          method: "POST",
          body: payload,
        });
      }

      notify.success(
        isEditing
          ? formState.mode === "class"
            ? "Class updated."
            : "Exam updated."
          : formState.mode === "class"
            ? "Class created."
            : "Exam created.",
      );
      navigate("/exams");
    });
  };

  const subjects = subjectsList.data?.results ?? [];
  const groups = groupsList.data?.results ?? [];
  const questions = questionsList.data?.results ?? [];
  const currentSubject =
    subjects.find((subject) => String(subject.id) === formState.subject_id) ??
    examDetails.data?.subject ??
    null;

  const closeImportDialog = (nextOpen: boolean) => {
    setIsImportDialogOpen(nextOpen);
    if (!nextOpen) {
      setImportFile(null);
      importMutation.setError(null);
    }
  };

  const handleImportQuestions = async () => {
    if (!currentSubject) {
      notify.error("Choose a subject before importing questions.");
      return;
    }

    if (!importFile) {
      notify.error("Choose a file to import.");
      return;
    }

    const validation = await validateQuestionImportFile({
      file: importFile,
      sourceFormat: importFormat,
      expectedSubjectCode: currentSubject.code,
    });

    if (!validation.ok) {
      notify.error(validation.error ?? `All imported rows must use subject_code ${currentSubject.code}.`);
      return;
    }

    const formData = new FormData();
    formData.set("source_format", importFormat);
    formData.set("file", importFile);

    await importMutation.run(async () => {
      const batch = await apiRequest<QuestionImportBatchResult>("/api/v1/question-imports/", {
        method: "POST",
        body: formData,
      });
      setImportResult(batch);
      setFormState((previous) => ({
        ...previous,
        manual_question_ids: Array.from(
          new Set([...previous.manual_question_ids, ...batch.created_question_ids]),
        ),
      }));
      await questionsList.reload();
      closeImportDialog(false);

      if (batch.error_count > 0) {
        notify.warning(
          `Imported ${batch.success_count} questions. ${batch.error_count} rows need attention.`,
        );
        return;
      }

      notify.success(`Imported ${batch.success_count} questions and added them to this exam.`);
    });
  };

  const handleImportStudents = async () => {
    if (!id) {
      notify.error("Save the class first, then import students from the enrollment step.");
      return;
    }

    if (!studentImportFile) {
      notify.error("Choose a CSV file to import.");
      return;
    }

    const formData = new FormData();
    formData.set("file", studentImportFile);

    await studentImportMutation.run(async () => {
      const summary = await apiRequest<StudentImportSummary>(`/api/v1/exams/${id}/student-import/`, {
        method: "POST",
        body: formData,
      });
      setStudentImportSummary(summary);
      if (summary.failed_rows > 0) {
        notify.info(`Imported with ${summary.failed_rows} row error(s).`);
      } else {
        notify.success("Students imported successfully.");
      }
    });
  };

  return (
    <div>
      <PageHeader
        title={
          isEditing
            ? formState.mode === "class"
              ? "Edit Class"
              : "Edit Exam"
            : "Create Exam / Class"
        }
        description={
          formState.mode === "class"
            ? "Define the subject container and learner enrollment used to unlock materials and practice."
            : "Follow the steps to define exam details, question composition, and assignments."
        }
      />

      <div className="mb-8">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {currentSteps.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                    currentStep > step.id
                      ? "bg-green-600 border-green-600"
                      : currentStep === step.id
                        ? "bg-blue-600 border-blue-600"
                        : "bg-white border-gray-300"
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-6 h-6 text-white" />
                  ) : (
                    <span
                      className={`text-lg font-semibold ${
                        currentStep === step.id ? "text-white" : "text-gray-400"
                      }`}
                    >
                      {step.id}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className={`text-sm font-medium ${currentStep >= step.id ? "text-gray-900" : "text-gray-500"}`}>
                    {step.name}
                  </p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
              </div>
              {idx < currentSteps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-4 ${currentStep > step.id ? "bg-green-600" : "bg-gray-300"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {(subjectsList.error ||
        groupsList.error ||
        questionsList.error ||
        examDetails.error ||
        mutation.error ||
        importMutation.error ||
        studentImportMutation.error) && (
        <div className="mb-6 max-w-4xl mx-auto rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {subjectsList.error ||
            groupsList.error ||
            questionsList.error ||
            examDetails.error ||
            mutation.error ||
            importMutation.error ||
            studentImportMutation.error}
        </div>
      )}

      <Card className="max-w-4xl mx-auto">
        <CardContent className="p-8">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  {formState.mode === "class" ? "Basic Class Information" : "Basic Exam Information"}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="examName">{formState.mode === "class" ? "Class Name" : "Exam Name"}</Label>
                  <Input
                    id="examName"
                    placeholder={
                      formState.mode === "class"
                        ? "e.g., IMO Learning Class"
                        : "e.g., Mathematics Final Exam"
                    }
                    className="mt-2"
                    value={formState.name}
                    onChange={(event) =>
                      setFormState((previous) => ({ ...previous, name: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Mode</Label>
                  <Select
                    value={formState.mode}
                    onValueChange={(value: ExamFormState["mode"]) =>
                      setFormState((previous) => ({ ...previous, mode: value }))
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exam">Exam</SelectItem>
                      <SelectItem value="class">Class</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Select value={formState.subject_id} onValueChange={handleSubjectChange}>
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
                  <Label>Status</Label>
                  <Select
                    value={formState.status}
                    onValueChange={(value: ExamFormState["status"]) =>
                      setFormState((previous) => ({ ...previous, status: value }))
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formState.mode === "exam" ? (
                  <>
                    <div>
                      <Label htmlFor="duration">Duration (minutes)</Label>
                      <Input
                        id="duration"
                        type="number"
                        placeholder="120"
                        className="mt-2"
                        value={formState.duration_minutes}
                        onChange={(event) =>
                          setFormState((previous) => ({
                            ...previous,
                            duration_minutes: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="passingScore">Passing Score (%)</Label>
                      <Input
                        id="passingScore"
                        type="number"
                        placeholder="60"
                        className="mt-2"
                        value={formState.passing_score}
                        onChange={(event) =>
                          setFormState((previous) => ({
                            ...previous,
                            passing_score: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxAttempts">Max Attempts</Label>
                      <Input
                        id="maxAttempts"
                        type="number"
                        placeholder="1"
                        className="mt-2"
                        value={formState.max_attempts}
                        onChange={(event) =>
                          setFormState((previous) => ({
                            ...previous,
                            max_attempts: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    Class mode unlocks subject materials and random practice for assigned learners.
                    It does not create a fixed deliverable exam paper.
                  </div>
                )}
                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder={
                      formState.mode === "class"
                        ? "Brief description of the learning class"
                        : "Brief description of the exam"
                    }
                    className="mt-2"
                    rows={3}
                    value={formState.description}
                    onChange={(event) =>
                      setFormState((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          )}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  {formState.mode === "class" ? "Learning Access" : "Select Questions"}
                </h3>
                <p className="text-sm text-gray-600">
                  {formState.mode === "class"
                    ? "Class records do not ship a fixed exam paper. Assigned learners will receive random subject practice from the backend question bank."
                    : "Mix manually selected questions with optional random draws by difficulty."}
                </p>
              </div>

              {formState.mode === "class" ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    Each practice attempt will request up to 30 random objective questions from the
                    selected subject. If the question bank has fewer than 30 eligible questions, the
                    backend will use the maximum available set.
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    Question difficulty distribution is randomized by the backend from the current
                    subject bank. No question composition needs to be configured for class mode here.
                  </div>
                  <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-600">
                    Continue to the next step to enroll learner groups into this subject class.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="mb-4">
                    <h4 className="font-medium text-blue-900">Random Selection</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Backend random rules will pick questions from the selected subject.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm">Easy Questions</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        className="mt-1"
                        value={formState.random_rule_counts.easy}
                        onChange={(event) => updateRandomRuleCount("easy", event.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Medium Questions</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        className="mt-1"
                        value={formState.random_rule_counts.medium}
                        onChange={(event) => updateRandomRuleCount("medium", event.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Hard Questions</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        className="mt-1"
                        value={formState.random_rule_counts.hard}
                        onChange={(event) => updateRandomRuleCount("hard", event.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h4 className="font-medium">Manual Selection</h4>
                      <p className="text-sm text-gray-500">
                        Search the current subject and explicitly include questions in this exam version.
                      </p>
                      {currentSubject && (
                        <p className="mt-1 text-xs text-blue-700">
                          Current subject: {currentSubject.name} ({currentSubject.code})
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsImportDialogOpen(true)}
                        disabled={!currentSubject}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Import Questions
                      </Button>
                      <Badge variant="outline">{formState.manual_question_ids.length} selected</Badge>
                    </div>
                  </div>

                  {importResult && (
                    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                      <p>
                        Imported <strong>{importResult.success_count}</strong> of{" "}
                        <strong>{importResult.total_records}</strong> rows from{" "}
                        <strong>{importResult.file_name}</strong>.
                      </p>
                      <p className="mt-1">
                        Auto-selected <strong>{importResult.created_question_ids.length}</strong> newly
                        imported questions for this exam.
                      </p>
                      {importResult.error_count > 0 && (
                        <div className="mt-3 space-y-1 text-blue-950">
                          <p>
                            <strong>{importResult.error_count}</strong> rows failed:
                          </p>
                          {importResult.errors.map((error) => (
                            <p key={error.id ?? `${error.row_number}-${error.message}`}>
                              Row {error.row_number}: {error.message}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder={formState.subject_id ? "Search questions..." : "Choose a subject first"}
                      className="pl-10"
                      disabled={!formState.subject_id}
                      value={questionSearchQuery}
                      onChange={(event) => setQuestionSearchQuery(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {!formState.subject_id ? (
                      <div className="py-10 text-center text-sm text-gray-500">
                        Select a subject in step 1 to load questions.
                      </div>
                    ) : questionsList.isLoading ? (
                      <div className="py-10 text-center text-sm text-gray-500">Loading questions...</div>
                    ) : questions.length === 0 ? (
                      <div className="py-10 text-center text-sm text-gray-500">
                        No questions found for the selected subject.
                      </div>
                    ) : (
                      questions.map((question) => (
                        <label
                          key={question.id}
                          className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer border"
                        >
                          <Checkbox
                            checked={formState.manual_question_ids.includes(question.id)}
                            onCheckedChange={() => toggleManualQuestion(question.id)}
                            className="mt-0.5"
                          />
                          <div>
                            <p className="text-sm text-gray-900">
                              {question.current_revision.question_text}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {question.difficulty} • {questionTypeLabels[question.question_type]}
                            </p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  {formState.mode === "class" ? "Enrollment" : "Schedule & Assignment"}
                </h3>
                <p className="text-sm text-gray-600">
                  {formState.mode === "class"
                    ? "Assign learner groups that should receive subject materials and practice access."
                    : "Define the exam window and assign candidate groups."}
                </p>
              </div>

              {formState.mode === "exam" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="openingDate">Opening Date & Time</Label>
                    <Input
                      id="openingDate"
                      type="datetime-local"
                      className="mt-2"
                      value={formState.opening_at}
                      onChange={(event) =>
                        setFormState((previous) => ({
                          ...previous,
                          opening_at: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="closingDate">Closing Date & Time</Label>
                    <Input
                      id="closingDate"
                      type="datetime-local"
                      className="mt-2"
                      value={formState.closing_at}
                      onChange={(event) =>
                        setFormState((previous) => ({
                          ...previous,
                          closing_at: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  Class mode does not require a fixed schedule window or proctoring setup.
                  Access is controlled by enrollment and the class status.
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-4">
                  <Label>{formState.mode === "class" ? "Enroll Groups" : "Assign to Groups"}</Label>
                  <div className="relative w-full max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={groupSearchQuery}
                      onChange={(event) => setGroupSearchQuery(event.target.value)}
                      className="pl-10"
                      placeholder="Search groups..."
                    />
                  </div>
                </div>
                <div className="mt-2 space-y-2 border rounded-lg p-4 max-h-72 overflow-y-auto">
                  {groupsList.isLoading ? (
                    <div className="py-10 text-center text-sm text-gray-500">Loading groups...</div>
                  ) : groups.length === 0 ? (
                    <div className="py-10 text-center text-sm text-gray-500">No groups found.</div>
                  ) : (
                    groups.map((group) => (
                      <label
                        key={group.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                      >
                        <Checkbox
                          checked={formState.selected_group_ids.includes(group.id)}
                          onCheckedChange={() => toggleGroup(group.id)}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{group.name}</p>
                          <p className="text-xs text-gray-500">{group.member_count} members</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-5">
                <div>
                  <h4 className="font-medium text-blue-900">
                    {formState.mode === "class"
                      ? "Import Students Directly To This Class"
                      : "Import Candidates Directly To This Exam"}
                  </h4>
                  <p className="mt-1 text-sm text-blue-800">
                    {formState.mode === "class"
                      ? "Upload a CSV to create or update student accounts by CCCD, then enroll them straight into this class."
                      : "Upload a CSV to create or update candidate accounts by CCCD, then assign them straight to this exam."}
                  </p>
                </div>

                {id ? (
                  <>
                    <div className="rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm text-blue-900">
                      New passwords default to the generated username. If email is blank, the
                      backend will generate `username@student.local`.
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="class-student-import-file">
                        {formState.mode === "class" ? "Student CSV File" : "Candidate CSV File"}
                      </Label>
                      <Input
                        id="class-student-import-file"
                        type="file"
                        accept=".csv"
                        onChange={(event) => {
                          setStudentImportFile(event.target.files?.[0] ?? null);
                          setStudentImportSummary(null);
                        }}
                      />
                      {studentImportFile ? (
                        <p className="text-xs text-blue-800">
                          Selected file: <strong>{studentImportFile.name}</strong>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Open the CSV template</p>
                        <p className="text-xs text-gray-500">
                          Preview the required columns and download a starter file before importing.
                        </p>
                      </div>
                      <ImportTemplateActions template={examStudentImportTemplate} selectedFormat="csv" />
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={() => void handleImportStudents()} disabled={studentImportMutation.isSubmitting}>
                        <Upload className="mr-2 h-4 w-4" />
                        {studentImportMutation.isSubmitting
                          ? "Importing..."
                          : formState.mode === "class"
                            ? "Import Students"
                            : "Import Candidates"}
                      </Button>
                    </div>

                    {studentImportSummary ? (
                      <div className="space-y-4 rounded-xl border border-blue-200 bg-white p-4">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Created</p>
                            <p className="mt-1 text-2xl font-semibold text-gray-900">{studentImportSummary.created_users}</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Updated</p>
                            <p className="mt-1 text-2xl font-semibold text-gray-900">{studentImportSummary.updated_users}</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Assigned</p>
                            <p className="mt-1 text-2xl font-semibold text-gray-900">{studentImportSummary.assigned_users}</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Failed</p>
                            <p className="mt-1 text-2xl font-semibold text-gray-900">{studentImportSummary.failed_rows}</p>
                          </div>
                        </div>

                        <div className="text-sm text-gray-600">
                          Processed <strong>{studentImportSummary.total_rows}</strong> row(s) with{" "}
                          <strong>{studentImportSummary.skipped_rows}</strong> skipped.
                        </div>

                        {studentImportSummary.errors.length > 0 ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                            <p className="text-sm font-medium text-amber-900">Rows that still need attention</p>
                            <div className="mt-3 space-y-2">
                              {studentImportSummary.errors.map((error) => (
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
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-blue-300 bg-white px-4 py-4 text-sm text-blue-900">
                    {formState.mode === "class"
                      ? "Save the class first, then reopen the enrollment step to import students directly by CSV."
                      : "Save the exam first, then reopen the assignment step to import candidates directly by CSV."}
                  </div>
                )}
              </div>

              {formState.mode === "exam" ? (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <h4 className="font-medium mb-3">Additional Settings</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={formState.shuffle_questions}
                        onCheckedChange={(checked) =>
                          setFormState((previous) => ({
                            ...previous,
                            shuffle_questions: checked === true,
                          }))
                        }
                      />
                      <div>
                        <p className="text-sm font-medium">Shuffle Questions</p>
                        <p className="text-xs text-gray-500">
                          Randomize question order for each candidate
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={formState.show_results_immediately}
                        onCheckedChange={(checked) =>
                          setFormState((previous) => ({
                            ...previous,
                            show_results_immediately: checked === true,
                          }))
                        }
                      />
                      <div>
                        <p className="text-sm font-medium">Show Results Immediately</p>
                        <p className="text-xs text-gray-500">
                          Display results right after submission when allowed
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={formState.enable_proctoring}
                        onCheckedChange={(checked) =>
                          setFormState((previous) => ({
                            ...previous,
                            enable_proctoring: checked === true,
                          }))
                        }
                      />
                      <div>
                        <p className="text-sm font-medium">Enable Proctoring</p>
                        <p className="text-xs text-gray-500">
                          Send this exam through the monitoring pipeline
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isImportDialogOpen} onOpenChange={closeImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Questions</DialogTitle>
            <DialogDescription>
              Upload a CSV or JSON file for the current exam subject and auto-select the
              successfully created questions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              {currentSubject ? (
                <>
                  Current exam subject: <strong>{currentSubject.name}</strong> (
                  <strong>{currentSubject.code}</strong>). All imported rows must use this
                  `subject_code`.
                </>
              ) : (
                "Choose a subject in step 1 before importing questions."
              )}
            </div>
            <div>
              <Label>File Format</Label>
              <Select
                value={importFormat}
                onValueChange={(value: "csv" | "json" | "xlsx") => setImportFormat(value)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="xlsx">Excel XLSX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Upload File</Label>
              <Input
                type="file"
                className="mt-2"
                accept={
                  importFormat === "csv"
                    ? ".csv,text/csv"
                    : importFormat === "json"
                      ? ".json,application/json"
                      : ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
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
                selectedFormat={importFormat === "xlsx" ? "csv" : importFormat}
              />
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Required import fields include `subject_code`, `difficulty`, `question_type`, and
              `question_text`.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => closeImportDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleImportQuestions()}
              disabled={importMutation.isSubmitting || !currentSubject}
            >
              {importMutation.isSubmitting ? "Importing..." : "Import Questions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between max-w-4xl mx-auto mt-6">
        <Button variant="outline" onClick={prevStep} disabled={currentStep === 1}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        <div className="text-sm text-gray-600">
          Step {currentStep} of {currentSteps.length}
        </div>
        {currentStep < 3 ? (
          <Button onClick={nextStep}>
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={() => void handleFinish()} disabled={mutation.isSubmitting}>
            <Check className="w-4 h-4 mr-2" />
            {mutation.isSubmitting
              ? isEditing
                ? "Saving..."
                : "Creating..."
              : isEditing
                ? formState.mode === "class"
                  ? "Save Class"
                  : "Save Exam"
                : formState.mode === "class"
                  ? "Create Class"
                  : "Create Exam"}
          </Button>
        )}
      </div>
    </div>
  );
}
