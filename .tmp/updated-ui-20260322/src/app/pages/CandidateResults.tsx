import { useState } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import {
  Search,
  Award,
  TrendingUp,
  Calendar,
  Download,
  Eye,
  ChevronLeft,
  FileText,
  CheckCircle,
  XCircle,
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, LineChart, Legend } from "recharts";

const results = [
  {
    id: 1,
    examName: "Mathematics Final Exam",
    subject: "Mathematics",
    score: 85,
    maxScore: 100,
    percentage: 85,
    completedAt: "2024-03-20 11:45 AM",
    duration: "1h 45m",
    grade: "A",
    totalQuestions: 50,
    correctAnswers: 42,
    wrongAnswers: 6,
    unanswered: 2,
    rank: 12,
    totalCandidates: 120,
  },
  {
    id: 2,
    examName: "Physics Mid-term",
    subject: "Physics",
    score: 72,
    maxScore: 100,
    percentage: 72,
    completedAt: "2024-03-18 03:30 PM",
    duration: "1h 20m",
    grade: "B",
    totalQuestions: 40,
    correctAnswers: 29,
    wrongAnswers: 9,
    unanswered: 2,
    rank: 25,
    totalCandidates: 85,
  },
  {
    id: 3,
    examName: "Chemistry Quiz",
    subject: "Chemistry",
    score: 92,
    maxScore: 100,
    percentage: 92,
    completedAt: "2024-03-15 10:15 AM",
    duration: "45m",
    grade: "A+",
    totalQuestions: 30,
    correctAnswers: 28,
    wrongAnswers: 2,
    unanswered: 0,
    rank: 3,
    totalCandidates: 95,
  },
];

const performanceTrend = [
  { month: "Jan", score: 75 },
  { month: "Feb", score: 78 },
  { month: "Mar", score: 83 },
];

const subjectPerformance = [
  { subject: "Math", score: 85 },
  { subject: "Physics", score: 72 },
  { subject: "Chemistry", score: 92 },
  { subject: "Biology", score: 80 },
];

export function CandidateResults() {
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const stats = {
    totalExams: results.length,
    averageScore: results.reduce((sum, r) => sum + r.percentage, 0) / results.length,
    highestScore: Math.max(...results.map((r) => r.percentage)),
    improvementRate: 8.5,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/candidate/dashboard">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <div>
                <h1 className="font-bold text-xl text-gray-900">EduExam</h1>
                <p className="text-xs text-gray-600">Student Portal</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Results</h1>
          <p className="text-gray-600 mt-1">
            View your examination results and performance analytics
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
                <FileText className="w-4 h-4 text-blue-600" />
                Total Exams
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{stats.totalExams}</p>
              <p className="text-xs text-gray-600 mt-1">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
                <Award className="w-4 h-4 text-purple-600" />
                Average Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {stats.averageScore.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">Overall performance</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
                <TrendingUp className="w-4 h-4 text-green-600" />
                Highest Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{stats.highestScore}%</p>
              <p className="text-xs text-gray-600 mt-1">Best result</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
                <TrendingUp className="w-4 h-4 text-orange-600" />
                Improvement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">+{stats.improvementRate}%</p>
              <p className="text-xs text-green-600 mt-1">↑ Since last month</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Performance Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={performanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Average Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-600" />
                Subject Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={subjectPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="subject" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="score" fill="#8b5cf6" name="Score" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Exam Results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search exams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  <SelectItem value="mathematics">Mathematics</SelectItem>
                  <SelectItem value="physics">Physics</SelectItem>
                  <SelectItem value="chemistry">Chemistry</SelectItem>
                  <SelectItem value="biology">Biology</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Exam
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
                      Rank
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
                  {results.map((result) => (
                    <tr key={result.id} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {result.examName}
                          </p>
                          <p className="text-xs text-gray-500">{result.subject}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium text-gray-900">
                          {result.score} / {result.maxScore}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <Progress value={result.percentage} className="h-2 w-24" />
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
                        <span className="text-sm text-gray-900">
                          {result.rank} / {result.totalCandidates}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">
                          {result.completedAt.split(" ")[0]}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Sheet>
                            <SheetTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                            </SheetTrigger>
                            <SheetContent className="sm:max-w-lg overflow-y-auto">
                              <SheetHeader>
                                <SheetTitle>Result Details</SheetTitle>
                                <SheetDescription>{result.examName}</SheetDescription>
                              </SheetHeader>
                              <div className="mt-6 space-y-6">
                                {/* Score Summary */}
                                <div>
                                  <h3 className="font-medium text-gray-900 mb-3">
                                    Score Summary
                                  </h3>
                                  <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                                    <div className="text-center">
                                      <p className="text-5xl font-bold text-gray-900">
                                        {result.percentage}%
                                      </p>
                                      <p className="text-lg text-gray-700 mt-2">
                                        {result.score} / {result.maxScore} points
                                      </p>
                                      <Badge
                                        className={`mt-3 ${
                                          result.percentage >= 90
                                            ? "bg-green-600"
                                            : result.percentage >= 70
                                            ? "bg-blue-600"
                                            : "bg-orange-600"
                                        }`}
                                      >
                                        Grade: {result.grade}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>

                                {/* Statistics */}
                                <div>
                                  <h3 className="font-medium text-gray-900 mb-3">
                                    Statistics
                                  </h3>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center p-3 bg-green-50 rounded-lg">
                                      <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                                      <p className="text-2xl font-bold text-green-700">
                                        {result.correctAnswers}
                                      </p>
                                      <p className="text-xs text-green-700 mt-1">
                                        Correct
                                      </p>
                                    </div>
                                    <div className="text-center p-3 bg-red-50 rounded-lg">
                                      <XCircle className="w-6 h-6 text-red-600 mx-auto mb-1" />
                                      <p className="text-2xl font-bold text-red-700">
                                        {result.wrongAnswers}
                                      </p>
                                      <p className="text-xs text-red-700 mt-1">Wrong</p>
                                    </div>
                                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                                      <FileText className="w-6 h-6 text-gray-600 mx-auto mb-1" />
                                      <p className="text-2xl font-bold text-gray-700">
                                        {result.unanswered}
                                      </p>
                                      <p className="text-xs text-gray-700 mt-1">
                                        Unanswered
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Details */}
                                <div>
                                  <h3 className="font-medium text-gray-900 mb-3">
                                    Exam Details
                                  </h3>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">
                                        Completed at:
                                      </span>
                                      <span className="font-medium">
                                        {result.completedAt}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Duration:</span>
                                      <span className="font-medium">
                                        {result.duration}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Your rank:</span>
                                      <span className="font-medium">
                                        {result.rank} of {result.totalCandidates}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-4 border-t">
                                  <Button variant="outline" className="flex-1">
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Certificate
                                  </Button>
                                </div>
                              </div>
                            </SheetContent>
                          </Sheet>
                        </div>
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
