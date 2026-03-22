import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Search, UserPlus } from "lucide-react";
import { useState } from "react";

const groups = [
  {
    id: 1,
    name: "Computer Science - Year 1",
    memberCount: 45,
    assigned: true,
  },
  {
    id: 2,
    name: "Mathematics Advanced",
    memberCount: 32,
    assigned: true,
  },
  {
    id: 3,
    name: "Physics Department",
    memberCount: 67,
    assigned: false,
  },
  {
    id: 4,
    name: "Chemistry Batch 2024",
    memberCount: 28,
    assigned: false,
  },
];

export function ExamAssignment() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div>
      <PageHeader
        title="Assign Exam to Groups"
        description="Mathematics Final Exam - Select candidate groups"
        action={
          <Button>
            <UserPlus className="w-4 h-4 mr-2" />
            Save Assignment
          </Button>
        }
      />

      <Card>
        <CardContent className="p-6">
          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Groups List */}
          <div className="space-y-3">
            {groups.map((group) => (
              <label
                key={group.id}
                className="flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <Checkbox defaultChecked={group.assigned} />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{group.name}</p>
                  <p className="text-sm text-gray-500">
                    {group.memberCount} members
                  </p>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
