import { Link } from "react-router";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { StatusBadge } from "../components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Search,
  Plus,
  Copy,
  Eye,
  Edit,
  Users,
  Play,
  Pause,
  Archive,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { useState } from "react";

const exams = [
  {
    id: 1,
    name: "Mathematics Final Exam",
    subject: "Mathematics",
    status: "open" as const,
    openingTime: "2024-03-21 09:00",
    closingTime: "2024-03-21 18:00",
    duration: 120,
    assignedGroups: ["CS Year 1", "Math Advanced"],
    totalCandidates: 45,
    completed: 23,
    created: "2024-03-15",
  },
  {
    id: 2,
    name: "Physics Mid-term Assessment",
    subject: "Physics",
    status: "scheduled" as const,
    openingTime: "2024-03-22 10:00",
    closingTime: "2024-03-22 16:00",
    duration: 90,
    assignedGroups: ["Physics Dept"],
    totalCandidates: 38,
    completed: 0,
    created: "2024-03-16",
  },
  {
    id: 3,
    name: "Chemistry Practice Test",
    subject: "Chemistry",
    status: "closed" as const,
    openingTime: "2024-03-20 09:00",
    closingTime: "2024-03-20 15:00",
    duration: 60,
    assignedGroups: ["Chem Batch 2024"],
    totalCandidates: 52,
    completed: 52,
    created: "2024-03-14",
  },
  {
    id: 4,
    name: "Biology Quiz",
    subject: "Biology",
    status: "draft" as const,
    openingTime: "-",
    closingTime: "-",
    duration: 45,
    assignedGroups: [],
    totalCandidates: 0,
    completed: 0,
    created: "2024-03-19",
  },
  {
    id: 5,
    name: "Computer Science Test",
    subject: "Computer Science",
    status: "paused" as const,
    openingTime: "2024-03-21 11:00",
    closingTime: "2024-03-21 17:00",
    duration: 100,
    assignedGroups: ["CS Year 1"],
    totalCandidates: 30,
    completed: 12,
    created: "2024-03-17",
  },
];

export function ExamManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  return (
    <div>
      <PageHeader
        title="Exam Management"
        description="Create, schedule, and manage all examinations"
        action={
          <Link to="/exams/create">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create New Exam
            </Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search exams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Exams Table */}
      <Card>
        <CardContent className="p-6">
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
                    Schedule
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Duration
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Assigned
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Progress
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr
                    key={exam.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-4 px-4">
                      <p className="font-medium text-gray-900">{exam.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {exam.created}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant="outline">{exam.subject}</Badge>
                    </td>
                    <td className="py-4 px-4">
                      <StatusBadge status={exam.status} />
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm">
                        <p className="text-gray-900">
                          {exam.openingTime !== "-"
                            ? new Date(exam.openingTime).toLocaleString([], {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "-"}
                        </p>
                        <p className="text-gray-500">
                          to{" "}
                          {exam.closingTime !== "-"
                            ? new Date(exam.closingTime).toLocaleString([], {
                                timeStyle: "short",
                              })
                            : "-"}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-900">
                        {exam.duration} min
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        {exam.assignedGroups.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {exam.assignedGroups.slice(0, 2).map((group, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {group}
                              </Badge>
                            ))}
                            {exam.assignedGroups.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{exam.assignedGroups.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">
                            Not assigned
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {exam.totalCandidates > 0 ? (
                          <>
                            <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px]">
                              <div
                                className="bg-green-600 h-2 rounded-full"
                                style={{
                                  width: `${
                                    (exam.completed / exam.totalCandidates) * 100
                                  }%`,
                                }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600 whitespace-nowrap">
                              {exam.completed}/{exam.totalCandidates}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-1">
                        {exam.status === "open" && (
                          <Link to={`/exams/${exam.id}/monitor`}>
                            <Button size="sm" variant="ghost" title="Monitor">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        )}
                        <Button size="sm" variant="ghost" title="Edit">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Link to={`/exams/${exam.id}/assign`}>
                          <Button size="sm" variant="ghost" title="Assign">
                            <Users className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button size="sm" variant="ghost" title="Clone">
                          <Copy className="w-4 h-4" />
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
              Showing <strong>1-5</strong> of <strong>28</strong> exams
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
