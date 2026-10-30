import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Download, Pencil, Plus, Search, Trophy } from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { COMPETITION_STATUS_STYLES } from "../lib/competitionStatus";
import {
  REGISTRATION_STATUS_LABELS,
  formatIsoDate,
  type AdminCompetition,
  type CompetitionRegistration,
  type RegistrationStatus,
} from "../lib/competitions";
import { buildApiUrl } from "../lib/env";
import { ApiError, apiRequest, type PaginatedResponse } from "../lib/http";
import { notify } from "../lib/notify";
import { getStoredTokens } from "../lib/storage";

const COMPETITION_STATUS_LABELS = { upcoming: "Sắp diễn ra", ongoing: "Đang diễn ra", ended: "Đã kết thúc" } as const;
const REGISTRATION_STATUS_STYLES: Record<RegistrationStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  rejected: "bg-slate-200 text-slate-700",
};

type CompetitionForm = {
  name: string;
  code: string;
  cycle: string;
  exam_date: string;
  registration_deadline: string;
  description: string;
  info_url: string;
  sort_order: number;
  is_featured: boolean;
  registration_open: boolean;
  is_active: boolean;
};

const EMPTY_FORM: CompetitionForm = {
  name: "",
  code: "",
  cycle: "",
  exam_date: "",
  registration_deadline: "",
  description: "",
  info_url: "",
  sort_order: 0,
  is_featured: true,
  registration_open: true,
  is_active: true,
};

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiError && error.payload && typeof error.payload === "object") {
    const messages = Object.entries(error.payload as Record<string, unknown>).flatMap(([field, value]) =>
      (Array.isArray(value) ? value : [value]).map((item) => (field === "detail" ? String(item) : `${field}: ${item}`)),
    );
    if (messages.length) return messages.join(" ");
  }
  return error instanceof Error ? error.message : fallback;
};

function CompetitionsTab() {
  const [items, setItems] = useState<AdminCompetition[] | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminCompetition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CompetitionForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await apiRequest<PaginatedResponse<AdminCompetition>>("/api/v1/competitions/", {
        query: { page_size: 200, search: search || undefined },
      });
      setItems(data.results);
    } catch (error) {
      notify.error(errorMessage(error, "Không tải được danh sách cuộc thi."));
      setItems([]);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item: AdminCompetition) => {
    setEditing(item);
    setForm({
      name: item.name,
      code: item.code,
      cycle: item.cycle,
      exam_date: item.exam_date,
      registration_deadline: item.registration_deadline ?? "",
      description: item.description,
      info_url: item.info_url,
      sort_order: item.sort_order,
      is_featured: item.is_featured,
      registration_open: item.registration_open,
      is_active: item.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim() || !form.exam_date) {
      notify.error("Cần nhập tên, mã và ngày thi.");
      return;
    }
    setSaving(true);
    try {
      const body = { ...form, registration_deadline: form.registration_deadline || null };
      if (editing) {
        await apiRequest(`/api/v1/competitions/${editing.id}/`, { method: "PATCH", body });
        notify.success("Đã cập nhật cuộc thi.");
      } else {
        await apiRequest("/api/v1/competitions/", { method: "POST", body });
        notify.success("Đã thêm cuộc thi.");
      }
      setDialogOpen(false);
      await load();
    } catch (error) {
      notify.error(errorMessage(error, "Không lưu được cuộc thi."));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item: AdminCompetition, field: "is_featured" | "registration_open" | "is_active") => {
    try {
      await apiRequest(`/api/v1/competitions/${item.id}/`, { method: "PATCH", body: { [field]: !item[field] } });
      await load();
    } catch (error) {
      notify.error(errorMessage(error, "Không cập nhật được."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Tìm theo tên, mã, chu kỳ..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Thêm cuộc thi
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Cuộc thi</th>
              <th className="px-4 py-3">Chu kỳ</th>
              <th className="px-4 py-3">Ngày thi</th>
              <th className="px-4 py-3">Hạn đăng ký</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-center">Trang chủ</th>
              <th className="px-4 py-3 text-center">Mở đăng ký</th>
              <th className="px-4 py-3 text-center">Hiển thị</th>
              <th className="px-4 py-3 text-right">Đăng ký</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items === null ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  Đang tải...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  Chưa có cuộc thi nào. Bấm “Thêm cuộc thi” để tạo lịch thi mới.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className={item.is_active ? "" : "opacity-60"}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.code}</p>
                  </td>
                  <td className="px-4 py-3">{item.cycle || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatIsoDate(item.exam_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatIsoDate(item.registration_deadline)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COMPETITION_STATUS_STYLES[item.status]}`}>
                      {COMPETITION_STATUS_LABELS[item.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={item.is_featured}
                      onCheckedChange={() => void toggle(item, "is_featured")}
                      aria-label={`Hiện ${item.code} trên trang chủ`}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={item.registration_open}
                      onCheckedChange={() => void toggle(item, "registration_open")}
                      aria-label={`Mở đăng ký ${item.code}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={() => void toggle(item, "is_active")}
                      aria-label={`Hiển thị ${item.code}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{item.registration_count}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(item)} aria-label={`Sửa ${item.code}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Trạng thái tự tính theo ngày thi. Cuộc thi đã qua vẫn được giữ làm lịch sử; trang chủ hiển thị các cuộc thi sắp và
        đang diễn ra, kèm tối đa 6 cuộc thi gần nhất đã kết thúc.
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Sửa cuộc thi ${editing.code}` : "Thêm cuộc thi"}</DialogTitle>
            <DialogDescription>Thông tin hiển thị trên trang chủ và form đăng ký dự thi.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="competition-name">Tên cuộc thi *</Label>
              <Input
                id="competition-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Olympic Quốc tế về Toán học"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="competition-code">Mã *</Label>
              <Input
                id="competition-code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                placeholder="IMO"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="competition-cycle">Chu kỳ</Label>
              <Input
                id="competition-cycle"
                value={form.cycle}
                onChange={(event) => setForm({ ...form, cycle: event.target.value })}
                placeholder="4"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="competition-date">Ngày thi *</Label>
              <Input
                id="competition-date"
                type="date"
                value={form.exam_date}
                onChange={(event) => setForm({ ...form, exam_date: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="competition-deadline">Hạn đăng ký</Label>
              <Input
                id="competition-deadline"
                type="date"
                value={form.registration_deadline}
                onChange={(event) => setForm({ ...form, registration_deadline: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="competition-description">Mô tả ngắn</Label>
              <Textarea
                id="competition-description"
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="competition-url">Link thông tin</Label>
              <Input
                id="competition-url"
                value={form.info_url}
                onChange={(event) => setForm({ ...form, info_url: event.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="competition-order">Thứ tự</Label>
              <Input
                id="competition-order"
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) || 0 })}
              />
            </div>
            {(
              [
                ["is_featured", "Hiện trên trang chủ"],
                ["registration_open", "Mở đăng ký"],
                ["is_active", "Hiển thị công khai"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                {label}
                <Switch checked={form[field]} onCheckedChange={(checked) => setForm({ ...form, [field]: checked })} />
              </label>
            ))}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegistrationsTab() {
  const [data, setData] = useState<PaginatedResponse<CompetitionRegistration> | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | RegistrationStatus>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CompetitionRegistration | null>(null);
  const [note, setNote] = useState("");

  const load = async () => {
    try {
      setData(
        await apiRequest<PaginatedResponse<CompetitionRegistration>>("/api/v1/competition-registrations/", {
          query: { page, status: statusFilter || undefined, search: search || undefined },
        }),
      );
    } catch (error) {
      notify.error(errorMessage(error, "Không tải được danh sách đăng ký."));
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search, page]);

  const updateStatus = async (registration: CompetitionRegistration, status: RegistrationStatus) => {
    try {
      const updated = await apiRequest<CompetitionRegistration>(`/api/v1/competition-registrations/${registration.id}/`, {
        method: "PATCH",
        body: { status, admin_note: note },
      });
      setSelected(updated);
      notify.success(`Đã chuyển sang “${REGISTRATION_STATUS_LABELS[status]}”.`);
      await load();
    } catch (error) {
      notify.error(errorMessage(error, "Không cập nhật được."));
    }
  };

  const exportExcel = async () => {
    const tokens = getStoredTokens();
    const query = new URLSearchParams();
    if (statusFilter) query.set("status", statusFilter);
    if (search) query.set("search", search);
    const response = await fetch(buildApiUrl(`/api/v1/competition-registrations/export/?${query.toString()}`), {
      headers: tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : {},
    });
    if (!response.ok) {
      notify.error("Không xuất được file.");
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "dang-ky-du-thi.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  };

  const counts = useMemo(() => data?.count ?? 0, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Tìm tên, email, SĐT, trường, CCCD..."
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
          </div>
          <select
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={statusFilter}
            aria-label="Lọc trạng thái"
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value as "" | RegistrationStatus);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(REGISTRATION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Button variant="outline" onClick={() => void exportExcel()}>
          <Download className="mr-2 h-4 w-4" />
          Xuất Excel
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Thí sinh</th>
              <th className="px-4 py-3">Trường / lớp</th>
              <th className="px-4 py-3">Liên hệ</th>
              <th className="px-4 py-3">Cuộc thi</th>
              <th className="px-4 py-3">Ngày gửi</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data === null ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Đang tải...
                </td>
              </tr>
            ) : data.results.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Chưa có lượt đăng ký nào.
                </td>
              </tr>
            ) : (
              data.results.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900"
                  onClick={() => {
                    setSelected(item);
                    setNote(item.admin_note);
                  }}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 dark:text-white">{item.full_name}</p>
                    <p className="text-xs text-slate-500">{formatIsoDate(item.date_of_birth)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{item.school}</p>
                    <p className="text-xs text-slate-500">
                      {item.grade}
                      {item.class_name ? ` · ${item.class_name}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{item.guardian_phone}</p>
                    <p className="text-xs text-slate-500">{item.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.competitions.map((competition) => (
                        <Badge key={competition.id} variant="outline">
                          {competition.code}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                    {new Date(item.created_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${REGISTRATION_STATUS_STYLES[item.status]}`}>
                      {REGISTRATION_STATUS_LABELS[item.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{counts} lượt đăng ký</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!data?.previous} onClick={() => setPage((value) => value - 1)}>
            Trước
          </Button>
          <Button variant="outline" size="sm" disabled={!data?.next} onClick={() => setPage((value) => value + 1)}>
            Sau
          </Button>
        </div>
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.full_name}</DialogTitle>
                <DialogDescription>
                  Gửi lúc {new Date(selected.created_at).toLocaleString("vi-VN")}
                  {selected.handled_by_name ? ` · Xử lý bởi ${selected.handled_by_name}` : ""}
                </DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {(
                  [
                    ["Ngày sinh", formatIsoDate(selected.date_of_birth)],
                    ["Khối / lớp", `${selected.grade}${selected.class_name ? ` · ${selected.class_name}` : ""}`],
                    ["Trường", selected.school],
                    ["CCCD", selected.cccd || "—"],
                    ["Email", selected.email],
                    ["SĐT phụ huynh", selected.guardian_phone],
                    ["Địa chỉ", [selected.address, selected.ward, selected.city].filter(Boolean).join(", ") || "—"],
                    ["Cuộc thi", selected.competitions.map((item) => `${item.code} (${item.name})`).join("; ")],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-medium text-slate-900 dark:text-white">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="space-y-1.5">
                <Label htmlFor="registration-note">Ghi chú nội bộ</Label>
                <Textarea id="registration-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {(Object.keys(REGISTRATION_STATUS_LABELS) as RegistrationStatus[]).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={selected.status === status ? "default" : "outline"}
                    onClick={() => void updateStatus(selected, status)}
                  >
                    {REGISTRATION_STATUS_LABELS[status]}
                  </Button>
                ))}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CompetitionsManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "registrations" ? "registrations" : "competitions";

  return (
    <div>
      <PageHeader
        title="Cuộc thi & đăng ký"
        description="Quản lý lịch Olympiad hiển thị trên trang chủ và các lượt đăng ký dự thi từ phụ huynh, học sinh."
      />
      <Card>
        <CardContent className="p-4 sm:p-6">
          <Tabs value={tab} onValueChange={(value) => setSearchParams(value === "registrations" ? { tab: value } : {})}>
            <TabsList className="mb-4">
              <TabsTrigger value="competitions" className="gap-2">
                <Trophy className="h-4 w-4" />
                Cuộc thi
              </TabsTrigger>
              <TabsTrigger value="registrations">Đăng ký dự thi</TabsTrigger>
            </TabsList>
            <TabsContent value="competitions">
              <CompetitionsTab />
            </TabsContent>
            <TabsContent value="registrations">
              <RegistrationsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
