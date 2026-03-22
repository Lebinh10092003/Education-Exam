import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Shield,
  Users,
  Copy,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const roles = [
  {
    id: 1,
    name: "Administrator",
    description: "Full system access with all permissions",
    userCount: 3,
    color: "red",
    isSystem: true,
  },
  {
    id: 2,
    name: "Examiner",
    description: "Can create and manage exams, questions, and grade submissions",
    userCount: 12,
    color: "blue",
    isSystem: true,
  },
  {
    id: 3,
    name: "Candidate",
    description: "Can take exams and view results",
    userCount: 1247,
    color: "green",
    isSystem: true,
  },
  {
    id: 4,
    name: "Content Manager",
    description: "Manages materials library and question bank",
    userCount: 5,
    color: "purple",
    isSystem: false,
  },
  {
    id: 5,
    name: "Grader",
    description: "Can grade essay questions and provide feedback",
    userCount: 8,
    color: "orange",
    isSystem: false,
  },
];

const permissions = {
  users: [
    { id: "users.view", label: "View Users", description: "View user list and details" },
    { id: "users.create", label: "Create Users", description: "Add new users" },
    { id: "users.edit", label: "Edit Users", description: "Modify user information" },
    { id: "users.delete", label: "Delete Users", description: "Remove users from system" },
    { id: "users.import", label: "Import Users", description: "Bulk import users" },
  ],
  exams: [
    { id: "exams.view", label: "View Exams", description: "View exam list and details" },
    { id: "exams.create", label: "Create Exams", description: "Create new exams" },
    { id: "exams.edit", label: "Edit Exams", description: "Modify exam settings" },
    { id: "exams.delete", label: "Delete Exams", description: "Remove exams" },
    { id: "exams.assign", label: "Assign Exams", description: "Assign exams to candidates" },
    { id: "exams.monitor", label: "Monitor Exams", description: "Live exam monitoring" },
  ],
  questions: [
    { id: "questions.view", label: "View Questions", description: "View question bank" },
    { id: "questions.create", label: "Create Questions", description: "Add new questions" },
    { id: "questions.edit", label: "Edit Questions", description: "Modify questions" },
    { id: "questions.delete", label: "Delete Questions", description: "Remove questions" },
    { id: "questions.import", label: "Import Questions", description: "Bulk import questions" },
  ],
  grading: [
    { id: "grading.auto", label: "Auto Grading", description: "Access auto-graded results" },
    { id: "grading.manual", label: "Manual Grading", description: "Grade essay questions" },
    { id: "grading.review", label: "Review Grades", description: "Review and modify grades" },
    { id: "grading.finalize", label: "Finalize Grades", description: "Finalize and publish grades" },
  ],
  results: [
    { id: "results.view", label: "View Results", description: "View exam results" },
    { id: "results.export", label: "Export Results", description: "Export result reports" },
    { id: "results.analytics", label: "Analytics", description: "Access analytics dashboard" },
  ],
  materials: [
    { id: "materials.view", label: "View Materials", description: "Access materials library" },
    { id: "materials.upload", label: "Upload Materials", description: "Add new materials" },
    { id: "materials.edit", label: "Edit Materials", description: "Modify materials" },
    { id: "materials.delete", label: "Delete Materials", description: "Remove materials" },
  ],
  system: [
    { id: "system.settings", label: "System Settings", description: "Manage system configuration" },
    { id: "system.roles", label: "Manage Roles", description: "Create and modify roles" },
    { id: "system.audit", label: "Audit Logs", description: "View system audit logs" },
    { id: "system.backup", label: "Backup & Restore", description: "System backup operations" },
  ],
};

export function RolesPermissions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const toggleCategory = (categoryPermissions: typeof permissions.users) => {
    const categoryIds = categoryPermissions.map((p) => p.id);
    const allSelected = categoryIds.every((id) =>
      selectedPermissions.includes(id)
    );

    if (allSelected) {
      setSelectedPermissions((prev) =>
        prev.filter((id) => !categoryIds.includes(id))
      );
    } else {
      setSelectedPermissions((prev) => [
        ...prev,
        ...categoryIds.filter((id) => !prev.includes(id)),
      ]);
    }
  };

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="Manage user roles and access permissions"
        action={
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Role
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Role</DialogTitle>
                <DialogDescription>
                  Define a new role with custom permissions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="role-name">Role Name</Label>
                  <Input
                    id="role-name"
                    placeholder="Enter role name"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="role-description">Description</Label>
                  <Input
                    id="role-description"
                    placeholder="Describe this role"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Color Badge</Label>
                  <div className="flex gap-2 mt-2">
                    {["red", "blue", "green", "purple", "orange", "pink"].map(
                      (color) => (
                        <button
                          key={color}
                          className={`w-8 h-8 rounded-full bg-${color}-500 hover:ring-2 ring-${color}-300`}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Create Role</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              Total Roles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{roles.length}</p>
            <p className="text-sm text-gray-600 mt-1">
              {roles.filter((r) => r.isSystem).length} system roles
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-green-600" />
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">
              {roles.reduce((sum, r) => sum + r.userCount, 0)}
            </p>
            <p className="text-sm text-gray-600 mt-1">Across all roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-600" />
              Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">
              {Object.values(permissions).reduce(
                (sum, cat) => sum + cat.length,
                0
              )}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {Object.keys(permissions).length} categories
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Roles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => (
              <Card key={role.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full bg-${role.color}-500`}
                      />
                      <CardTitle className="text-base">{role.name}</CardTitle>
                    </div>
                    {role.isSystem && (
                      <Badge variant="outline" className="text-xs">
                        System
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">{role.description}</p>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>{role.userCount} users</span>
                    </div>
                    <div className="flex gap-1">
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </SheetTrigger>
                        <SheetContent className="sm:max-w-2xl overflow-y-auto">
                          <SheetHeader>
                            <SheetTitle>Edit Role: {role.name}</SheetTitle>
                            <SheetDescription>
                              Manage permissions for this role
                            </SheetDescription>
                          </SheetHeader>

                          <div className="mt-6 space-y-6">
                            {/* Basic Info */}
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="edit-name">Role Name</Label>
                                <Input
                                  id="edit-name"
                                  defaultValue={role.name}
                                  className="mt-2"
                                  disabled={role.isSystem}
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-description">
                                  Description
                                </Label>
                                <Input
                                  id="edit-description"
                                  defaultValue={role.description}
                                  className="mt-2"
                                />
                              </div>
                            </div>

                            {/* Permissions */}
                            <div>
                              <h3 className="font-medium text-gray-900 mb-4">
                                Permissions
                              </h3>
                              <Tabs defaultValue="users" className="space-y-4">
                                <TabsList className="grid w-full grid-cols-4">
                                  <TabsTrigger value="users">Users</TabsTrigger>
                                  <TabsTrigger value="exams">Exams</TabsTrigger>
                                  <TabsTrigger value="questions">
                                    Questions
                                  </TabsTrigger>
                                  <TabsTrigger value="system">System</TabsTrigger>
                                </TabsList>

                                {Object.entries(permissions).map(
                                  ([category, perms]) => (
                                    <TabsContent
                                      key={category}
                                      value={category}
                                      className="space-y-4"
                                    >
                                      <div className="flex items-center justify-between pb-2 border-b">
                                        <h4 className="font-medium text-sm text-gray-900 capitalize">
                                          {category} Permissions
                                        </h4>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => toggleCategory(perms)}
                                        >
                                          {perms.every((p) =>
                                            selectedPermissions.includes(p.id)
                                          )
                                            ? "Deselect All"
                                            : "Select All"}
                                        </Button>
                                      </div>
                                      <div className="space-y-3">
                                        {perms.map((permission) => (
                                          <div
                                            key={permission.id}
                                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50"
                                          >
                                            <Checkbox
                                              id={permission.id}
                                              checked={selectedPermissions.includes(
                                                permission.id
                                              )}
                                              onCheckedChange={() =>
                                                togglePermission(permission.id)
                                              }
                                              className="mt-1"
                                            />
                                            <div className="flex-1">
                                              <Label
                                                htmlFor={permission.id}
                                                className="font-medium text-sm cursor-pointer"
                                              >
                                                {permission.label}
                                              </Label>
                                              <p className="text-xs text-gray-600 mt-0.5">
                                                {permission.description}
                                              </p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </TabsContent>
                                  )
                                )}
                              </Tabs>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-4 border-t">
                              <Button variant="outline" className="flex-1">
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicate Role
                              </Button>
                              <Button className="flex-1">Save Changes</Button>
                            </div>
                          </div>
                        </SheetContent>
                      </Sheet>
                      {!role.isSystem && (
                        <Button size="sm" variant="ghost">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
