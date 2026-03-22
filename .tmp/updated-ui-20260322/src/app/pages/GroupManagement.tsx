import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
import { Search, Plus, Users, Edit, Trash2, UserPlus } from "lucide-react";
import { Badge } from "../components/ui/badge";

const groups = [
  {
    id: 1,
    name: "Computer Science - Year 1",
    description: "First year computer science students",
    memberCount: 45,
    examsCount: 8,
    created: "2024-01-15",
  },
  {
    id: 2,
    name: "Mathematics Advanced",
    description: "Advanced mathematics group for senior students",
    memberCount: 32,
    examsCount: 12,
    created: "2024-02-01",
  },
  {
    id: 3,
    name: "Physics Department",
    description: "All physics faculty and students",
    memberCount: 67,
    examsCount: 5,
    created: "2024-01-20",
  },
  {
    id: 4,
    name: "Chemistry Batch 2024",
    description: "Chemistry students enrolled in 2024",
    memberCount: 28,
    examsCount: 6,
    created: "2024-02-10",
  },
];

export function GroupManagement() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div>
      <PageHeader
        title="Candidate Group Management"
        description="Organize candidates into groups for easy exam assignment"
        action={
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Group</DialogTitle>
                <DialogDescription>
                  Create a new candidate group
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="groupName">Group Name</Label>
                  <Input
                    id="groupName"
                    placeholder="e.g., Computer Science - Year 1"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of this group"
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Create Group</Button>
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
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => (
          <Card key={group.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      Created {new Date(group.created).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {group.description}
              </p>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50">
                    {group.memberCount} members
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50">
                    {group.examsCount} exams
                  </Badge>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Members
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Members to {group.name}</DialogTitle>
                      <DialogDescription>
                        Search and select candidates to add to this group
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="Search candidates..."
                          className="pl-10"
                        />
                      </div>
                      <div className="border rounded-lg max-h-64 overflow-y-auto">
                        {[
                          "Alice Johnson",
                          "Bob Smith",
                          "Carol Davis",
                          "David Lee",
                        ].map((name, idx) => (
                          <label
                            key={idx}
                            className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                          >
                            <input type="checkbox" className="rounded" />
                            <span className="text-sm">{name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline">Cancel</Button>
                      <Button>Add Selected</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" size="sm">
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
