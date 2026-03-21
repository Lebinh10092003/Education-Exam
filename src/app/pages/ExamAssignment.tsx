import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { apiRequest } from "../lib/http";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";

interface ExamAssignmentExam {
  id: number;
  name: string;
  subject: {
    id: number;
    name: string;
    code: string;
    color: string;
  };
  assignment_summary: {
    assigned_group_ids: number[];
    total_candidates: number;
  };
}

interface GroupAssignmentRecord {
  id: number;
  name: string;
  member_count: number;
  assigned: boolean;
  school: {
    id: number | null;
    name: string;
    code: string;
  };
}

export function ExamAssignment() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const mutation = useMutationState();

  const examDetails = useAsyncList(
    async () => {
      if (!id) {
        throw new Error("Exam id is required.");
      }
      return apiRequest<ExamAssignmentExam>(`/api/v1/exams/${id}/`);
    },
    [id],
  );

  const groupsList = useAsyncList(
    async () => {
      if (!id) {
        return { count: 0, results: [] as GroupAssignmentRecord[] };
      }

      return apiRequest<{ count: number; results: GroupAssignmentRecord[] }>(
        `/api/v1/exams/${id}/group-assignments/`,
        {
          query: {
            search: debouncedSearch || undefined,
          },
        },
      );
    },
    [id, debouncedSearch],
  );

  useEffect(() => {
    if (examDetails.data?.assignment_summary.assigned_group_ids) {
      setSelectedGroupIds(examDetails.data.assignment_summary.assigned_group_ids);
    }
  }, [examDetails.data?.assignment_summary.assigned_group_ids]);

  const toggleGroup = (groupId: number) => {
    setSelectedGroupIds((previous) =>
      previous.includes(groupId)
        ? previous.filter((id) => id !== groupId)
        : [...previous, groupId],
    );
  };

  const saveAssignments = async () => {
    if (!id) {
      return;
    }

    await mutation.run(async () => {
      await apiRequest(`/api/v1/exams/${id}/group-assignments/`, {
        method: "POST",
        body: {
          group_ids: selectedGroupIds,
        },
      });
      await Promise.all([examDetails.reload(), groupsList.reload()]);
      toast.success("Assignments saved.");
      navigate("/exams");
    });
  };

  const exam = examDetails.data;
  const groups = groupsList.data?.results ?? [];

  return (
    <div>
      <PageHeader
        title="Assign Exam to Groups"
        description={
          exam
            ? `${exam.name} • ${exam.subject.name} • ${exam.assignment_summary.total_candidates} total candidates`
            : "Load exam assignment targets"
        }
        action={
          <Button onClick={() => void saveAssignments()} disabled={mutation.isSubmitting || examDetails.isLoading}>
            <UserPlus className="w-4 h-4 mr-2" />
            {mutation.isSubmitting ? "Saving..." : "Save Assignment"}
          </Button>
        }
      />

      {(examDetails.error || groupsList.error || mutation.error) && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {examDetails.error || groupsList.error || mutation.error}
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-3">
            {groupsList.isLoading ? (
              <div className="py-12 text-center text-sm text-gray-500">Loading group assignments...</div>
            ) : groups.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">No groups matched the current search.</div>
            ) : (
              groups.map((group) => (
                <label
                  key={group.id}
                  className="flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <Checkbox
                    checked={selectedGroupIds.includes(group.id)}
                    onCheckedChange={() => toggleGroup(group.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{group.name}</p>
                      {group.assigned && <Badge variant="outline">Assigned</Badge>}
                    </div>
                    <p className="text-sm text-gray-500">
                      {group.member_count} members
                      {group.school.name ? ` • ${group.school.name}` : ""}
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
