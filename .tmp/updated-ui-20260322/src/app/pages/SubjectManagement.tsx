import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
import { Textarea } from "../components/ui/textarea";
import { Search, Plus, Edit, Trash2, BookOpen } from "lucide-react";
import { Badge } from "../components/ui/badge";

const subjects = [
  {
    id: 1,
    name: "Mathematics",
    code: "MATH101",
    description: "Advanced mathematical concepts and problem solving",
    questionsCount: 456,
    examsCount: 12,
    color: "bg-blue-600",
  },
  {
    id: 2,
    name: "Physics",
    code: "PHYS101",
    description: "Fundamental physics principles and applications",
    questionsCount: 328,
    examsCount: 8,
    color: "bg-purple-600",
  },
  {
    id: 3,
    name: "Chemistry",
    code: "CHEM101",
    description: "Chemical reactions and molecular structures",
    questionsCount: 392,
    examsCount: 10,
    color: "bg-green-600",
  },
  {
    id: 4,
    name: "Biology",
    code: "BIO101",
    description: "Living organisms and biological systems",
    questionsCount: 284,
    examsCount: 6,
    color: "bg-orange-600",
  },
  {
    id: 5,
    name: "Computer Science",
    code: "CS101",
    description: "Programming, algorithms, and data structures",
    questionsCount: 512,
    examsCount: 15,
    color: "bg-indigo-600",
  },
  {
    id: 6,
    name: "English Literature",
    code: "ENG101",
    description: "Literary analysis and writing composition",
    questionsCount: 198,
    examsCount: 5,
    color: "bg-pink-600",
  },
];

export function SubjectManagement() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div>
      <PageHeader
        title="Subject Management"
        description="Manage subjects and their associated content"
        action={
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Subject
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Subject</DialogTitle>
                <DialogDescription>
                  Create a new subject for organizing exams and questions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="subjectName">Subject Name</Label>
                  <Input
                    id="subjectName"
                    placeholder="e.g., Mathematics"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="code">Subject Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g., MATH101"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="subjectDesc">Description</Label>
                  <Textarea
                    id="subjectDesc"
                    placeholder="Brief description of the subject"
                    className="mt-2"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="color">Color Theme</Label>
                  <div className="flex gap-2 mt-2">
                    {[
                      "bg-blue-600",
                      "bg-purple-600",
                      "bg-green-600",
                      "bg-orange-600",
                      "bg-indigo-600",
                      "bg-pink-600",
                    ].map((color) => (
                      <button
                        key={color}
                        className={`w-8 h-8 rounded-lg ${color} hover:ring-2 ring-offset-2 ring-gray-400`}
                      ></button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Create Subject</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Subjects Table */}
      <Card>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Subject
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Code
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Description
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Questions
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Exams
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr
                    key={subject.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 ${subject.color} rounded-lg flex items-center justify-center`}
                        >
                          <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {subject.name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant="outline">{subject.code}</Badge>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-600 max-w-xs">
                        {subject.description}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-900">
                        {subject.questionsCount}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-900">
                        {subject.examsCount}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost">
                          <Edit className="w-4 h-4" />
                        </Button>
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
        </CardContent>
      </Card>
    </div>
  );
}
