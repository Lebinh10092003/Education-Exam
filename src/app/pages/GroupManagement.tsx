import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Edit, Plus, Search, Trash2, Users } from "lucide-react";
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
import { Textarea } from "../components/ui/textarea";
import { apiRequest, type PaginatedResponse } from "../lib/http";
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

const formatDate = (value: string) => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
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

  const debouncedSearch = useDebouncedValue(searchQuery, 350);
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

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const groups = groupsList.data?.results ?? [];

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

  const saveGroup = async () => {
    if (!formState.name.trim()) {
      notify.error("Tên nhóm là bắt buộc.");
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
      notify.success(editingGroup ? "Đã cập nhật nhóm." : "Đã tạo nhóm.");
    });
  };

  const deleteGroup = async (group: GroupRecord) => {
    const confirmed = await notify.confirm({
      title: "Xóa nhóm này?",
      text: `Nhóm "${group.name}" sẽ bị xóa vĩnh viễn.`,
      confirmText: "Xóa nhóm",
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
      notify.success("Đã xóa nhóm.");
    });
  };

  const totalCount = groupsList.data?.count ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : rangeStart + groups.length - 1;

  return (
    <div>
      <PageHeader
        title="Nhóm thí sinh"
        description="Quản lý các nhóm thí sinh và mở trang danh sách thành viên chi tiết."
        action={
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Tạo nhóm
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Tìm kiếm nhóm..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {(groupsList.error || mutation.error) && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {groupsList.error || mutation.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {groupsList.isLoading ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-16 text-center text-sm text-gray-500">
              Đang tải danh sách nhóm...
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
            <Card key={group.id} className="transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="line-clamp-2 text-lg leading-snug" title={group.name}>{group.name}</CardTitle>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge
                          variant="outline"
                          className={group.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}
                        >
                          {group.is_active ? "Đang hoạt động" : "Tạm dừng"}
                        </Badge>
                        <span className="text-xs text-gray-500">Tạo ngày {formatDate(group.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="min-h-[40px] text-sm text-gray-600">
                  {group.description || "Chưa có mô tả."}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-blue-50">
                    {group.member_count} thành viên
                  </Badge>
                  <Badge variant="outline" className="bg-green-50">
                    {group.exams_count} kỳ thi
                  </Badge>
                </div>

                <div className="mt-4 flex gap-2 border-t border-gray-200 pt-4">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link to={`/groups/${group.id}/members`}>
                      <Users className="h-4 w-4" />
                      Thành viên
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(group)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void deleteGroup(group)}
                    disabled={mutation.isSubmitting}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Hiển thị <strong>{rangeStart}-{rangeEnd}</strong> trên <strong>{totalCount}</strong> nhóm
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!groupsList.data?.previous || groupsList.isLoading}
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
          >
            Truoc
          </Button>
          <Button variant="outline" size="sm" disabled>
            Trang {page}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!groupsList.data?.next || groupsList.isLoading}
            onClick={() => setPage((previous) => previous + 1)}
          >
            Sau
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={closeGroupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Sửa nhóm" : "Tạo nhóm mới"}</DialogTitle>
            <DialogDescription>
              Lưu thông tin nhóm để quản lý danh sách thí sinh và gán kỳ thi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="group-name">Tên nhóm</Label>
              <Input
                id="group-name"
                className="mt-2"
                value={formState.name}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, name: event.target.value }))
                }
                placeholder="VD: IMO - Khoi 10"
              />
            </div>
            <div>
              <Label htmlFor="group-description">Mo ta</Label>
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
                placeholder="Mô tả ngắn về nhóm"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={formState.is_active}
                onCheckedChange={(checked) =>
                  setFormState((previous) => ({
                    ...previous,
                    is_active: checked === true,
                  }))
                }
              />
              <span className="text-sm text-gray-700">Nhóm đang hoạt động</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeGroupDialog(false)}>
              Huy
            </Button>
            <Button onClick={() => void saveGroup()} disabled={mutation.isSubmitting}>
              {mutation.isSubmitting
                ? "Đang lưu..."
                : editingGroup
                  ? "Lưu thay đổi"
                  : "Tạo nhóm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
