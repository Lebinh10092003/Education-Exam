import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { StatusBadge } from "../components/StatusBadge";
import { Progress } from "../components/ui/progress";
import {
  FileCheck,
  Clock,
  Award,
  BookOpen,
  Calendar,
  Play,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Badge } from "../components/ui/badge";

const upcomingExams = [
  {
    id: 1,
    name: "Mathematics Final Exam",
    subject: "Mathematics",
    startTime: "2024-03-25 10:00 AM",
    duration: "2 hours",
    status: "scheduled" as const,
    room: "Main Hall A",
    daysUntil: 3,
  },
  {
    id: 2,
    name: "Physics Mid-term Assessment",
    subject: "Physics",
    startTime: "2024-03-28 02:00 PM",
    duration: "1.5 hours",
    status: "scheduled" as const,
    room: "Computer Lab 1",
    daysUntil: 6,
  },
];

const recentResults = [
  {
    id: 1,
    examName: "Chemistry Quiz",
    subject: "Chemistry",
    score: 85,
    maxScore: 100,
    percentage: 85,
    completedAt: "2024-03-20",
    grade: "A",
  },
  {
    id: 2,
    examName: "Biology Practice Test",
    subject: "Biology",
    score: 72,
    maxScore: 100,
    percentage: 72,
    completedAt: "2024-03-18",
    grade: "B",
  },
  {
    id: 3,
    examName: "English Literature Essay",
    subject: "English",
    score: 92,
    maxScore: 100,
    percentage: 92,
    completedAt: "2024-03-15",
    grade: "A+",
  },
];

const availablePractice = [
  {
    id: 1,
    name: "Mathematics Practice Set 1",
    subject: "Mathematics",
    questions: 50,
    duration: "60 minutes",
    difficulty: "Medium",
  },
  {
    id: 2,
    name: "Physics Sample Problems",
    subject: "Physics",
    questions: 30,
    duration: "45 minutes",
    difficulty: "Hard",
  },
];

export function CandidateDashboard() {
  const stats = {
    upcomingExams: upcomingExams.length,
    completedExams: 15,
    averageScore: 82.5,
    totalStudyHours: 45,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <div>
                <h1 className="font-bold text-xl text-gray-900">EduExam</h1>
                <p className="text-xs text-gray-600">Student Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/candidate/materials">
                <Button variant="ghost" size="sm">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Materials
                </Button>
              </Link>
              <Link to="/candidate/results">
                <Button variant="ghost" size="sm">
                  <Award className="w-4 h-4 mr-2" />
                  Results
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="sm">
                  Logout
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, Alice!
          </h1>
          <p className="text-gray-600 mt-1">
            Here's an overview of your examination progress
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4 text-blue-600" />
                Upcoming Exams
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {stats.upcomingExams}
              </p>
              <p className="text-xs text-gray-600 mt-1">Next in 3 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
                <FileCheck className="w-4 h-4 text-green-600" />
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {stats.completedExams}
              </p>
              <p className="text-xs text-gray-600 mt-1">This semester</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                Average Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {stats.averageScore}%
              </p>
              <p className="text-xs text-green-600 mt-1">↑ 5% from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4 text-orange-600" />
                Study Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {stats.totalStudyHours}h
              </p>
              <p className="text-xs text-gray-600 mt-1">This month</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Upcoming Exams */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Upcoming Exams
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingExams.map((exam) => (
                <div
                  key={exam.id}
                  className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{exam.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{exam.subject}</p>
                    </div>
                    <Badge className="bg-blue-600">
                      In {exam.daysUntil} days
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>{exam.startTime}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>{exam.duration}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-300 flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      Room: {exam.room}
                    </span>
                    <Button size="sm" variant="outline">
                      View Details
                    </Button>
                  </div>
                </div>
              ))}

              {upcomingExams.length === 0 && (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No upcoming exams scheduled</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-green-600" />
                Practice Tests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {availablePractice.map((practice) => (
                <div
                  key={practice.id}
                  className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <h4 className="font-medium text-gray-900 text-sm">
                    {practice.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                    <span>{practice.questions} questions</span>
                    <span>•</span>
                    <span>{practice.duration}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="mt-2 text-xs"
                  >
                    {practice.difficulty}
                  </Badge>
                </div>
              ))}
              <Link to="/candidate/practice">
                <Button className="w-full mt-2">
                  <Play className="w-4 h-4 mr-2" />
                  Browse All Practice Tests
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-600" />
              Recent Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Exam
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Subject
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Score
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Performance
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Grade
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentResults.map((result) => (
                    <tr key={result.id} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">
                          {result.examName}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">
                          {result.subject}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium text-gray-900">
                          {result.score} / {result.maxScore}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <Progress value={result.percentage} className="h-2" />
                          <span className="text-xs text-gray-600">
                            {result.percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={
                            result.percentage >= 90
                              ? "bg-green-100 text-green-800"
                              : result.percentage >= 70
                              ? "bg-blue-100 text-blue-800"
                              : "bg-orange-100 text-orange-800"
                          }
                        >
                          {result.grade}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">
                          {result.completedAt}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
