import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { StatusBadge } from "../components/StatusBadge";
import { Label } from "../components/ui/label";
import {
  Search,
  CheckCircle,
  Clock,
  FileCheck,
  MessageSquare,
  Save,
  Send,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";

const gradingQueue = [
  {
    id: 1,
    candidateName: "Alice Johnson",
    candidateEmail: "alice.j@example.com",
    examName: "Advanced Mathematics Final",
    subject: "Mathematics",
    submittedAt: "2024-03-21 10:30 AM",
    status: "pending" as const,
    questionsToGrade: 5,
    totalQuestions: 50,
    autoScore: 75,
    maxScore: 100,
    priority: "high",
  },
  {
    id: 2,
    candidateName: "Bob Smith",
    candidateEmail: "bob.s@example.com",
    examName: "Physics Essay Test",
    subject: "Physics",
    submittedAt: "2024-03-21 09:15 AM",
    status: "pending" as const,
    questionsToGrade: 3,
    totalQuestions: 30,
    autoScore: 60,
    maxScore: 100,
    priority: "medium",
  },
  {
    id: 3,
    candidateName: "Charlie Brown",
    candidateEmail: "charlie.b@example.com",
    examName: "Chemistry Lab Report",
    subject: "Chemistry",
    submittedAt: "2024-03-21 11:00 AM",
    status: "open" as const,
    questionsToGrade: 2,
    totalQuestions: 20,
    autoScore: 45,
    maxScore: 100,
    priority: "low",
    grader: "You",
  },
  {
    id: 4,
    candidateName: "Diana Prince",
    candidateEmail: "diana.p@example.com",
    examName: "Advanced Mathematics Final",
    subject: "Mathematics",
    submittedAt: "2024-03-20 04:30 PM",
    status: "completed" as const,
    questionsToGrade: 0,
    totalQuestions: 50,
    autoScore: 82,
    maxScore: 100,
    priority: "high",
    finalScore: 89,
    grader: "John Doe",
  },
];

const essayQuestions = [
  {
    id: 1,
    questionNumber: 15,
    questionText:
      "Explain the concept of limits in calculus and provide a real-world application.",
    maxPoints: 10,
    candidateAnswer:
      "A limit in calculus represents the value that a function approaches as the input approaches some value. Limits are essential for defining derivatives and integrals. A real-world application would be calculating instantaneous velocity - as we make the time interval smaller and smaller, we approach the exact velocity at a specific moment in time.",
    rubric: [
      "Definition of limits (3 points)",
      "Connection to derivatives/integrals (3 points)",
      "Real-world application (4 points)",
    ],
    awardedPoints: null,
    feedback: "",
    status: "pending" as const,
  },
  {
    id: 2,
    questionNumber: 28,
    questionText:
      "Describe the fundamental theorem of calculus and its significance.",
    maxPoints: 10,
    candidateAnswer:
      "The fundamental theorem links differentiation and integration. It states that integration and differentiation are inverse operations.",
    rubric: [
      "Part 1: Integration as accumulation (3 points)",
      "Part 2: Derivative of integral (3 points)",
      "Significance and applications (4 points)",
    ],
    awardedPoints: null,
    feedback: "",
    status: "pending" as const,
  },
];

export function ManualGrading() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [points, setPoints] = useState<{ [key: number]: string }>({});
  const [feedback, setFeedback] = useState<{ [key: number]: string }>({});

  return (
    <div>
      <PageHeader
        title="Manual Grading Queue"
        description="Review and grade essay questions and subjective answers"
        action={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Pending Items</p>
              <p className="text-2xl font-bold text-orange-600">8</p>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">8</p>
            <p className="text-sm text-gray-600 mt-1">Awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600" />
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">3</p>
            <p className="text-sm text-gray-600 mt-1">Being graded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">15</p>
            <p className="text-sm text-gray-600 mt-1">Graded and finalized</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by candidate name or exam..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="open">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                <SelectItem value="mathematics">Mathematics</SelectItem>
                <SelectItem value="physics">Physics</SelectItem>
                <SelectItem value="chemistry">Chemistry</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Candidate
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Exam
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Subject
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    To Grade
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Auto Score
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Submitted
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {gradingQueue.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {item.candidateName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.candidateEmail}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-900">{item.examName}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">
                        {item.subject}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={item.status} />
                        {item.priority && (
                          <Badge
                            variant="outline"
                            className={
                              item.priority === "high"
                                ? "border-red-300 text-red-700"
                                : item.priority === "medium"
                                ? "border-orange-300 text-orange-700"
                                : "border-gray-300 text-gray-700"
                            }
                          >
                            {item.priority}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-gray-900">
                        {item.questionsToGrade} / {item.totalQuestions}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-900">
                        {item.finalScore || item.autoScore} / {item.maxScore}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">
                        {item.submittedAt}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button size="sm" variant="default">
                            <FileCheck className="w-4 h-4 mr-2" />
                            Grade
                          </Button>
                        </SheetTrigger>
                        <SheetContent
                          side="right"
                          className="sm:max-w-3xl w-full overflow-y-auto"
                        >
                          <SheetHeader>
                            <SheetTitle>Grading: {item.examName}</SheetTitle>
                            <SheetDescription>
                              {item.candidateName} ({item.candidateEmail})
                            </SheetDescription>
                          </SheetHeader>

                          <div className="mt-6 space-y-6">
                            {/* Summary */}
                            <Card>
                              <CardContent className="p-4">
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-xs text-gray-600">
                                      Auto-graded
                                    </p>
                                    <p className="text-lg font-bold text-gray-900">
                                      {item.autoScore} pts
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-600">
                                      To grade
                                    </p>
                                    <p className="text-lg font-bold text-orange-600">
                                      {item.questionsToGrade} questions
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-600">
                                      Max score
                                    </p>
                                    <p className="text-lg font-bold text-gray-900">
                                      {item.maxScore} pts
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Questions Navigation */}
                            <Tabs
                              defaultValue="0"
                              value={currentQuestion.toString()}
                              onValueChange={(v) => setCurrentQuestion(Number(v))}
                            >
                              <TabsList className="w-full justify-start overflow-x-auto">
                                {essayQuestions.map((q, idx) => (
                                  <TabsTrigger key={idx} value={idx.toString()}>
                                    Q{q.questionNumber}
                                  </TabsTrigger>
                                ))}
                              </TabsList>

                              {essayQuestions.map((question, idx) => (
                                <TabsContent
                                  key={idx}
                                  value={idx.toString()}
                                  className="space-y-6"
                                >
                                  {/* Question */}
                                  <div>
                                    <div className="flex items-start justify-between mb-2">
                                      <h3 className="font-medium text-gray-900">
                                        Question {question.questionNumber}
                                      </h3>
                                      <Badge variant="outline">
                                        Max: {question.maxPoints} pts
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-700">
                                      {question.questionText}
                                    </p>
                                  </div>

                                  {/* Rubric */}
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                                      Grading Rubric
                                    </h4>
                                    <ul className="space-y-1">
                                      {question.rubric.map((item, i) => (
                                        <li
                                          key={i}
                                          className="text-sm text-gray-600 flex items-start gap-2"
                                        >
                                          <span className="text-blue-600 mt-1">
                                            •
                                          </span>
                                          {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* Candidate Answer */}
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                                      Candidate's Answer
                                    </h4>
                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                      <p className="text-sm text-gray-900 whitespace-pre-wrap">
                                        {question.candidateAnswer}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Grading */}
                                  <div className="space-y-4">
                                    <div>
                                      <Label htmlFor={`points-${idx}`}>
                                        Points Awarded (Max: {question.maxPoints})
                                      </Label>
                                      <Input
                                        id={`points-${idx}`}
                                        type="number"
                                        min="0"
                                        max={question.maxPoints}
                                        value={points[idx] || ""}
                                        onChange={(e) =>
                                          setPoints({
                                            ...points,
                                            [idx]: e.target.value,
                                          })
                                        }
                                        placeholder="Enter points"
                                        className="mt-2"
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor={`feedback-${idx}`}>
                                        Feedback for Candidate
                                      </Label>
                                      <Textarea
                                        id={`feedback-${idx}`}
                                        value={feedback[idx] || ""}
                                        onChange={(e) =>
                                          setFeedback({
                                            ...feedback,
                                            [idx]: e.target.value,
                                          })
                                        }
                                        placeholder="Provide constructive feedback..."
                                        rows={4}
                                        className="mt-2"
                                      />
                                    </div>
                                  </div>

                                  {/* Navigation */}
                                  <div className="flex gap-2">
                                    {idx > 0 && (
                                      <Button
                                        variant="outline"
                                        onClick={() =>
                                          setCurrentQuestion(idx - 1)
                                        }
                                      >
                                        Previous
                                      </Button>
                                    )}
                                    {idx < essayQuestions.length - 1 && (
                                      <Button
                                        onClick={() =>
                                          setCurrentQuestion(idx + 1)
                                        }
                                      >
                                        Next Question
                                      </Button>
                                    )}
                                  </div>
                                </TabsContent>
                              ))}
                            </Tabs>

                            {/* Actions */}
                            <div className="flex gap-2 pt-4 border-t">
                              <Button variant="outline" className="flex-1">
                                <Save className="w-4 h-4 mr-2" />
                                Save Draft
                              </Button>
                              <Button className="flex-1">
                                <Send className="w-4 h-4 mr-2" />
                                Submit Grade
                              </Button>
                            </div>
                          </div>
                        </SheetContent>
                      </Sheet>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <strong>1-4</strong> of <strong>26</strong> submissions
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm">
                1
              </Button>
              <Button variant="outline" size="sm">
                2
              </Button>
              <Button variant="outline" size="sm">
                3
              </Button>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
