import { Link } from "react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Clock,
  FileCheck,
  TrendingUp,
  Users,
} from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { clampPercentage } from "../components/ui/utils";
import { apiRequest } from "../lib/http";
import { useAsyncList } from "../hooks/useAsyncList";

interface DashboardActivityPoint {
  month: string;
  exams: number;
  candidates: number;
}

interface DashboardRecentExam {
  id: number;
  name: string;
  subject: string;
  status: string;
  candidates: number;
  completed: number;
  time_left: string;
}

interface DashboardAlert {
  id: number;
  type: string;
  message: string;
  time: string;
  exam_id: number | null;
}

interface DashboardOverview {
  total_candidates: number;
  active_exams: number;
  question_bank_count: number;
  completion_rate: string;
  activity: DashboardActivityPoint[];
  recent_exams: DashboardRecentExam[];
  alerts: DashboardAlert[];
}

export function Dashboard() {
  const dashboard = useAsyncList(
    () => apiRequest<DashboardOverview>("/api/v1/dashboard/overview/"),
    [],
  );

  const data = dashboard.data;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live operational summary pulled from the Django API."
      />

      {dashboard.error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {dashboard.error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Candidates"
          value={data?.total_candidates ?? "..."}
          icon={Users}
          trend={{
            value: `${data?.alerts.length ?? 0} monitoring alerts`,
            isPositive: (data?.alerts.length ?? 0) === 0,
          }}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Active Exams"
          value={data?.active_exams ?? "..."}
          icon={FileCheck}
          trend={{
            value: `${data?.recent_exams.length ?? 0} recent exams loaded`,
            isPositive: true,
          }}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
        />
        <StatCard
          title="Question Bank"
          value={data?.question_bank_count ?? "..."}
          icon={BookOpen}
          trend={{
            value: "Synced with backend",
            isPositive: true,
          }}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
        />
        <StatCard
          title="Completion Rate"
          value={data ? `${Number(data.completion_rate).toFixed(1)}%` : "..."}
          icon={BarChart3}
          trend={{
            value: `${data?.activity.at(-1)?.candidates ?? 0} candidates this month`,
            isPositive: true,
          }}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Exam Activity Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data?.activity ?? []}>
                <defs>
                  <linearGradient id="dashboardExams" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashboardCandidates" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="exams"
                  stroke="#2563eb"
                  fill="url(#dashboardExams)"
                  name="Exams"
                />
                <Area
                  type="monotone"
                  dataKey="candidates"
                  stroke="#059669"
                  fill="url(#dashboardCandidates)"
                  name="Candidates"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.alerts.length ? (
                data.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`mt-2 h-2 w-2 rounded-full ${
                          alert.type === "critical" ? "bg-red-500" : "bg-yellow-500"
                        }`}
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{alert.message}</p>
                        <p className="mt-1 text-xs text-gray-500">{alert.time}</p>
                        {alert.exam_id ? (
                          <Link
                            className="mt-2 inline-block text-xs font-medium text-blue-600 hover:text-blue-700"
                            to={`/exams/${alert.exam_id}?tab=monitoring`}
                          >
                            Open monitoring
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No monitoring alerts right now.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Recent & Upcoming Exams
          </CardTitle>
          <Button asChild variant="outline">
            <Link to="/exams">Open Exam Management</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Exam Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Subject</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Candidates</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Progress</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                </tr>
              </thead>
              <tbody>
                {data?.recent_exams.map((exam) => (
                  (() => {
                    const completionPercentage =
                      exam.candidates > 0
                        ? clampPercentage((exam.completed / exam.candidates) * 100)
                        : 0;

                    return (
                      <tr key={exam.id} className="border-b border-gray-100">
                        <td className="px-4 py-3">
                          <Link className="font-medium text-gray-900 hover:text-blue-600" to={`/exams/${exam.id}/edit`}>
                            {exam.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{exam.subject}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={exam.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{exam.candidates}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 max-w-[120px] flex-1 overflow-hidden rounded-full bg-gray-200">
                              <div
                                className="h-2 rounded-full bg-blue-600"
                                style={{
                                  width: `${completionPercentage}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              {exam.completed}/{exam.candidates}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{exam.time_left}</td>
                      </tr>
                    );
                  })()
                ))}
                {!dashboard.isLoading && !data?.recent_exams.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={6}>
                      No exams available yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
