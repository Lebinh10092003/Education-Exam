import { useEffect, useState } from "react";
import { Edit, Plus, Search, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { notify } from "../lib/notify";

import { PageHeader } from "../components/PageHeader";
import { ImportTemplateActions } from "../components/imports/ImportTemplateActions";
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
import { Textarea } from "../components/ui/textarea";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { groupMembershipImportTemplate } from "../lib/importTemplates";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";

interface GroupRecord {
  id: number;
  name: string;
  description: string;
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

interface GroupMembershipImportSummary {
  total_rows: number;
  created_users: number;
  updated_users: number;
  assigned_users: number;
  skipped_rows: number;
  failed_rows: number;
  errors: Array<{
    row_number: number;
    identifier: string;
    message: string;
  }>;
}

interface GroupFormState {
  name: string;
  description: string;
  is_active: boolean;
}

const EMPTY_GROUP_FORM: GroupFormState = {
  name: "",
  description: "",
  is_active: true,
};

const PAGE_SIZE = 20;
const CANDIDATE_ROLE_SLUGS = new Set(["candidate"]);

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
  is_active: group.is_active,
});

export function GroupManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupRecord | null>(null);
  const [formState, setFormState] = useState<GroupFormState>(EMPTY_GROUP_FORM);
  const [membersDialogGroup, setMembersDialogGroup] = useState<GroupRecord | null>(null);
  const [membershipRefreshKey, setMembershipRefreshKey] = useState(0);
  const [candidateSearchQuery, setCandidateSearchQuery] = useState("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importInputKey, setImportInputKey] = useState(0);
  const [importSummary, setImportSummary] = useState<GroupMembershipImportSummary | null>(null);

  const [editingCandidateId, setEditingCandidateId] = useState<number | null>(null);
  const [candidateFormState, setCandidateFormState] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    password: "",
  });
  const [isCandidateEditingOpen, setIsCandidateEditingOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const debouncedCandidateSearch = useDebouncedValue(candidateSearchQuery, 300);
  const mutation = useMutationState();

  const groupsList = useAsyncList(
    async () =>
      apiRequest<PaginatedResponse<GroupRecord>>("/api/v1/groups/", {
        query: {
          page,
          search: debouncedSearch || undefined,
        },
      }),
    [page, debouncedSearch],
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

  const rolesList = useAsyncList(
    async () =>
      apiRequest<PaginatedResponse<{ id: number; name: string; slug: string }>>("/api/v1/roles/", {
        query: { page_size: 100 },
      }),
    [],
  );

  const candidateRole = rolesList.data?.results.find((r) => r.slug === "candidate");
  const candidateRoleId = candidateRole?.id;


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
  }, [debouncedSearch]);

  const groups = groupsList.data?.results ?? [];
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
    setImportFile(null);
    setImportSummary(null);
    setImportInputKey((previous) => previous + 1);
  };

  const closeMembersDialog = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMembersDialogGroup(null);
      setCandidateSearchQuery("");
      setSelectedCandidateIds([]);
      setImportFile(null);
      setImportSummary(null);
      setImportInputKey((previous) => previous + 1);
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

  const openCreateCandidateDialog = () => {
    setEditingCandidateId(null);
    setCandidateFormState({
      full_name: "",
      email: "",
      phone_number: "",
      password: "",
    });
    setIsCandidateEditingOpen(true);
  };

  const openEditCandidateDialog = async (userId: number) => {
    setEditingCandidateId(userId);
    setCandidateFormState({
      full_name: "",
      email: "",
      phone_number: "",
      password: "",
    });
    setIsCandidateEditingOpen(true);
    try {
      const user = await apiRequest<{
        full_name: string;
        email: string;
        phone_number: string;
      }>(`/api/v1/users/${userId}/`);
      setCandidateFormState({
        full_name: user.full_name || "",
        email: user.email || "",
        phone_number: user.phone_number || "",
        password: "",
      });
    } catch (err) {
      notify.error("Không thể tải thông tin thí sinh.");
      setIsCandidateEditingOpen(false);
    }
  };

  const saveCandidate = async () => {
    if (!candidateFormState.full_name.trim()) {
      notify.error("Họ và tên là bắt buộc.");
      return;
    }

    await mutation.run(async () => {
      const payload: Record<string, unknown> = {
        full_name: candidateFormState.full_name.trim(),
        email: candidateFormState.email.trim(),
        phone_number: candidateFormState.phone_number.trim(),
      };
      if (candidateFormState.password.trim()) {
        payload.password = candidateFormState.password;
      }

      if (editingCandidateId) {
        await apiRequest(`/api/v1/users/${editingCandidateId}/`, {
          method: "PATCH",
          body: payload,
        });
        notify.success("Cập nhật thông tin thí sinh thành công.");
      } else {
        if (!candidateFormState.password.trim()) {
          notify.error("Mật khẩu là bắt buộc khi tạo thí sinh mới.");
          return;
        }

        let roleId = candidateRoleId;
        if (!roleId) {
          try {
            const rolesResp = await apiRequest<PaginatedResponse<{ id: number; slug: string }>>("/api/v1/roles/", {
              query: { page_size: 100 },
            });
            const candRole = rolesResp.results.find((r) => r.slug === "candidate");
            roleId = candRole?.id;
          } catch (e) {
            console.error("Failed to load roles during candidate creation", e);
          }
        }

        payload.role_ids = roleId ? [roleId] : [];
        payload.status = "active";
        payload.is_active = true;

        const newUser = await apiRequest<{ id: number }>("/api/v1/users/", {
          method: "POST",
          body: payload,
        });

        if (membersDialogGroup) {
          await apiRequest(`/api/v1/groups/${membersDialogGroup.id}/memberships/`, {
            method: "POST",
            body: {
              user_id: newUser.id,
              is_active: true,
            },
          });
        }
        notify.success("Đã tạo thí sinh mới và thêm vào nhóm.");
      }

      setIsCandidateEditingOpen(false);
      setMembershipRefreshKey((previous) => previous + 1);
      await groupsList.reload();
    });
  };

  const deleteCandidateAccount = async () => {
    if (!editingCandidateId) return;
    const confirmed = await notify.confirm({
      title: "Xóa tài khoản thí sinh?",
      text: "Tài khoản thí sinh này sẽ bị xóa vĩnh viễn khỏi hệ thống.",
      confirmText: "Xóa tài khoản",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) return;

    await mutation.run(async () => {
      await apiRequest(`/api/v1/users/${editingCandidateId}/`, {
        method: "DELETE",
      });
      setIsCandidateEditingOpen(false);
      setMembershipRefreshKey((previous) => previous + 1);
      await groupsList.reload();
      notify.success("Đã xóa tài khoản thí sinh khỏi hệ thống.");
    });
  };


  const removeMember = async (userId: number, userName: string) => {
    if (!membersDialogGroup) return;
    const confirmed = await notify.confirm({
      title: "Remove member?",
      text: `Remove "${userName}" from the group "${membersDialogGroup.name}"?`,
      confirmText: "Remove Member",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) return;

    await mutation.run(async () => {
      await apiRequest(
        `/api/v1/groups/${membersDialogGroup.id}/memberships/`,
        {
          method: "DELETE",
          query: {
            user_id: userId,
          },
        }
      );
      setMembershipRefreshKey((previous) => previous + 1);
      await groupsList.reload();
      notify.success("Member removed from group.");
    });
  };

  const importMembers = async () => {
    if (!membersDialogGroup || !importFile) {
      notify.error("Select a CSV file before importing.");
      return;
    }

    await mutation.run(async () => {
      const formData = new FormData();
      formData.append("file", importFile);
      const summary = await apiRequest<GroupMembershipImportSummary>(
        `/api/v1/groups/${membersDialogGroup.id}/memberships/import/`,
        {
          method: "POST",
          body: formData,
        },
      );

      setImportSummary(summary);
      setImportFile(null);
      setImportInputKey((previous) => previous + 1);
      setMembershipRefreshKey((previous) => previous + 1);
      await groupsList.reload();

      notify.success(
        summary.failed_rows
          ? `Imported ${summary.assigned_users} members with ${summary.failed_rows} row error(s).`
          : `Imported ${summary.assigned_users} members.`,
      );
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
        description="Create reusable candidate groups and add candidates with live backend data."
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
      </div>

      {(groupsList.error || membershipsList.error || mutation.error) && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {groupsList.error || membershipsList.error || mutation.error}
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
        <DialogContent className="flex max-h-[min(92dvh,56rem)] sm:max-w-5xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-gray-200 px-4 py-4 pr-12 sm:px-6 sm:py-5">
            <DialogTitle>
              Add Members to {membersDialogGroup?.name ?? "Group"}
            </DialogTitle>
            <DialogDescription>
              Search candidate or student accounts, or import them from CSV, then add them to this group.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
            <div className="grid h-auto lg:h-full min-h-0 gap-6 lg:grid-cols-[minmax(0,1.2fr),minmax(18rem,0.8fr)]">
            <div className="flex h-auto lg:h-full min-h-0 flex-col gap-4">
              <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900">Import Members from CSV</h3>
                      <p className="mt-1 text-xs text-gray-600">
                        Supported columns:{" "}
                        <code className="whitespace-normal break-all">
                          full_name,email,phone_number,student_class,cccd,date_of_birth,school_code
                        </code>
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        Preview the expected CSV structure or download a starter template before importing.
                      </p>
                    </div>
                    <div className="shrink-0">
                      <ImportTemplateActions
                        template={groupMembershipImportTemplate}
                        selectedFormat="csv"
                      />
                    </div>
                  </div>
                  <Input
                    key={importInputKey}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">
                      {importFile ? importFile.name : "No CSV file selected."}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void importMembers()}
                      disabled={mutation.isSubmitting || !importFile}
                    >
                      {mutation.isSubmitting && importFile ? "Importing..." : "Import CSV"}
                    </Button>
                  </div>
                </div>
              </div>

              {importSummary ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-gray-900">Last Import Summary</h3>
                    <Badge variant={importSummary.failed_rows ? "secondary" : "outline"}>
                      {importSummary.failed_rows ? `${importSummary.failed_rows} row errors` : "All rows processed"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-600">
                    <div>Total rows: <strong>{importSummary.total_rows}</strong></div>
                    <div>Created users: <strong>{importSummary.created_users}</strong></div>
                    <div>Updated users: <strong>{importSummary.updated_users}</strong></div>
                    <div>Assigned users: <strong>{importSummary.assigned_users}</strong></div>
                    <div>Skipped rows: <strong>{importSummary.skipped_rows}</strong></div>
                    <div>Failed rows: <strong>{importSummary.failed_rows}</strong></div>
                  </div>
                  {importSummary.errors.length ? (
                    <div className="mt-4 space-y-2">
                      {importSummary.errors.map((error) => (
                        <div key={`${error.row_number}:${error.identifier}`} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          Row {error.row_number} {error.identifier ? `(${error.identifier})` : ""}: {error.message}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex gap-2 shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Tìm kiếm thí sinh..."
                    className="pl-10"
                    value={candidateSearchQuery}
                    onChange={(event) => setCandidateSearchQuery(event.target.value)}
                  />
                </div>
                <Button onClick={openCreateCandidateDialog} variant="outline" size="sm" className="h-10 shrink-0">
                  <Plus className="w-4 h-4 mr-2" />
                  Tạo thí sinh
                </Button>
              </div>

              <div className="h-[24rem] lg:h-full lg:flex-1 overflow-y-auto rounded-lg border">
                <div className="divide-y">
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
                         className="flex cursor-pointer items-start gap-3 p-3 hover:bg-gray-50"
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
            </div>

            <div className="flex h-auto lg:h-full min-h-0 flex-col rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Current Members</h3>
                <Badge variant="outline">{memberships.length}</Badge>
              </div>
              <div className="mt-4 h-[24rem] lg:h-full lg:flex-1 overflow-y-auto pr-1">
                <div className="space-y-3">
                {membershipsList.isLoading ? (
                  <p className="text-sm text-gray-500">Loading members...</p>
                ) : memberships.length === 0 ? (
                  <p className="text-sm text-gray-500">This group has no members yet.</p>
                ) : (
                  memberships.map((membership) => (
                    <div
                      key={membership.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {membership.user_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{membership.user_email}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="View / Edit Candidate"
                          onClick={() => openEditCandidateDialog(membership.user_id)}
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Remove from Group"
                          onClick={() => void removeMember(membership.user_id, membership.user_name)}
                          disabled={mutation.isSubmitting}
                        >
                          <UserMinus className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                </div>
              </div>
            </div>
          </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-gray-200 px-4 py-4 sm:px-6">
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

      <Dialog open={isCandidateEditingOpen} onOpenChange={setIsCandidateEditingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCandidateId ? "Chỉnh sửa thông tin thí sinh" : "Tạo tài khoản thí sinh mới"}
            </DialogTitle>
            <DialogDescription>
              {editingCandidateId
                ? "Xem, cập nhật thông tin chi tiết và đặt lại mật khẩu cho tài khoản thí sinh."
                : "Nhập thông tin chi tiết để tạo tài khoản thí sinh mới trong hệ thống."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="candidate-name">Họ và tên *</Label>
              <Input
                id="candidate-name"
                className="mt-2"
                value={candidateFormState.full_name}
                onChange={(event) =>
                  setCandidateFormState((previous) => ({ ...previous, full_name: event.target.value }))
                }
                placeholder="Nhập họ và tên thí sinh"
              />
            </div>
            <div>
              <Label htmlFor="candidate-email">Địa chỉ Email</Label>
              <Input
                id="candidate-email"
                type="text"
                className="mt-2"
                value={candidateFormState.email}
                onChange={(event) =>
                  setCandidateFormState((previous) => ({ ...previous, email: event.target.value }))
                }
                placeholder="candidate@example.com hoặc để trống"
              />
            </div>
            <div>
              <Label htmlFor="candidate-phone">Số điện thoại</Label>
              <Input
                id="candidate-phone"
                className="mt-2"
                value={candidateFormState.phone_number}
                onChange={(event) =>
                  setCandidateFormState((previous) => ({ ...previous, phone_number: event.target.value }))
                }
                placeholder="Nhập số điện thoại"
              />
            </div>
            <div>
              <Label htmlFor="candidate-password">
                {editingCandidateId ? "Mật khẩu mới (Để trống nếu không đổi)" : "Mật khẩu *"}
              </Label>
              <Input
                id="candidate-password"
                type="password"
                className="mt-2"
                value={candidateFormState.password}
                onChange={(event) =>
                  setCandidateFormState((previous) => ({ ...previous, password: event.target.value }))
                }
                placeholder={editingCandidateId ? "Nhập mật khẩu mới nếu muốn đặt lại" : "Nhập mật khẩu tạo tài khoản"}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between items-center w-full gap-2">
            {editingCandidateId ? (
              <Button
                variant="destructive"
                onClick={() => void deleteCandidateAccount()}
                disabled={mutation.isSubmitting}
                className="mr-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Xóa tài khoản
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsCandidateEditingOpen(false)}>
                Hủy
              </Button>
              <Button onClick={() => void saveCandidate()} disabled={mutation.isSubmitting}>
                {mutation.isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
