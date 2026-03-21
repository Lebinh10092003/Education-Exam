import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { notify } from "../lib/notify";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
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

const steps = [
  { id: 1, name: "Basic Info", description: "Exam details" },
  { id: 2, name: "Questions", description: "Select questions" },
  { id: 3, name: "Assignment", description: "Schedule & assign" },
];

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

interface QuestionRecord {
  id: number;
  difficulty: "easy" | "medium" | "hard";
  question_type: "multiple_choice" | "essay" | "true_false";
  subject: SubjectOption;
  current_revision: {
    question_text: string;
  };
}

interface ExamRecord {
  id: number;
  name: string;
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

  const debouncedQuestionSearch = useDebouncedValue(questionSearchQuery, 300);
  const debouncedGroupSearch = useDebouncedValue(groupSearchQuery, 300);
  const mutation = useMutationState();

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
  };

  const buildRandomRulesPayload = () =>
    (Object.entries(formState.random_rule_counts) as Array<[keyof RandomRuleState, string]>)
      .filter(([, value]) => Number(value) > 0)
      .map(([difficulty, value]) => ({
        difficulty,
        count: Number(value),
      }));

  const validateStep = (step: number) => {
    if (step === 1) {
      if (!formState.name.trim() || !formState.subject_id) {
        notify.error("Exam name and subject are required.");
        return false;
      }
      return true;
    }

    if (step === 2) {
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

    const payload = {
      name: formState.name.trim(),
      subject_id: Number(formState.subject_id),
      description: formState.description.trim(),
      status: formState.status,
      duration_minutes: Number(formState.duration_minutes),
      passing_score: Number(formState.passing_score),
      max_attempts: Number(formState.max_attempts),
      manual_question_ids: formState.manual_question_ids,
      random_rules: buildRandomRulesPayload(),
      group_ids: formState.selected_group_ids,
      opening_at: formState.opening_at || null,
      closing_at: formState.closing_at || null,
      shuffle_questions: formState.shuffle_questions,
      show_results_immediately: formState.show_results_immediately,
      enable_proctoring: formState.enable_proctoring,
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

      notify.success(isEditing ? "Exam updated." : "Exam created.");
      navigate("/exams");
    });
  };

  const subjects = subjectsList.data?.results ?? [];
  const groups = groupsList.data?.results ?? [];
  const questions = questionsList.data?.results ?? [];

  return (
    <div>
      <PageHeader
        title={isEditing ? "Edit Exam" : "Create New Exam"}
        description="Follow the steps to define exam details, question composition, and assignments."
      />

      <div className="mb-8">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {steps.map((step, idx) => (
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
              {idx < steps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-4 ${currentStep > step.id ? "bg-green-600" : "bg-gray-300"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {(subjectsList.error || groupsList.error || questionsList.error || examDetails.error || mutation.error) && (
        <div className="mb-6 max-w-4xl mx-auto rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {subjectsList.error || groupsList.error || questionsList.error || examDetails.error || mutation.error}
        </div>
      )}

      <Card className="max-w-4xl mx-auto">
        <CardContent className="p-8">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Basic Exam Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="examName">Exam Name</Label>
                  <Input
                    id="examName"
                    placeholder="e.g., Mathematics Final Exam"
                    className="mt-2"
                    value={formState.name}
                    onChange={(event) =>
                      setFormState((previous) => ({ ...previous, name: event.target.value }))
                    }
                  />
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
                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the exam"
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
                <h3 className="text-lg font-semibold mb-4">Select Questions</h3>
                <p className="text-sm text-gray-600">
                  Mix manually selected questions with optional random draws by difficulty.
                </p>
              </div>

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
                    </div>
                    <Badge variant="outline">{formState.manual_question_ids.length} selected</Badge>
                  </div>

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
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Schedule & Assignment</h3>
                <p className="text-sm text-gray-600">
                  Define the exam window and assign candidate groups.
                </p>
              </div>

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

              <div>
                <div className="flex items-center justify-between gap-4">
                  <Label>Assign to Groups</Label>
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
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between max-w-4xl mx-auto mt-6">
        <Button variant="outline" onClick={prevStep} disabled={currentStep === 1}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        <div className="text-sm text-gray-600">
          Step {currentStep} of {steps.length}
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
                ? "Save Exam"
                : "Create Exam"}
          </Button>
        )}
      </div>
    </div>
  );
}
