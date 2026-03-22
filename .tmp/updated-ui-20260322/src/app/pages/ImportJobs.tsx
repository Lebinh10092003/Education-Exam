import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { StatusBadge } from "../components/StatusBadge";
import { Progress } from "../components/ui/progress";
import {
  Search,
  Download,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Trash2,
  RefreshCw,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";

const importJobs = [
  {
    id: 1,
    name: "User Import - March 2024",
    type: "users",
    status: "completed" as const,
    progress: 100,
    total: 250,
    processed: 250,
    success: 245,
    failed: 5,
    createdAt: "2024-03-20 10:30 AM",
    completedAt: "2024-03-20 10:35 AM",
    uploadedBy: "Admin User",
  },
  {
    id: 2,
    name: "Question Import - Physics Q1",
    type: "questions",
    status: "open" as const,
    progress: 65,
    total: 500,
    processed: 325,
    success: 320,
    failed: 5,
    createdAt: "2024-03-21 09:00 AM",
    completedAt: null,
    uploadedBy: "Jane Smith",
  },
  {
    id: 3,
    name: "Group Assignment Batch",
    type: "groups",
    status: "failed" as const,
    progress: 0,
    total: 100,
    processed: 0,
    success: 0,
    failed: 0,
    createdAt: "2024-03-21 08:00 AM",
    completedAt: "2024-03-21 08:01 AM",
    uploadedBy: "Robert Brown",
  },
  {
    id: 4,
    name: "Exam Results Upload",
    type: "results",
    status: "pending" as const,
    progress: 0,
    total: 150,
    processed: 0,
    success: 0,
    failed: 0,
    createdAt: "2024-03-21 11:00 AM",
    completedAt: null,
    uploadedBy: "Admin User",
  },
];

const errorDetails = [
  {
    row: 23,
    field: "email",
    value: "invalid-email",
    error: "Invalid email format",
  },
  {
    row: 45,
    field: "role",
    value: "supervisor",
    error: "Invalid role. Must be: admin, examiner, or candidate",
  },
  {
    row: 67,
    field: "email",
    value: "john@example.com",
    error: "Email already exists in system",
  },
  {
    row: 89,
    field: "name",
    value: "",
    error: "Name is required",
  },
  {
    row: 120,
    field: "groups",
    value: "NonExistentGroup",
    error: "Group does not exist",
  },
];

export function ImportJobs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  return (
    <div>
      <PageHeader
        title="Import Jobs Center"
        description="Manage and monitor all bulk import operations"
        action={
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="w-4 h-4 mr-2" />
                  New Import
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Start New Import Job</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file to import data in bulk
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="users" className="py-4">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="questions">Questions</TabsTrigger>
                    <TabsTrigger value="groups">Groups</TabsTrigger>
                    <TabsTrigger value="results">Results</TabsTrigger>
                  </TabsList>
                  <TabsContent value="users" className="space-y-4">
                    <div>
                      <Label htmlFor="user-file">Upload CSV File</Label>
                      <Input
                        id="user-file"
                        type="file"
                        accept=".csv"
                        className="mt-2"
                      />
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-900 mb-2">
                        Required columns:
                      </p>
                      <p className="text-xs text-blue-800 font-mono">
                        name, email, role
                      </p>
                      <p className="text-sm font-medium text-blue-900 mt-3 mb-2">
                        Optional columns:
                      </p>
                      <p className="text-xs text-blue-800 font-mono">
                        groups, status, password
                      </p>
                    </div>
                  </TabsContent>
                  <TabsContent value="questions" className="space-y-4">
                    <div>
                      <Label htmlFor="question-file">Upload CSV File</Label>
                      <Input
                        id="question-file"
                        type="file"
                        accept=".csv"
                        className="mt-2"
                      />
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-900 mb-2">
                        Required columns:
                      </p>
                      <p className="text-xs text-blue-800 font-mono">
                        question_text, subject, type, correct_answer
                      </p>
                      <p className="text-sm font-medium text-blue-900 mt-3 mb-2">
                        Optional columns:
                      </p>
                      <p className="text-xs text-blue-800 font-mono">
                        difficulty, points, options, explanation
                      </p>
                    </div>
                  </TabsContent>
                  <TabsContent value="groups" className="space-y-4">
                    <div>
                      <Label htmlFor="group-file">Upload CSV File</Label>
                      <Input
                        id="group-file"
                        type="file"
                        accept=".csv"
                        className="mt-2"
                      />
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-900 mb-2">
                        Required columns:
                      </p>
                      <p className="text-xs text-blue-800 font-mono">
                        group_name, member_emails
                      </p>
                      <p className="text-sm font-medium text-blue-900 mt-3 mb-2">
                        Optional columns:
                      </p>
                      <p className="text-xs text-blue-800 font-mono">
                        description, exam_assignments
                      </p>
                    </div>
                  </TabsContent>
                  <TabsContent value="results" className="space-y-4">
                    <div>
                      <Label htmlFor="result-file">Upload CSV File</Label>
                      <Input
                        id="result-file"
                        type="file"
                        accept=".csv"
                        className="mt-2"
                      />
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-900 mb-2">
                        Required columns:
                      </p>
                      <p className="text-xs text-blue-800 font-mono">
                        candidate_email, exam_id, score
                      </p>
                      <p className="text-sm font-medium text-blue-900 mt-3 mb-2">
                        Optional columns:
                      </p>
                      <p className="text-xs text-blue-800 font-mono">
                        time_taken, answers, grader_notes
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button>Upload & Start Import</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card>
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search import jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="users">Users</SelectItem>
                <SelectItem value="questions">Questions</SelectItem>
                <SelectItem value="groups">Groups</SelectItem>
                <SelectItem value="results">Results</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="open">In Progress</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Job Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Progress
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Results
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Created
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {importJobs.map((job) => (
                  <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{job.name}</p>
                        <p className="text-xs text-gray-500">
                          By {job.uploadedBy}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900 capitalize">
                          {job.type}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Progress value={job.progress} className="h-2 flex-1" />
                          <span className="text-xs text-gray-600 w-10">
                            {job.progress}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {job.processed} / {job.total} records
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span className="text-green-700">
                            {job.success} success
                          </span>
                        </div>
                        {job.failed > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <XCircle className="w-3 h-3 text-red-600" />
                            <span className="text-red-700">
                              {job.failed} failed
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">
                        {job.createdAt}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent className="sm:max-w-lg overflow-y-auto">
                            <SheetHeader>
                              <SheetTitle>Import Job Details</SheetTitle>
                              <SheetDescription>{job.name}</SheetDescription>
                            </SheetHeader>
                            <div className="mt-6 space-y-6">
                              {/* Job Summary */}
                              <div>
                                <h3 className="font-medium text-gray-900 mb-3">
                                  Job Summary
                                </h3>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Type:</span>
                                    <span className="font-medium capitalize">
                                      {job.type}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Status:</span>
                                    <StatusBadge status={job.status} />
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">
                                      Uploaded by:
                                    </span>
                                    <span className="font-medium">
                                      {job.uploadedBy}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">
                                      Created:
                                    </span>
                                    <span>{job.createdAt}</span>
                                  </div>
                                  {job.completedAt && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">
                                        Completed:
                                      </span>
                                      <span>{job.completedAt}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Progress */}
                              <div>
                                <h3 className="font-medium text-gray-900 mb-3">
                                  Processing Progress
                                </h3>
                                <div className="space-y-3">
                                  <div>
                                    <div className="flex justify-between text-sm mb-2">
                                      <span className="text-gray-600">
                                        Overall Progress
                                      </span>
                                      <span className="font-medium">
                                        {job.progress}%
                                      </span>
                                    </div>
                                    <Progress value={job.progress} className="h-3" />
                                  </div>
                                  <div className="grid grid-cols-3 gap-3 pt-2">
                                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                                      <p className="text-2xl font-bold text-gray-900">
                                        {job.total}
                                      </p>
                                      <p className="text-xs text-gray-600 mt-1">
                                        Total
                                      </p>
                                    </div>
                                    <div className="text-center p-3 bg-green-50 rounded-lg">
                                      <p className="text-2xl font-bold text-green-700">
                                        {job.success}
                                      </p>
                                      <p className="text-xs text-green-700 mt-1">
                                        Success
                                      </p>
                                    </div>
                                    <div className="text-center p-3 bg-red-50 rounded-lg">
                                      <p className="text-2xl font-bold text-red-700">
                                        {job.failed}
                                      </p>
                                      <p className="text-xs text-red-700 mt-1">
                                        Failed
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Error Details */}
                              {job.failed > 0 && (
                                <div>
                                  <h3 className="font-medium text-gray-900 mb-3">
                                    Error Details ({job.failed} errors)
                                  </h3>
                                  <div className="space-y-2">
                                    {errorDetails.map((error, idx) => (
                                      <div
                                        key={idx}
                                        className="p-3 bg-red-50 border border-red-200 rounded-lg"
                                      >
                                        <div className="flex items-start gap-2">
                                          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-red-900">
                                              Row {error.row}: {error.field}
                                            </p>
                                            <p className="text-xs text-red-700 mt-1">
                                              {error.error}
                                            </p>
                                            <p className="text-xs text-red-600 mt-1 font-mono truncate">
                                              Value: "{error.value}"
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-3 w-full"
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Error Report
                                  </Button>
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex gap-2 pt-4 border-t">
                                {job.status === "failed" && (
                                  <Button size="sm" className="flex-1">
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Retry Import
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Export Results
                                </Button>
                              </div>
                            </div>
                          </SheetContent>
                        </Sheet>
                        {job.status === "failed" && (
                          <Button size="sm" variant="ghost">
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <strong>1-4</strong> of <strong>4</strong> import jobs
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm">
                1
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
