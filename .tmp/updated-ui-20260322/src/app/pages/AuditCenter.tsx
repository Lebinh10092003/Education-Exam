import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Search,
  Shield,
  Download,
  Eye,
  AlertTriangle,
  Activity,
  User,
  FileText,
  Settings,
  LogIn,
  LogOut,
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

const auditLogs = [
  {
    id: 1,
    action: "user.login",
    user: "admin@eduexam.com",
    userName: "Admin User",
    description: "User logged in successfully",
    ipAddress: "192.168.1.100",
    timestamp: "2024-03-22 10:30:15",
    severity: "info" as const,
    category: "authentication",
    details: {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      location: "New York, USA",
      device: "Desktop",
    },
  },
  {
    id: 2,
    action: "exam.created",
    user: "examiner@eduexam.com",
    userName: "Jane Smith",
    description: "Created new exam: Mathematics Final",
    ipAddress: "192.168.1.105",
    timestamp: "2024-03-22 09:15:42",
    severity: "info" as const,
    category: "exam",
    details: {
      examId: "EX-2024-001",
      examName: "Mathematics Final",
      subject: "Mathematics",
    },
  },
  {
    id: 3,
    action: "user.permissions.modified",
    user: "admin@eduexam.com",
    userName: "Admin User",
    description: "Modified user permissions for robert.b@example.com",
    ipAddress: "192.168.1.100",
    timestamp: "2024-03-22 08:45:23",
    severity: "warning" as const,
    category: "security",
    details: {
      targetUser: "robert.b@example.com",
      changedPermissions: ["exams.create", "grading.manual"],
      action: "granted",
    },
  },
  {
    id: 4,
    action: "settings.changed",
    user: "admin@eduexam.com",
    userName: "Admin User",
    description: "System settings updated",
    ipAddress: "192.168.1.100",
    timestamp: "2024-03-22 08:30:11",
    severity: "warning" as const,
    category: "system",
    details: {
      setting: "exam.auto_submit_timeout",
      oldValue: "60",
      newValue: "120",
    },
  },
  {
    id: 5,
    action: "exam.deleted",
    user: "examiner@eduexam.com",
    userName: "Jane Smith",
    description: "Deleted exam: Practice Test Draft",
    ipAddress: "192.168.1.105",
    timestamp: "2024-03-22 07:20:33",
    severity: "warning" as const,
    category: "exam",
    details: {
      examId: "EX-2024-DRAFT-05",
      examName: "Practice Test Draft",
    },
  },
  {
    id: 6,
    action: "login.failed",
    user: "unknown@example.com",
    userName: "Unknown User",
    description: "Failed login attempt - invalid credentials",
    ipAddress: "203.45.12.67",
    timestamp: "2024-03-22 06:15:44",
    severity: "error" as const,
    category: "security",
    details: {
      reason: "Invalid password",
      attempts: 3,
    },
  },
  {
    id: 7,
    action: "data.exported",
    user: "admin@eduexam.com",
    userName: "Admin User",
    description: "Exported user data to CSV",
    ipAddress: "192.168.1.100",
    timestamp: "2024-03-21 16:30:22",
    severity: "info" as const,
    category: "data",
    details: {
      exportType: "users",
      recordCount: 247,
      format: "CSV",
    },
  },
  {
    id: 8,
    action: "backup.created",
    user: "system",
    userName: "System",
    description: "Automatic database backup completed",
    ipAddress: "127.0.0.1",
    timestamp: "2024-03-21 02:00:00",
    severity: "info" as const,
    category: "system",
    details: {
      backupSize: "2.4 GB",
      duration: "45 seconds",
    },
  },
];

const categoryIcons: Record<string, any> = {
  authentication: LogIn,
  exam: FileText,
  security: Shield,
  system: Settings,
  data: Download,
};

export function AuditCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const stats = {
    totalLogs: auditLogs.length,
    criticalEvents: auditLogs.filter((l) => l.severity === "error").length,
    warningEvents: auditLogs.filter((l) => l.severity === "warning").length,
    todayLogs: auditLogs.filter((l) =>
      l.timestamp.startsWith("2024-03-22")
    ).length,
  };

  return (
    <div>
      <PageHeader
        title="Audit & Security Center"
        description="Monitor system activity and security events"
        action={
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Logs
            </Button>
            <Button variant="outline">
              <Activity className="w-4 h-4 mr-2" />
              Live Activity
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.totalLogs}</p>
            <p className="text-sm text-gray-600 mt-1">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              {stats.criticalEvents}
            </p>
            <p className="text-sm text-gray-600 mt-1">Requiring attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">
              {stats.warningEvents}
            </p>
            <p className="text-sm text-gray-600 mt-1">Monitor closely</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-600" />
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.todayLogs}</p>
            <p className="text-sm text-gray-600 mt-1">Events logged</p>
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
                placeholder="Search audit logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="authentication">Authentication</SelectItem>
                <SelectItem value="exam">Exam</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="data">Data</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Audit Logs Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Timestamp
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Category
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    User
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Action
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Severity
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    IP Address
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => {
                  const CategoryIcon = categoryIcons[log.category] || Activity;
                  return (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-900">
                          {log.timestamp}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <CategoryIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900 capitalize">
                            {log.category}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {log.userName}
                          </p>
                          <p className="text-xs text-gray-500">{log.user}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-900">{log.description}</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                          {log.action}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={
                            log.severity === "error"
                              ? "border-red-300 text-red-700"
                              : log.severity === "warning"
                              ? "border-orange-300 text-orange-700"
                              : "border-blue-300 text-blue-700"
                          }
                        >
                          {log.severity}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-mono text-gray-600">
                          {log.ipAddress}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent className="sm:max-w-lg overflow-y-auto">
                            <SheetHeader>
                              <SheetTitle>Audit Log Details</SheetTitle>
                              <SheetDescription>
                                Event ID: {log.id}
                              </SheetDescription>
                            </SheetHeader>
                            <div className="mt-6 space-y-6">
                              {/* Summary */}
                              <div>
                                <h3 className="font-medium text-gray-900 mb-3">
                                  Event Summary
                                </h3>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">
                                      Timestamp:
                                    </span>
                                    <span className="font-medium">
                                      {log.timestamp}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">
                                      Category:
                                    </span>
                                    <span className="font-medium capitalize">
                                      {log.category}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Action:</span>
                                    <span className="font-mono text-xs">
                                      {log.action}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">
                                      Severity:
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={
                                        log.severity === "error"
                                          ? "border-red-300 text-red-700"
                                          : log.severity === "warning"
                                          ? "border-orange-300 text-orange-700"
                                          : "border-blue-300 text-blue-700"
                                      }
                                    >
                                      {log.severity}
                                    </Badge>
                                  </div>
                                </div>
                              </div>

                              {/* User Info */}
                              <div>
                                <h3 className="font-medium text-gray-900 mb-3">
                                  User Information
                                </h3>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Name:</span>
                                    <span className="font-medium">
                                      {log.userName}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Email:</span>
                                    <span className="font-medium">{log.user}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">
                                      IP Address:
                                    </span>
                                    <span className="font-mono">
                                      {log.ipAddress}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Details */}
                              <div>
                                <h3 className="font-medium text-gray-900 mb-3">
                                  Event Details
                                </h3>
                                <div className="p-4 bg-gray-50 rounded-lg">
                                  <pre className="text-xs font-mono text-gray-900 whitespace-pre-wrap">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-2 pt-4 border-t">
                                <Button variant="outline" className="flex-1">
                                  <Download className="w-4 h-4 mr-2" />
                                  Export Event
                                </Button>
                              </div>
                            </div>
                          </SheetContent>
                        </Sheet>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <strong>1-8</strong> of <strong>847</strong> events
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
