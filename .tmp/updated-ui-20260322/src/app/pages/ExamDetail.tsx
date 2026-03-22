import { Link, useParams } from "react-router";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/ui/badge";
import {
  Calendar,
  Clock,
  Users,
  FileText,
  Settings,
  Play,
  Edit,
  Copy,
  Trash2,
  Download,
  Eye,
  CheckCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";

const examData = {
  id: 1,
  name: "Mathematics Final Exam",
  description: "Comprehensive final examination covering all topics from the semester",
  subject: "Mathematics",
  status: "open" as const,
  startTime: "2024-03-25 10:00 AM",
  endTime: "2024-03-25 12:00 PM",
  duration: "2 hours",
  totalQuestions: 50,
  totalPoints: 100,
  passingScore: 60,
  createdBy: "Jane Smith",
  createdAt: "2024-03-20",
  room: "Main Hall A",
  instructions: "Please read all questions carefully. No calculators allowed. Show all work.",
};

const assignedCandidates = [
  {
    id: 1,
    name: "Alice Johnson",
    email: "alice.j@example.com",
    group: "Group A",
    status: "completed" as const,
    score: 85,
    completedAt: "2024-03-25 11:45 AM",
  },
  {
    id: 2,
    name: "Bob Smith",
    email: "bob.s@example.com",
    group: "Group A",
    status: "open" as const,
    score: null,
    completedAt: null,
  },
  {
    id: 3,
    name: "Charlie Brown",
    email: "charlie.b@example.com",
    group: "Group B",
    status: "pending" as const,
    score: null,
    completedAt: null,
  },
];

const questions = [
  {
    id: 1,
    questionNumber: 1,
    type: "multiple_choice",
    points: 2,
    difficulty: "easy",
    text: "What is the derivative of x²?",
  },
  {
    id: 2,
    questionNumber: 2,
    type: "essay",
    points: 10,
    difficulty: "hard",
    text: "Explain the concept of limits in calculus.",
  },
  {
    id: 3,
    questionNumber: 3,
    type: "true_false",
    points: 1,
    difficulty: "easy",
    text: "The integral of a constant is zero.",
  },
];

const activityLog = [
  {
    id: 1,
    action: "Exam created",
    user: "Jane Smith",
    timestamp: "2024-03-20 09:00 AM",
  },
  {
    id: 2,
    action: "45 candidates assigned",
    user: "Jane Smith",
    timestamp: "2024-03-20 09:15 AM",
  },
  {
    id: 3,
    action: "Exam published",
    user: "Jane Smith",
    timestamp: "2024-03-25 09:55 AM",
  },
  {
    id: 4,
    action: "Alice Johnson submitted exam",
    user: "System",
    timestamp: "2024-03-25 11:45 AM",
  },
];

export function ExamDetail() {
  const { id } = useParams();

  const stats = {
    assigned: assignedCandidates.length,
    completed: assignedCandidates.filter((c) => c.status === "completed").length,
    inProgress: assignedCandidates.filter((c) => c.status === "open").length,
    notStarted: assignedCandidates.filter((c) => c.status === "pending").length,
  };

  return (
    <div>
      <PageHeader
        title={examData.name}
        description={examData.description}
        action={
          <div className="flex gap-2">
            <Link to={`/exams/${id}/assign`}>
              <Button variant="outline">
                <Users className="w-4 h-4 mr-2" />
                Assign Candidates
              </Button>
            </Link>
            <Link to={`/exams/${id}/monitor`}>
              <Button variant="outline">
                <Play className="w-4 h-4 mr-2" />
                Live Monitor
              </Button>
            </Link>
            <Button variant="outline">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Assigned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.assigned}</p>
            <p className="text-sm text-gray-600 mt-1">Total candidates</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.completed}</p>
            <p className="text-sm text-gray-600 mt-1">Submissions received</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="w-4 h-4 text-orange-600" />
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.inProgress}</p>
            <p className="text-sm text-gray-600 mt-1">Currently taking</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-600" />
              Not Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.notStarted}</p>
            <p className="text-sm text-gray-600 mt-1">Yet to begin</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Exam Details */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <Tabs defaultValue="details" className="space-y-6">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="candidates">Candidates</TabsTrigger>
                <TabsTrigger value="questions">Questions</TabsTrigger>
                <TabsTrigger value="activity">Activity Log</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-4">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Subject</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {examData.subject}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Status</p>
                      <div className="mt-1">
                        <StatusBadge status={examData.status} />
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-600">Start Time</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {examData.startTime}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">End Time</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {examData.endTime}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Duration</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {examData.duration}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Room</p>
                      <p className="font-medium text-gray-900 mt-1">{examData.room}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-4">Scoring</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Total Questions</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {examData.totalQuestions}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Points</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {examData.totalPoints}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Passing Score</p>
                      <p className="font-medium text-gray-900 mt-1">
                        {examData.passingScore}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Instructions</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {examData.instructions}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="candidates">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                          Name
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                          Group
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                          Score
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                          Completed At
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedCandidates.map((candidate) => (
                        <tr key={candidate.id} className="border-b border-gray-100">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">
                                {candidate.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {candidate.email}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-600">
                              {candidate.group}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge status={candidate.status} />
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-medium text-gray-900">
                              {candidate.score !== null
                                ? `${candidate.score} / ${examData.totalPoints}`
                                : "-"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-600">
                              {candidate.completedAt || "-"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="questions">
                <div className="space-y-3">
                  {questions.map((question) => (
                    <div
                      key={question.id}
                      className="p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">
                            Q{question.questionNumber}
                          </span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {question.type.replace("_", " ")}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              question.difficulty === "hard"
                                ? "border-red-300 text-red-700"
                                : question.difficulty === "medium"
                                ? "border-orange-300 text-orange-700"
                                : "border-green-300 text-green-700"
                            }`}
                          >
                            {question.difficulty}
                          </Badge>
                        </div>
                        <span className="text-sm text-gray-600">
                          {question.points} pts
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{question.text}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="activity">
                <div className="space-y-3">
                  {activityLog.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg"
                    >
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{log.action}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {log.user} • {log.timestamp}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Sidebar Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start">
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Copy className="w-4 h-4 mr-2" />
              Duplicate Exam
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <FileText className="w-4 h-4 mr-2" />
              Print Summary
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Exam
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
