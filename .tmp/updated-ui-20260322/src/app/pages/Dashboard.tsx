import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { StatusBadge } from "../components/StatusBadge";
import {
  Users,
  FileCheck,
  BookOpen,
  BarChart3,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const examActivityData = [
  { month: "Jan", exams: 24, candidates: 340 },
  { month: "Feb", exams: 32, candidates: 450 },
  { month: "Mar", exams: 28, candidates: 380 },
  { month: "Apr", exams: 45, candidates: 620 },
  { month: "May", exams: 38, candidates: 540 },
  { month: "Jun", exams: 52, candidates: 720 },
];

const recentExams = [
  {
    id: 1,
    name: "Mathematics Final Exam",
    subject: "Mathematics",
    status: "open" as const,
    candidates: 45,
    completed: 23,
    timeLeft: "2h 30m",
  },
  {
    id: 2,
    name: "Physics Mid-term Assessment",
    subject: "Physics",
    status: "scheduled" as const,
    candidates: 38,
    completed: 0,
    timeLeft: "Starts in 1d",
  },
  {
    id: 3,
    name: "Chemistry Practice Test",
    subject: "Chemistry",
    status: "closed" as const,
    candidates: 52,
    completed: 52,
    timeLeft: "Ended",
  },
  {
    id: 4,
    name: "Biology Quiz",
    subject: "Biology",
    status: "draft" as const,
    candidates: 0,
    completed: 0,
    timeLeft: "-",
  },
];

const alerts = [
  {
    id: 1,
    type: "warning",
    message: "5 candidates experiencing connection issues in Mathematics Final",
    time: "5 min ago",
  },
  {
    id: 2,
    type: "info",
    message: "New batch of 25 students added to Physics class",
    time: "1 hour ago",
  },
  {
    id: 3,
    type: "success",
    message: "Chemistry Practice Test completed successfully",
    time: "2 hours ago",
  },
];

export function Dashboard() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's what's happening with your exams today."
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Candidates"
          value="1,247"
          icon={Users}
          trend={{ value: "12% from last month", isPositive: true }}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Active Exams"
          value="8"
          icon={FileCheck}
          trend={{ value: "3 ending today", isPositive: false }}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
        />
        <StatCard
          title="Question Bank"
          value="2,456"
          icon={BookOpen}
          trend={{ value: "156 added this week", isPositive: true }}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
        />
        <StatCard
          title="Completion Rate"
          value="94.2%"
          icon={BarChart3}
          trend={{ value: "2.1% increase", isPositive: true }}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Exam Activity Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Exam Activity Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={examActivityData}>
                <defs>
                  <linearGradient id="colorExams" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient
                    id="colorCandidates"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <Legend />
                <Area
                  type="monotone"
                  dataKey="exams"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorExams)"
                  name="Exams Conducted"
                />
                <Area
                  type="monotone"
                  dataKey="candidates"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorCandidates)"
                  name="Total Candidates"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* System Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-2 h-2 rounded-full mt-2 ${
                        alert.type === "warning"
                          ? "bg-yellow-500"
                          : alert.type === "info"
                          ? "bg-blue-500"
                          : "bg-green-500"
                      }`}
                    ></div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{alert.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Exams */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Recent & Upcoming Exams
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Exam Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Subject
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Candidates
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Progress
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentExams.map((exam) => (
                  <tr key={exam.id} className="border-b border-gray-100">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{exam.name}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">
                        {exam.subject}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={exam.status} />
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-900">
                        {exam.candidates}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${
                                exam.candidates > 0
                                  ? (exam.completed / exam.candidates) * 100
                                  : 0
                              }%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">
                          {exam.completed}/{exam.candidates}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">
                        {exam.timeLeft}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
