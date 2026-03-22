import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/ui/badge";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Clock,
  FileCheck,
  Eye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const examPeriods = [
  {
    id: 1,
    name: "Spring Semester Finals 2024",
    description: "Final examinations for Spring semester",
    startDate: "2024-05-01",
    endDate: "2024-05-15",
    status: "upcoming" as const,
    examsCount: 12,
    candidatesCount: 450,
  },
  {
    id: 2,
    name: "Mid-term Assessments - March",
    description: "Monthly mid-term assessment period",
    startDate: "2024-03-15",
    endDate: "2024-03-25",
    status: "open" as const,
    examsCount: 8,
    candidatesCount: 380,
  },
  {
    id: 3,
    name: "Winter Break Practice Tests",
    description: "Optional practice examination period",
    startDate: "2024-02-01",
    endDate: "2024-02-14",
    status: "closed" as const,
    examsCount: 15,
    candidatesCount: 280,
  },
  {
    id: 4,
    name: "Certificate Program - Q1",
    description: "Quarterly certification exams",
    startDate: "2024-03-20",
    endDate: "2024-03-31",
    status: "open" as const,
    examsCount: 5,
    candidatesCount: 120,
  },
];

export function ExamPeriods() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  return (
    <div>
      <PageHeader
        title="Exam Periods"
        description="Manage examination periods and schedules"
        action={
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Period
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Exam Period</DialogTitle>
                <DialogDescription>
                  Define a new examination period
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="period-name">Period Name</Label>
                  <Input
                    id="period-name"
                    placeholder="e.g., Spring Finals 2024"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="period-description">Description</Label>
                  <Input
                    id="period-description"
                    placeholder="Brief description of this period"
                    className="mt-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      className="mt-2"
                    />
                  </div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900">
                    All exams scheduled within this date range will be grouped under
                    this period for easy management and reporting.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Create Period</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search exam periods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="open">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Periods Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {examPeriods.map((period) => (
              <Card key={period.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {period.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {period.description}
                      </p>
                    </div>
                    <StatusBadge status={period.status} />
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>
                        {period.startDate} to {period.endDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <FileCheck className="w-4 h-4 text-blue-600" />
                        <span className="text-gray-900 font-medium">
                          {period.examsCount}
                        </span>
                        <span className="text-gray-600">exams</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-green-600" />
                        <span className="text-gray-900 font-medium">
                          {period.candidatesCount}
                        </span>
                        <span className="text-gray-600">candidates</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Eye className="w-4 h-4 mr-2" />
                      View Exams
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-gray-600">
              Showing <strong>1-4</strong> of <strong>4</strong> exam periods
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