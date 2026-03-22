import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/ui/badge";
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  Pause,
  Play,
  XCircle,
} from "lucide-react";
import { Progress } from "../components/ui/progress";

const candidateStatuses = [
  {
    id: 1,
    name: "John Doe",
    email: "john.doe@example.com",
    status: "in-progress" as const,
    progress: 75,
    questionsAnswered: 23,
    totalQuestions: 30,
    timeElapsed: "1h 15m",
    connectionStatus: "stable",
    lastActivity: "2 min ago",
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "jane.smith@example.com",
    status: "completed" as const,
    progress: 100,
    questionsAnswered: 30,
    totalQuestions: 30,
    timeElapsed: "1h 45m",
    connectionStatus: "stable",
    lastActivity: "Just now",
  },
  {
    id: 3,
    name: "Mike Johnson",
    email: "mike.j@example.com",
    status: "in-progress" as const,
    progress: 45,
    questionsAnswered: 14,
    totalQuestions: 30,
    timeElapsed: "45m",
    connectionStatus: "unstable",
    lastActivity: "15 min ago",
  },
  {
    id: 4,
    name: "Sarah Williams",
    email: "sarah.w@example.com",
    status: "in-progress" as const,
    progress: 90,
    questionsAnswered: 27,
    totalQuestions: 30,
    timeElapsed: "1h 30m",
    connectionStatus: "stable",
    lastActivity: "1 min ago",
  },
];

const alerts = [
  {
    id: 1,
    type: "warning",
    candidate: "Mike Johnson",
    message: "Unstable internet connection detected",
    time: "15 min ago",
  },
  {
    id: 2,
    type: "info",
    candidate: "Jane Smith",
    message: "Exam completed successfully",
    time: "Just now",
  },
  {
    id: 3,
    type: "warning",
    candidate: "Alice Brown",
    message: "Tab switched 3 times",
    time: "20 min ago",
  },
];

export function LiveMonitoring() {
  const totalCandidates = 45;
  const inProgress = 28;
  const completed = 15;
  const notStarted = 2;
  const averageProgress = 65;

  return (
    <div>
      <PageHeader
        title="Live Exam Monitoring"
        description="Mathematics Final Exam - Real-time monitoring"
        action={
          <div className="flex gap-2">
            <Button variant="outline">
              <Pause className="w-4 h-4 mr-2" />
              Pause Exam
            </Button>
            <Button variant="destructive">
              <XCircle className="w-4 h-4 mr-2" />
              End Exam
            </Button>
          </div>
        }
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Candidates</p>
                <p className="text-3xl font-bold text-gray-900">
                  {totalCandidates}
                </p>
              </div>
              <div className="bg-blue-100 text-blue-600 p-4 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">In Progress</p>
                <p className="text-3xl font-bold text-blue-600">{inProgress}</p>
              </div>
              <div className="bg-blue-100 text-blue-600 p-4 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completed</p>
                <p className="text-3xl font-bold text-green-600">{completed}</p>
              </div>
              <div className="bg-green-100 text-green-600 p-4 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Average Progress</p>
                <p className="text-3xl font-bold text-gray-900">
                  {averageProgress}%
                </p>
              </div>
              <div className="bg-purple-100 text-purple-600 p-4 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candidate Status Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Candidate Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Candidate
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Progress
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Time
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Connection
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {candidateStatuses.map((candidate) => (
                    <tr
                      key={candidate.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
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
                        <StatusBadge status={candidate.status} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={candidate.progress}
                              className="w-20"
                            />
                            <span className="text-xs text-gray-600">
                              {candidate.progress}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {candidate.questionsAnswered}/
                            {candidate.totalQuestions} questions
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-900">
                          {candidate.timeElapsed}
                        </p>
                        <p className="text-xs text-gray-500">
                          {candidate.lastActivity}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Wifi
                            className={`w-4 h-4 ${
                              candidate.connectionStatus === "stable"
                                ? "text-green-600"
                                : "text-yellow-600"
                            }`}
                          />
                          <span
                            className={`text-xs ${
                              candidate.connectionStatus === "stable"
                                ? "text-green-600"
                                : "text-yellow-600"
                            }`}
                          >
                            {candidate.connectionStatus}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Live Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.type === "warning"
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 ${
                        alert.type === "warning"
                          ? "bg-yellow-500"
                          : "bg-blue-500"
                      }`}
                    ></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {alert.candidate}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        {alert.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{alert.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
