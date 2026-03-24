import { useMemo, useState } from "react";
import { Edit, Plus, Search, Shield, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

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
import { ScrollArea } from "../components/ui/scroll-area";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { notify } from "../lib/notify";
import {
  getPermissionDescription,
  getPermissionModuleLabel,
  normalizePermissionLocale,
} from "../lib/permissionI18n";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";

interface PermissionRecord {
  id: number;
  module: string;
  action: string;
  code: string;
  description: string;
  is_system: boolean;
}

interface RoleRecord {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_system: boolean;
  is_active: boolean;
  permissions: PermissionRecord[];
}

interface RoleFormState {
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  permission_ids: number[];
}

const EMPTY_ROLE_FORM: RoleFormState = {
  name: "",
  slug: "",
  description: "",
  is_active: true,
  permission_ids: [],
};

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toRoleFormState = (role: RoleRecord): RoleFormState => ({
  name: role.name,
  slug: role.slug,
  description: role.description,
  is_active: role.is_active,
  permission_ids: role.permissions.map((permission) => permission.id),
});

export function RolesPermissions() {
  const { i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [formState, setFormState] = useState<RoleFormState>(EMPTY_ROLE_FORM);

  const debouncedSearch = useDebouncedValue(searchQuery, 250);
  const mutation = useMutationState();

  const rolesList = useAsyncList(
    () => apiRequest<PaginatedResponse<RoleRecord>>("/api/v1/roles/", { query: { page_size: 100 } }),
    [],
  );
  const permissionsList = useAsyncList(
    () => apiRequest<PaginatedResponse<PermissionRecord>>("/api/v1/permissions/", { query: { page_size: 200 } }),
    [],
  );

  const roles = rolesList.data?.results ?? [];
  const permissions = permissionsList.data?.results ?? [];
  const permissionLocale = normalizePermissionLocale(i18n.language ?? i18n.resolvedLanguage);

  const filteredRoles = useMemo(() => {
    if (!debouncedSearch) {
      return roles;
    }
    const normalized = debouncedSearch.toLowerCase();
    return roles.filter((role) =>
      [role.name, role.slug, role.description].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [debouncedSearch, roles]);

  const groupedPermissions = useMemo(() => {
    return permissions.reduce<Record<string, PermissionRecord[]>>((groups, permission) => {
      const key = permission.module || "other";
      groups[key] ??= [];
      groups[key].push(permission);
      return groups;
    }, {});
  }, [permissions]);

  const stats = useMemo(
    () => ({
      totalRoles: roles.length,
      systemRoles: roles.filter((role) => role.is_system).length,
      customRoles: roles.filter((role) => !role.is_system).length,
      totalPermissions: permissions.length,
    }),
    [permissions.length, roles],
  );

  const openCreateDialog = () => {
    setEditingRole(null);
    setFormState(EMPTY_ROLE_FORM);
    setIsDialogOpen(true);
  };

  const openEditDialog = (role: RoleRecord) => {
    setEditingRole(role);
    setFormState(toRoleFormState(role));
    setIsDialogOpen(true);
  };

  const closeDialog = (nextOpen: boolean) => {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      setEditingRole(null);
      setFormState(EMPTY_ROLE_FORM);
      mutation.setError(null);
    }
  };

  const togglePermission = (permissionId: number) => {
    setFormState((current) => ({
      ...current,
      permission_ids: current.permission_ids.includes(permissionId)
        ? current.permission_ids.filter((id) => id !== permissionId)
        : [...current.permission_ids, permissionId],
    }));
  };

  const saveRole = async () => {
    if (!formState.name.trim()) {
      notify.error("Role name is required.");
      return;
    }

    const payload = {
      name: formState.name.trim(),
      slug: formState.slug.trim() || toSlug(formState.name),
      description: formState.description.trim(),
      is_active: formState.is_active,
      permission_ids: formState.permission_ids,
    };

    try {
      await mutation.run(() =>
        apiRequest(editingRole ? `/api/v1/roles/${editingRole.id}/` : "/api/v1/roles/", {
          method: editingRole ? "PATCH" : "POST",
          body: payload,
        }),
      );
      await rolesList.reload();
      closeDialog(false);
      notify.success(editingRole ? "Role updated." : "Role created.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save role.";
      notify.error(message);
    }
  };

  const deleteRole = async (role: RoleRecord) => {
    if (role.is_system) {
      notify.warning("System roles should not be deleted from this screen.", {
        title: "Protected role",
      });
      return;
    }

    const confirmed = await notify.confirm({
      title: "Delete this role?",
      text: `Role "${role.name}" will be permanently removed.`,
      confirmText: "Delete Role",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) {
      return;
    }

    try {
      await mutation.run(() =>
        apiRequest(`/api/v1/roles/${role.id}/`, {
          method: "DELETE",
        }),
      );
      await rolesList.reload();
      notify.success("Role deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete role.";
      notify.error(message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="Manage role definitions and permission assignments from live backend RBAC data."
        action={
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Create Role
          </Button>
        }
      />

      {(rolesList.error || permissionsList.error || mutation.error) ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {rolesList.error ?? permissionsList.error ?? mutation.error}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-blue-600" />
              Total Roles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.totalRoles}</p>
            <p className="mt-1 text-sm text-gray-600">All defined roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">System Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.systemRoles}</p>
            <p className="mt-1 text-sm text-gray-600">Seeded and protected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Custom Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.customRoles}</p>
            <p className="mt-1 text-sm text-gray-600">Editable roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.totalPermissions}</p>
            <p className="mt-1 text-sm text-gray-600">Live permission codes</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search roles by name, slug, or description..."
              className="pl-10"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr),360px]">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {rolesList.isLoading ? (
                <Card className="xl:col-span-2">
                  <CardContent className="py-16 text-center text-sm text-gray-500">
                    Loading roles...
                  </CardContent>
                </Card>
              ) : filteredRoles.length === 0 ? (
                <Card className="xl:col-span-2">
                  <CardContent className="py-16 text-center text-sm text-gray-500">
                    No roles matched the current search.
                  </CardContent>
                </Card>
              ) : (
                filteredRoles.map((role) => (
                  <Card key={role.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{role.name}</h3>
                          <p className="mt-1 text-xs text-gray-500">{role.slug}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {role.is_system ? <Badge variant="outline">System</Badge> : null}
                          <Badge variant={role.is_active ? "outline" : "secondary"}>
                            {role.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>

                      <p className="min-h-[40px] text-sm text-gray-600">
                        {role.description || "No description provided."}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {role.permissions.slice(0, 3).map((permission) => (
                          <Badge key={permission.id} variant="outline" className="text-xs">
                            {permission.code}
                          </Badge>
                        ))}
                        {role.permissions.length > 3 ? (
                          <Badge variant="outline" className="text-xs">
                            +{role.permissions.length - 3} more
                          </Badge>
                        ) : null}
                      </div>

                      <div className="flex gap-2 border-t border-gray-200 pt-4">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(role)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void deleteRole(role)}
                          disabled={mutation.isSubmitting || role.is_system}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Permission Catalog</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[520px] pr-4">
                  <div className="space-y-6">
                    {Object.entries(groupedPermissions)
                      .sort(([left], [right]) => left.localeCompare(right))
                      .map(([module, modulePermissions]) => (
                        <div key={module}>
                          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                            {getPermissionModuleLabel(module, permissionLocale)}
                          </h3>
                          <div className="space-y-3">
                            {modulePermissions.map((permission) => (
                              <div key={permission.id} className="rounded-lg border border-gray-200 p-3">
                                <p className="text-sm font-medium text-gray-900">{permission.code}</p>
                                <p className="mt-1 text-xs text-gray-500">
                                  {getPermissionDescription(permission, permissionLocale)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create Role"}</DialogTitle>
            <DialogDescription>
              Update the role definition and assign the live permission codes this role should grant.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4 lg:grid-cols-[360px,minmax(0,1fr)]">
            <div className="space-y-4">
              <div>
                <Label htmlFor="role-name">Role Name</Label>
                <Input
                  id="role-name"
                  className="mt-2"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      name: event.target.value,
                      slug: editingRole ? current.slug : toSlug(event.target.value),
                    }))
                  }
                  placeholder="e.g. Content Manager"
                />
              </div>
              <div>
                <Label htmlFor="role-slug">Slug</Label>
                <Input
                  id="role-slug"
                  className="mt-2"
                  value={formState.slug}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, slug: toSlug(event.target.value) }))
                  }
                  placeholder="content-manager"
                />
              </div>
              <div>
                <Label htmlFor="role-description">Description</Label>
                <Input
                  id="role-description"
                  className="mt-2"
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Describe the intended scope of this role"
                />
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
                <Checkbox
                  checked={formState.is_active}
                  onCheckedChange={(checked) =>
                    setFormState((current) => ({ ...current, is_active: checked === true }))
                  }
                />
                <span className="text-sm text-gray-700">Role is active</span>
              </label>
            </div>

            <div>
              <Label>Permissions</Label>
              <ScrollArea className="mt-2 h-[420px] rounded-lg border border-gray-200 p-4">
                <div className="space-y-6">
                  {Object.entries(groupedPermissions)
                    .sort(([left], [right]) => left.localeCompare(right))
                    .map(([module, modulePermissions]) => (
                      <div key={module}>
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                          {getPermissionModuleLabel(module, permissionLocale)}
                        </h3>
                        <div className="space-y-3">
                          {modulePermissions.map((permission) => (
                            <label
                              key={permission.id}
                              className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 px-3 py-3"
                            >
                              <Checkbox
                                checked={formState.permission_ids.includes(permission.id)}
                                onCheckedChange={() => togglePermission(permission.id)}
                              />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{permission.code}</p>
                                <p className="text-xs text-gray-500">
                                  {getPermissionDescription(permission, permissionLocale)}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveRole()} disabled={mutation.isSubmitting}>
              {mutation.isSubmitting
                ? editingRole
                  ? "Saving..."
                  : "Creating..."
                : editingRole
                  ? "Save Changes"
                  : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
