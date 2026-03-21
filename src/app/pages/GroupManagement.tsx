import { useEffect, useState } from "react";
import { Edit, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import { notify } from "../lib/notify";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";

interface SchoolOption {
  id: number;
  name: string;
  code: string;
}

interface GroupRecord {
  id: number;
  name: string;
  description: string;
  school_id?: number | null;
  school_name: string | null;
  is_active: boolean;
  member_count: number;
  exams_count: number;
  created_at: string;
  updated_at: string;
}

interface GroupMembershipRecord {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string;
  is_active: boolean;
  created_at: string;
}

interface CandidateOption {
  id: number;
  full_name: string;
  email: string;
  roles: Array<{ id: number; slug: string; name: string }>;
}

interface GroupFormState {
  name: string;
  description: string;
  school_id: string;
  is_active: boolean;
}

const EMPTY_GROUP_FORM: GroupFormState = {
  name: "",
  description: "",
  school_id: "none",
  is_active: true,
};

const PAGE_SIZE = 20;
const CANDIDATE_ROLE_SLUGS = new Set(["candidate", "student"]);

const formatDate = (value: string) => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(parsedDate);
};

const toGroupFormState = (group: GroupRecord): GroupFormState => ({
  name: group.name,
  description: group.description,
  school_id: group.school_id ? String(group.school_id) : "none",
  is_active: group.is_active,
});

export function GroupManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupRecord | null>(null);
  const [formState, setFormState] = useState<GroupFormState>(EMPTY_GROUP_FORM);
  const [membersDialogGroup, setMembersDialogGroup] = useState<GroupRecord | null>(null);
  const [membershipRefreshKey, setMembershipRefreshKey] = useState(0);
  const [candidateSearchQuery, setCandidateSearchQuery] = useState("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);

  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const debouncedCandidateSearch = useDebouncedValue(candidateSearchQuery, 300);
  const mutation = useMutationState();

  const groupsList = useAsyncList(
    async () =>
      apiRequest<PaginatedResponse<GroupRecord>>("/api/v1/groups/", {
        query: {
          page,
          search: debouncedSearch || undefined,
          school: schoolFilter !== "all" ? schoolFilter : undefined,
        },
      }),
    [page, debouncedSearch, schoolFilter],
  );

  const schoolsList = useAsyncList(
    async () => apiRequest<PaginatedResponse<SchoolOption>>("/api/v1/schools/"),
    [],
  );

  const membershipsList = useAsyncList(
    async () => {
      if (!membersDialogGroup) {
        return {
          count: 0,
          next: null,
          previous: null,
          results: [] as GroupMembershipRecord[],
        };
      }

      return apiRequest<PaginatedResponse<GroupMembershipRecord>>(
        `/api/v1/groups/${membersDialogGroup.id}/memberships/`,
      );
    },
    [membersDialogGroup?.id, membershipRefreshKey],
  );

  const candidateSearchResults = useAsyncList(
    async () => {
      if (!membersDialogGroup) {
        return {
          count: 0,
          next: null,
          previous: null,
          results: [] as CandidateOption[],
        };
      }

      return apiRequest<PaginatedResponse<CandidateOption>>("/api/v1/users/", {
        query: {
          search: debouncedCandidateSearch || undefined,
        },
      });
    },
    [membersDialogGroup?.id, debouncedCandidateSearch],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, schoolFilter]);

  const groups = groupsList.data?.results ?? [];
  const schools = schoolsList.data?.results ?? [];
  const memberships = membershipsList.data?.results ?? [];
  const existingMemberIds = new Set(memberships.map((membership) => membership.user_id));

  const availableCandidates = (candidateSearchResults.data?.results ?? []).filter((user) => {
    const hasCandidateRole = user.roles.some((role) => CANDIDATE_ROLE_SLUGS.has(role.slug));
    return hasCandidateRole && !existingMemberIds.has(user.id);
  });

  const openCreateDialog = () => {
    setEditingGroup(null);
    setFormState(EMPTY_GROUP_FORM);
    setIsDialogOpen(true);
  };

  const openEditDialog = (group: GroupRecord) => {
    setEditingGroup(group);
    setFormState(toGroupFormState(group));
    setIsDialogOpen(true);
  };

  const closeGroupDialog = (nextOpen: boolean) => {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      setEditingGroup(null);
      setFormState(EMPTY_GROUP_FORM);
      mutation.setError(null);
    }
  };

  const openMembersDialog = (group: GroupRecord) => {
    setMembersDialogGroup(group);
    setCandidateSearchQuery("");
    setSelectedCandidateIds([]);
  };

  const closeMembersDialog = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMembersDialogGroup(null);
      setCandidateSearchQuery("");
      setSelectedCandidateIds([]);
    }
  };

  const saveGroup = async () => {
    if (!formState.name.trim()) {
      notify.error("Group name is required.");
      return;
    }

    await mutation.run(async () => {
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim(),
        school_id: formState.school_id === "none" ? null : Number(formState.school_id),
        is_active: formState.is_active,
      };

      if (editingGroup) {
        await apiRequest(`/api/v1/groups/${editingGroup.id}/`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await apiRequest("/api/v1/groups/", {
          method: "POST",
          body: payload,
        });
      }

      await groupsList.reload();
      closeGroupDialog(false);
      notify.success(editingGroup ? "Group updated." : "Group created.");
    });
  };

  const deleteGroup = async (group: GroupRecord) => {
    const confirmed = await notify.confirm({
      title: "Delete this group?",
      text: `Group "${group.name}" will be permanently removed.`,
      confirmText: "Delete Group",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) {
      return;
    }

    await mutation.run(async () => {
      await apiRequest(`/api/v1/groups/${group.id}/`, {
        method: "DELETE",
      });
      await groupsList.reload();
      notify.success("Group deleted.");
    });
  };

  const addMembers = async () => {
    if (!membersDialogGroup || selectedCandidateIds.length === 0) {
      return;
    }

    await mutation.run(async () => {
      await Promise.all(
        selectedCandidateIds.map((userId) =>
          apiRequest(`/api/v1/groups/${membersDialogGroup.id}/memberships/`, {
            method: "POST",
            body: {
              user_id: userId,
              is_active: true,
            },
          }),
        ),
      );

      setSelectedCandidateIds([]);
      setMembershipRefreshKey((previous) => previous + 1);
      await groupsList.reload();
      notify.success("Members added to the group.");
    });
  };

  const toggleCandidateSelection = (userId: number) => {
    setSelectedCandidateIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    );
  };

  const totalCount = groupsList.data?.count ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : rangeStart + groups.length - 1;

  return (
    <div>
      <PageHeader
        title="Candidate Group Management"
        description="Create groups, assign schools, and add candidates with live backend data."
        action={
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Create Group
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={schoolFilter} onValueChange={setSchoolFilter}>
          <SelectTrigger className="w-full lg:w-[240px]">
            <SelectValue placeholder="Filter by school" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {schools.map((school) => (
              <SelectItem key={school.id} value={String(school.id)}>
                {school.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(groupsList.error || schoolsList.error || membershipsList.error || mutation.error) && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {groupsList.error || schoolsList.error || membershipsList.error || mutation.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {groupsList.isLoading ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-16 text-center text-sm text-gray-500">
              Loading groups...
            </CardContent>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-16 text-center text-sm text-gray-500">
              No groups matched the current filters.
            </CardContent>
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        Created {formatDate(group.created_at)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={group.is_active ? "outline" : "secondary"}>
                    {group.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 min-h-[40px]">
                  {group.description || "No description provided."}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-blue-50">
                    {group.member_count} members
                  </Badge>
                  <Badge variant="outline" className="bg-green-50">
                    {group.exams_count} exams
                  </Badge>
                  <Badge variant="outline">
                    {group.school_name ?? "No school"}
                  </Badge>
                </div>

                <div className="flex gap-2 pt-4 mt-4 border-t border-gray-200">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openMembersDialog(group)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Members
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(group)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void deleteGroup(group)}
                    disabled={mutation.isSubmitting}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Showing <strong>{rangeStart}-{rangeEnd}</strong> of <strong>{totalCount}</strong> groups
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!groupsList.data?.previous || groupsList.isLoading}
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
          >
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled>
            Page {page}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!groupsList.data?.next || groupsList.isLoading}
            onClick={() => setPage((previous) => previous + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={closeGroupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit Group" : "Create New Group"}</DialogTitle>
            <DialogDescription>
              Save group details and keep the assignment target in sync with the backend.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                className="mt-2"
                value={formState.name}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, name: event.target.value }))
                }
                placeholder="e.g., Computer Science - Year 1"
              />
            </div>
            <div>
              <Label htmlFor="group-school">School</Label>
              <Select
                value={formState.school_id}
                onValueChange={(value) =>
                  setFormState((previous) => ({ ...previous, school_id: value }))
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select school" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No school</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={String(school.id)}>
                      {school.name} ({school.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="group-description">Description</Label>
              <Textarea
                id="group-description"
                className="mt-2"
                rows={4}
                value={formState.description}
                onChange={(event) =>
                  setFormState((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                placeholder="Brief description of this group"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formState.is_active}
                onCheckedChange={(checked) =>
                  setFormState((previous) => ({
                    ...previous,
                    is_active: checked === true,
                  }))
                }
              />
              <span className="text-sm text-gray-700">Group is active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeGroupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveGroup()} disabled={mutation.isSubmitting}>
              {mutation.isSubmitting
                ? editingGroup
                  ? "Saving..."
                  : "Creating..."
                : editingGroup
                  ? "Save Changes"
                  : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(membersDialogGroup)} onOpenChange={closeMembersDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Add Members to {membersDialogGroup?.name ?? "Group"}
            </DialogTitle>
            <DialogDescription>
              Search candidate or student accounts and add them to this group.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search candidates..."
                  className="pl-10"
                  value={candidateSearchQuery}
                  onChange={(event) => setCandidateSearchQuery(event.target.value)}
                />
              </div>

              <div className="border rounded-lg max-h-80 overflow-y-auto divide-y">
                {candidateSearchResults.isLoading ? (
                  <div className="p-4 text-sm text-gray-500">Loading candidate list...</div>
                ) : availableCandidates.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">
                    No available candidates found for this search.
                  </div>
                ) : (
                  availableCandidates.map((candidate) => (
                    <label
                      key={candidate.id}
                      className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedCandidateIds.includes(candidate.id)}
                        onCheckedChange={() => toggleCandidateSelection(candidate.id)}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {candidate.full_name}
                        </p>
                        <p className="text-xs text-gray-500">{candidate.email}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {candidate.roles.map((role) => (
                            <Badge key={role.id} variant="outline">
                              {role.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Current Members</h3>
                <Badge variant="outline">{memberships.length}</Badge>
              </div>
              <div className="mt-4 space-y-3 max-h-72 overflow-y-auto">
                {membershipsList.isLoading ? (
                  <p className="text-sm text-gray-500">Loading members...</p>
                ) : memberships.length === 0 ? (
                  <p className="text-sm text-gray-500">This group has no members yet.</p>
                ) : (
                  memberships.map((membership) => (
                    <div
                      key={membership.id}
                      className="rounded-lg border border-gray-200 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {membership.user_name}
                      </p>
                      <p className="text-xs text-gray-500">{membership.user_email}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeMembersDialog(false)}>
              Close
            </Button>
            <Button
              onClick={() => void addMembers()}
              disabled={mutation.isSubmitting || selectedCandidateIds.length === 0}
            >
              {mutation.isSubmitting ? "Adding..." : `Add Selected (${selectedCandidateIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
