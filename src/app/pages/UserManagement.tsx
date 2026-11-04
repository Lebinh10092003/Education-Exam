import { useEffect, useState } from "react";
import { Download, Edit, Lock, Plus, Search, Trash2, Unlock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { notify } from "../lib/notify";

import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Checkbox } from "../components/ui/checkbox";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { ImportTemplateActions } from "../components/imports/ImportTemplateActions";
import { RangeSummary } from "../components/RangeSummary";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { userImportTemplate } from "../lib/importTemplates";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";
import { useAuth } from "../auth/useAuth";
import { getUserAccessActions, type UserAccessAction, type UserAccessStatus } from "./userManagementAccess";

interface SchoolOption {
  id: number;
  name: string;
  code: string;
}

interface RoleOption {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  is_system: boolean;
}

interface UserRecord {
  id: number;
  email: string;
  full_name: string;
  status: UserAccessStatus;
  is_active: boolean;
  is_staff: boolean;
  phone_number: string;
  last_login: string | null;
  school: SchoolOption | null;
  roles: RoleOption[];
}

interface UserFormState {
  full_name: string;
  email: string;
  password: string;
  phone_number: string;
  status: UserAccessStatus;
  is_active: boolean;
  is_staff: boolean;
  school_id: string;
  role_ids: number[];
}

const EMPTY_USER_FORM: UserFormState = {
  full_name: "",
  email: "",
  password: "",
  phone_number: "",
  status: "active",
  is_active: true,
  is_staff: false,
  school_id: "none",
  role_ids: [],
};

const PAGE_SIZE = 20;

const formatLastLogin = (value: string | null) => {
  if (!value) {
    return "Never";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
};

const toUserFormState = (user: UserRecord): UserFormState => ({
  full_name: user.full_name,
  email: user.email,
  password: "",
  phone_number: user.phone_number,
  status: user.status,
  is_active: user.is_active,
  is_staff: user.is_staff,
  school_id: user.school ? String(user.school.id) : "none",
  role_ids: user.roles.map((role) => role.id),
});

export function UserManagement() {
  const { t } = useTranslation(["common"]);
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formState, setFormState] = useState<UserFormState>(EMPTY_USER_FORM);
  const [importFile, setImportFile] = useState<File | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const userMutation = useMutationState();

  const usersList = useAsyncList(
    async () =>
      apiRequest<PaginatedResponse<UserRecord>>("/api/v1/users/", {
        query: {
          page,
          search: debouncedSearch || undefined,
          role: roleFilter !== "all" ? roleFilter : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
        },
      }),
    [page, debouncedSearch, roleFilter, statusFilter],
  );

  const rolesList = useAsyncList(
    async () => apiRequest<PaginatedResponse<RoleOption>>("/api/v1/roles/"),
    [],
  );

  const schoolsList = useAsyncList(
    async () => apiRequest<PaginatedResponse<SchoolOption>>("/api/v1/schools/"),
    [],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => {
    setSelectedUsers([]);
  }, [usersList.data?.count, page, debouncedSearch, roleFilter, statusFilter]);

  const users = usersList.data?.results ?? [];
  const roles = rolesList.data?.results ?? [];
  const schools = schoolsList.data?.results ?? [];
  const currentUserId = profile?.id ?? null;
  const selectableUsers = users.filter((user) => user.id !== currentUserId);
  const allSelected = selectableUsers.length > 0 && selectedUsers.length === selectableUsers.length;

  const openCreateDialog = () => {
    setEditingUser(null);
    setFormState(EMPTY_USER_FORM);
    setIsDialogOpen(true);
  };

  const openEditDialog = (user: UserRecord) => {
    setEditingUser(user);
    setFormState(toUserFormState(user));
    setIsDialogOpen(true);
  };

  const closeDialog = (nextOpen: boolean) => {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      setEditingUser(null);
      setFormState(EMPTY_USER_FORM);
      userMutation.setError(null);
    }
  };

  const closeImportDialog = (nextOpen: boolean) => {
    setIsImportDialogOpen(nextOpen);
    if (!nextOpen) {
      setImportFile(null);
    }
  };

  const toggleUserSelection = (userId: number) => {
    if (userId === currentUserId) {
      return;
    }
    setSelectedUsers((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    );
  };

  const toggleAllUsers = () => {
    setSelectedUsers(allSelected ? [] : selectableUsers.map((user) => user.id));
  };

  const toggleRoleSelection = (roleId: number) => {
    setFormState((previous) => ({
      ...previous,
      role_ids: previous.role_ids.includes(roleId)
        ? previous.role_ids.filter((id) => id !== roleId)
        : [...previous.role_ids, roleId],
    }));
  };

  const saveUser = async () => {
    if (!formState.full_name.trim()) {
      notify.error("Full name is required.");
      return;
    }

    if (!editingUser && !formState.password.trim()) {
      notify.error("Password is required when creating a user.");
      return;
    }

    await userMutation.run(async () => {
      const payload: Record<string, unknown> = {
        full_name: formState.full_name.trim(),
        email: formState.email.trim(),
        phone_number: formState.phone_number.trim(),
        status: formState.status,
        is_active: formState.is_active,
        is_staff: formState.is_staff,
        school_id: formState.school_id === "none" ? null : Number(formState.school_id),
        role_ids: formState.role_ids,
      };

      if (formState.password.trim()) {
        payload.password = formState.password;
      }

      if (editingUser) {
        await apiRequest(`/api/v1/users/${editingUser.id}/`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await apiRequest("/api/v1/users/", {
          method: "POST",
          body: payload,
        });
      }

      await usersList.reload();
      await schoolsList.reload();
      closeDialog(false);
      notify.success(editingUser ? "User updated." : "User created.");
    });
  };

  const deleteUser = async (user: UserRecord) => {
    if (user.id === currentUserId) {
      await notify.error("You cannot delete your own account.", {
        title: "Action blocked",
        timer: 4000,
      });
      return;
    }

    const confirmed = await notify.confirm({
      title: "Delete this user?",
      text: `User "${user.full_name}" will be permanently removed.`,
      confirmText: "Delete User",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) {
      return;
    }

    await userMutation.run(async () => {
      await apiRequest(`/api/v1/users/${user.id}/`, {
        method: "DELETE",
      });
      await usersList.reload();
      notify.success("User deleted.");
    });
  };

  const changeUserAccess = async (user: UserRecord, action: UserAccessAction) => {
    if (user.id === currentUserId) {
      await notify.error("You cannot lock your own account.", {
        title: "Action blocked",
        timer: 4000,
      });
      return;
    }

    const confirmed = await notify.confirm({
      title: action === "lock" ? "Lock this user?" : "Unlock this user?",
      text:
        action === "lock"
          ? `${user.full_name} will no longer be able to sign in until unlocked.`
          : `${user.full_name} will regain access to sign in.`,
      confirmText: action === "lock" ? "Lock User" : "Unlock User",
      confirmButtonColor: action === "lock" ? "#d97706" : "#16a34a",
    });
    if (!confirmed) {
      return;
    }

    await userMutation.run(async () => {
      await apiRequest(`/api/v1/users/${user.id}/${action}/`, {
        method: "POST",
        body: {},
      });
      await usersList.reload();
      notify.success(action === "lock" ? "User locked." : "User unlocked.");
    });
  };

  const runBulkAction = async (action: "lock" | "unlock" | "delete") => {
    if (selectedUsers.length === 0) {
      return;
    }

    const targetUserIds = selectedUsers.filter((userId) => userId !== currentUserId);
    if (targetUserIds.length === 0) {
      await notify.error("Your own account cannot be changed by bulk actions.", {
        title: "Action blocked",
        timer: 4000,
      });
      return;
    }

    if (targetUserIds.length !== selectedUsers.length) {
      await notify.warning("Your own account was excluded from the bulk action.", {
        title: "Current account skipped",
        timer: 4000,
      });
    }

    const confirmed = await notify.confirm({
      title:
        action === "delete"
          ? "Delete selected users?"
          : action === "lock"
            ? "Lock selected users?"
            : "Unlock selected users?",
      text:
        action === "delete"
          ? `${targetUserIds.length} selected user(s) will be permanently removed.`
          : action === "lock"
            ? `${targetUserIds.length} selected user(s) will be prevented from signing in.`
            : `${targetUserIds.length} selected user(s) will regain access to sign in.`,
      confirmText:
        action === "delete"
          ? "Delete Users"
          : action === "lock"
            ? "Lock Users"
            : "Unlock Users",
      confirmButtonColor:
        action === "delete" ? "#dc2626" : action === "lock" ? "#d97706" : "#16a34a",
    });
    if (!confirmed) {
      return;
    }

    await userMutation.run(async () => {
      await Promise.all(
        targetUserIds.map((userId) =>
          apiRequest(
            action === "delete"
              ? `/api/v1/users/${userId}/`
              : `/api/v1/users/${userId}/${action}/`,
            {
              method: action === "delete" ? "DELETE" : "POST",
              body: action === "delete" ? null : {},
            },
          ),
        ),
      );
      setSelectedUsers([]);
      await usersList.reload();
      notify.success(`Bulk ${action} completed.`);
    });
  };

  const handlePendingUserImport = async () => {
    if (!importFile) {
      notify.error("Choose a CSV file to prepare for import.");
      return;
    }

    const formData = new FormData();
    formData.append("file", importFile);

    await userMutation.run(async () => {
      const response = await apiRequest<{
        total_rows: number;
        created_users: number;
        updated_users: number;
        failed_rows: number;
        errors: Array<{ row_number: number; identifier: string; message: string }>;
      }>("/api/v1/users/import-csv/", {
        method: "POST",
        body: formData,
      });

      await usersList.reload();
      closeImportDialog(false);

      if (response.failed_rows > 0) {
        await notify.confirm({
          icon: "warning",
          title: "Import completed with errors",
          html: `
            <div style="text-align: left; font-size: 14px; line-height: 1.5;">
              <p>Successfully processed ${response.total_rows} rows:</p>
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Created: <strong>${response.created_users}</strong></li>
                <li>Updated: <strong>${response.updated_users}</strong></li>
                <li>Failed: <strong>${response.failed_rows}</strong></li>
              </ul>
              <div style="max-height: 160px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; background-color: #f8fafc; margin-top: 8px; font-size: 12px; font-family: monospace;">
                ${response.errors
                  .map(
                    (err) =>
                      `<div>Row ${err.row_number} (${err.identifier}): ${err.message}</div>`
                  )
                  .join("")}
              </div>
            </div>
          `,
          confirmText: "OK",
          cancelText: "Close",
        });
      } else {
        notify.success(
          `Import successful: Created ${response.created_users} and updated ${response.updated_users} users.`
        );
      }
    });
  };


  const totalCount = usersList.data?.count ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : rangeStart + users.length - 1;

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Manage users, roles, and account access with live data from Django."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
              <Download className="w-4 h-4 mr-2" />
              {t("common:actions.importCsv")}
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              {t("common:actions.addUser")}
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full lg:w-[220px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.slug}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedUsers.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <span className="text-sm text-blue-900">
                {selectedUsers.length} user(s) selected
              </span>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void runBulkAction("lock")}
                  disabled={userMutation.isSubmitting}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Lock
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void runBulkAction("unlock")}
                  disabled={userMutation.isSubmitting}
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  Unlock
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void runBulkAction("delete")}
                  disabled={userMutation.isSubmitting}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}

          {(usersList.error || rolesList.error || schoolsList.error || userMutation.error) && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {usersList.error || rolesList.error || schoolsList.error || userMutation.error}
            </div>
          )}

          <div className="space-y-4 md:hidden">
            {usersList.isLoading ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                No users matched the current filters.
              </div>
            ) : (
              users.map((user) => (
                <div key={user.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      disabled={user.id === currentUserId}
                      onCheckedChange={() => toggleUserSelection(user.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{user.full_name}</p>
                          <p className="truncate text-sm text-gray-500">{user.email}</p>
                        </div>
                        <StatusBadge status={user.status} />
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-400">School</p>
                          <p>{user.school ? `${user.school.name} (${user.school.code})` : "Unassigned"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-400">Last Login</p>
                          <p>{formatLastLogin(user.last_login)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <Badge key={role.id} variant="outline">
                              {role.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">No roles</span>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(user)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        {getUserAccessActions(user.status).map((action) => (
                          <Button
                            key={action}
                            size="sm"
                            variant="outline"
                            onClick={() => void changeUserAccess(user, action)}
                            disabled={userMutation.isSubmitting || user.id === currentUserId}
                          >
                            {action === "unlock" ? (
                              <>
                                <Unlock className="mr-2 h-4 w-4 text-green-600" />
                                Unlock
                              </>
                            ) : (
                              <>
                                <Lock className="mr-2 h-4 w-4 text-amber-600" />
                                Lock
                              </>
                            )}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void deleteUser(user)}
                          disabled={userMutation.isSubmitting || user.id === currentUserId}
                        >
                          <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1120px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 w-12">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAllUsers} />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Email
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Roles
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    School
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Last Login
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {usersList.isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-gray-500">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-gray-500">
                      No users matched the current filters.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          disabled={user.id === currentUserId}
                          onCheckedChange={() => toggleUserSelection(user.id)}
                        />
                      </td>
                      <td className="py-3 px-4 min-w-[190px]">
                        <div>
                          <p className="font-semibold text-gray-900 leading-snug">{user.full_name}</p>
                          {user.phone_number && (
                            <p className="text-xs text-gray-500 mt-1">{user.phone_number}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{user.email}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-2">
                          {user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Badge key={role.id} variant="outline">
                                {role.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-gray-500">No roles</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 min-w-[220px] max-w-[300px] text-sm leading-snug text-gray-600">
                        {user.school ? `${user.school.name} (${user.school.code})` : "Unassigned"}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-600">
                        {formatLastLogin(user.last_login)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEditDialog(user)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          {getUserAccessActions(user.status).map((action) => (
                            <Button
                              key={action}
                              size="sm"
                              variant="ghost"
                              onClick={() => void changeUserAccess(user, action)}
                              disabled={userMutation.isSubmitting || user.id === currentUserId}
                            >
                              {action === "unlock" ? (
                                <Unlock className="w-4 h-4 text-green-600" />
                              ) : (
                                <Lock className="w-4 h-4 text-amber-600" />
                              )}
                            </Button>
                          ))}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void deleteUser(user)}
                            disabled={userMutation.isSubmitting || user.id === currentUserId}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <RangeSummary start={rangeStart} end={rangeEnd} total={totalCount} unit="users" />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!usersList.data?.previous || usersList.isLoading}
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
                disabled={!usersList.data?.next || usersList.isLoading}
                onClick={() => setPage((previous) => previous + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isImportDialogOpen} onOpenChange={closeImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Users</DialogTitle>
            <DialogDescription>
              Prepare a CSV file using the shared template now. This dialog is ready for the backend user import flow that will be added later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>User Import Format</Label>
              <Select value="csv" disabled>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="CSV" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Upload File</Label>
              <Input
                type="file"
                className="mt-2"
                accept=".csv"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              />
              {importFile ? (
                <p className="mt-2 text-xs text-gray-500">
                  Selected file: <strong>{importFile.name}</strong>
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Open the import template</p>
                <p className="text-xs text-gray-500">
                  Preview the column mapping or download a starter CSV before uploading.
                </p>
              </div>
              <ImportTemplateActions template={userImportTemplate} selectedFormat="csv" />
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Upload the CSV file below to import new users or update existing ones. The system will match users by email and assign the specified roles.
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeImportDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handlePendingUserImport}>
              Import Users
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update account information, roles, and access state."
                : "Create a new user account and assign roles."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div>
              <Label htmlFor="user-name">Full Name</Label>
              <Input
                id="user-name"
                className="mt-2"
                value={formState.full_name}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, full_name: event.target.value }))
                }
                placeholder="Enter full name"
              />
            </div>
            <div>
              <Label htmlFor="user-email">Email Address</Label>
              <Input
                id="user-email:text"
                type="text"
                className="mt-2"
                value={formState.email}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, email: event.target.value }))
                }
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label htmlFor="user-password">
                {editingUser ? "New Password (optional)" : "Password"}
              </Label>
              <Input
                id="user-password"
                type="password"
                className="mt-2"
                value={formState.password}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, password: event.target.value }))
                }
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label htmlFor="user-phone">Phone Number</Label>
              <Input
                id="user-phone"
                className="mt-2"
                value={formState.phone_number}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, phone_number: event.target.value }))
                }
                placeholder="+84..."
              />
            </div>
            <div>
              <Label htmlFor="user-school">School</Label>
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
              <Label htmlFor="user-status">Status</Label>
              <Select
                value={formState.status}
                onValueChange={(value: UserFormState["status"]) =>
                  setFormState((previous) => ({ ...previous, status: value }))
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Roles</Label>
            <div className="grid gap-3 rounded-lg border border-gray-200 p-4 md:grid-cols-2">
              {roles.length === 0 ? (
                <p className="text-sm text-gray-500">No roles available.</p>
              ) : (
                roles.map((role) => (
                  <label key={role.id} className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={formState.role_ids.includes(role.id)}
                      onCheckedChange={() => toggleRoleSelection(role.id)}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{role.name}</p>
                      <p className="text-xs text-gray-500">{role.slug}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-2">
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
              <span className="text-sm text-gray-700">Account active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formState.is_staff}
                onCheckedChange={(checked) =>
                  setFormState((previous) => ({
                    ...previous,
                    is_staff: checked === true,
                  }))
                }
              />
              <span className="text-sm text-gray-700">Staff access</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveUser()} disabled={userMutation.isSubmitting}>
              {userMutation.isSubmitting
                ? editingUser
                  ? "Saving..."
                  : "Creating..."
                : editingUser
                  ? "Save Changes"
                  : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
