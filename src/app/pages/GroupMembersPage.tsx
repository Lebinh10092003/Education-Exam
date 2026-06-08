import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  Edit,
  Eye,
  Plus,
  Search,
  Trash2,
  Upload,
  UserMinus,
  Users,
} from "lucide-react";
import { notify } from "../lib/notify";

import { PageHeader } from "../components/PageHeader";
import { ImportTemplateActions } from "../components/imports/ImportTemplateActions";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
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

interface SchoolOption {
  id: number;
  name: string;
  code: string;
}

interface RoleOption {
  id: number;
  name: string;
  slug: string;
}

interface GroupMembershipRecord {
  id: number;
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  date_of_birth: string | null;
  school: SchoolOption | null;
  phone_number: string;
  student_class: string;
  ward: string;
  national_exam_subject: string;
  exam_block: string;
  candidate_number: string;
  visible_password: string;
  is_active: boolean;
  created_at: string;
}

interface UserDetailRecord {
  id: number;
  username: string;
  email: string;
  full_name: string;
  status: string;
  is_active: boolean;
  is_staff: boolean;
  phone_number: string;
  date_of_birth: string | null;
  student_class: string;
  ward: string;
  national_exam_subject: string;
  exam_block: string;
  candidate_number: string;
  visible_password: string;
  school: SchoolOption | null;
}

interface ImportSummary {
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

interface CandidateFormState {
  full_name: string;
  username: string;
  email: string;
  password: string;
  phone_number: string;
  date_of_birth: string;
  school_id: string;
  ward: string;
  national_exam_subject: string;
  exam_block: string;
  candidate_number: string;
}

const EMPTY_CANDIDATE_FORM: CandidateFormState = {
  full_name: "",
  username: "",
  email: "",
  password: "",
  phone_number: "",
  date_of_birth: "",
  school_id: "none",
  ward: "",
  national_exam_subject: "",
  exam_block: "",
  candidate_number: "",
};

const PAGE_SIZE = 20;

const emptyMembersPage: PaginatedResponse<GroupMembershipRecord> = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "-";
  }
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(parsedDate);
};

const displayValue = (value: string | null | undefined) => {
  const trimmedValue = (value ?? "").trim();
  return trimmedValue || "-";
};

const toCandidateFormState = (user: UserDetailRecord): CandidateFormState => ({
  full_name: user.full_name || "",
  username: user.username || "",
  email: user.email || "",
  password: "",
  phone_number: user.phone_number || "",
  date_of_birth: user.date_of_birth || "",
  school_id: user.school ? String(user.school.id) : "none",
  ward: user.ward || "",
  national_exam_subject: user.national_exam_subject || "",
  exam_block: user.exam_block || user.student_class || "",
  candidate_number: user.candidate_number || "",
});

type CandidateDialogMode = "create" | "edit" | "detail";

export function GroupMembersPage() {
  const { id } = useParams();
  const groupId = Number(id);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importInputKey, setImportInputKey] = useState(0);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [candidateDialogMode, setCandidateDialogMode] = useState<CandidateDialogMode | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [candidateFormState, setCandidateFormState] =
    useState<CandidateFormState>(EMPTY_CANDIDATE_FORM);

  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const mutation = useMutationState();

  const groupDetail = useAsyncList(
    async () => {
      if (!groupId) {
        throw new Error("Group id is invalid.");
      }
      return apiRequest<GroupRecord>(`/api/v1/groups/${groupId}/`);
    },
    [groupId],
  );

  const membershipsList = useAsyncList(
    async () => {
      if (!groupId) {
        return emptyMembersPage;
      }
      return apiRequest<PaginatedResponse<GroupMembershipRecord>>(
        `/api/v1/groups/${groupId}/memberships/`,
        {
          query: {
            page,
            search: debouncedSearch || undefined,
          },
        },
      );
    },
    [groupId, page, debouncedSearch],
  );

  const rolesList = useAsyncList(
    async () =>
      apiRequest<PaginatedResponse<RoleOption>>("/api/v1/roles/", {
        query: { page_size: 100 },
      }),
    [],
  );

  const schoolsList = useAsyncList(
    async () =>
      apiRequest<PaginatedResponse<SchoolOption>>("/api/v1/schools/", {
        query: { page_size: 100 },
      }),
    [],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const group = groupDetail.data;
  const memberships = membershipsList.data?.results ?? [];
  const schools = schoolsList.data?.results ?? [];
  const candidateRoleId = rolesList.data?.results.find((role) => role.slug === "candidate")?.id;
  const totalCount = membershipsList.data?.count ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : rangeStart + memberships.length - 1;
  const isDialogReadonly = candidateDialogMode === "detail";

  const reloadRoster = async () => {
    await membershipsList.reload();
    await groupDetail.reload();
  };

  const openCreateCandidateDialog = () => {
    setEditingUserId(null);
    setCandidateFormState(EMPTY_CANDIDATE_FORM);
    setCandidateDialogMode("create");
  };

  const loadCandidateForDialog = async (userId: number, mode: CandidateDialogMode) => {
    setEditingUserId(userId);
    setCandidateFormState(EMPTY_CANDIDATE_FORM);
    setCandidateDialogMode(mode);

    try {
      const user = await apiRequest<UserDetailRecord>(`/api/v1/users/${userId}/`);
      const nextFormState = toCandidateFormState(user);
      if (mode === "detail") {
        nextFormState.password = user.visible_password || "";
      }
      setCandidateFormState(nextFormState);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Khong the tai thong tin thi sinh.");
      setCandidateDialogMode(null);
      setEditingUserId(null);
    }
  };

  const closeCandidateDialog = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCandidateDialogMode(null);
      setEditingUserId(null);
      setCandidateFormState(EMPTY_CANDIDATE_FORM);
      mutation.setError(null);
    }
  };

  const buildCandidatePayload = (includeRole: boolean) => {
    const payload: Record<string, unknown> = {
      full_name: candidateFormState.full_name.trim(),
      username: candidateFormState.username.trim(),
      email: candidateFormState.email.trim(),
      phone_number: candidateFormState.phone_number.trim(),
      date_of_birth: candidateFormState.date_of_birth || null,
      school_id:
        candidateFormState.school_id === "none" ? null : Number(candidateFormState.school_id),
      ward: candidateFormState.ward.trim(),
      national_exam_subject: candidateFormState.national_exam_subject.trim(),
      exam_block: candidateFormState.exam_block.trim(),
      student_class: candidateFormState.exam_block.trim(),
      candidate_number: candidateFormState.candidate_number.trim(),
      status: "active",
      is_active: true,
      is_staff: false,
    };

    if (candidateFormState.password.trim()) {
      payload.password = candidateFormState.password.trim();
    }

    if (includeRole) {
      payload.role_ids = candidateRoleId ? [candidateRoleId] : [];
    }

    return payload;
  };

  const saveCandidate = async () => {
    if (!groupId || !candidateDialogMode || candidateDialogMode === "detail") {
      return;
    }
    if (!candidateFormState.full_name.trim()) {
      notify.error("Ho ten la bat buoc.");
      return;
    }
    if (!candidateFormState.username.trim()) {
      notify.error("Tai khoan la bat buoc.");
      return;
    }
    if (candidateDialogMode === "create" && !candidateFormState.password.trim()) {
      notify.error("Mat khau la bat buoc khi tao thi sinh moi.");
      return;
    }

    await mutation.run(async () => {
      if (candidateDialogMode === "create") {
        const newUser = await apiRequest<{ id: number }>("/api/v1/users/", {
          method: "POST",
          body: buildCandidatePayload(true),
        });
        await apiRequest(`/api/v1/groups/${groupId}/memberships/`, {
          method: "POST",
          body: {
            user_id: newUser.id,
            is_active: true,
          },
        });
        notify.success("Da tao thi sinh va them vao nhom.");
      } else if (editingUserId) {
        await apiRequest(`/api/v1/users/${editingUserId}/`, {
          method: "PATCH",
          body: buildCandidatePayload(false),
        });
        notify.success("Da cap nhat thong tin thi sinh.");
      }

      closeCandidateDialog(false);
      await reloadRoster();
    });
  };

  const removeMember = async (member: GroupMembershipRecord) => {
    if (!groupId) {
      return;
    }
    const confirmed = await notify.confirm({
      title: "Bo thi sinh khoi nhom?",
      text: `Bo "${member.full_name}" khoi nhom "${group?.name ?? ""}"?`,
      confirmText: "Bo khoi nhom",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) {
      return;
    }

    await mutation.run(async () => {
      await apiRequest(`/api/v1/groups/${groupId}/memberships/`, {
        method: "DELETE",
        query: { user_id: member.user_id },
      });
      await reloadRoster();
      notify.success("Da bo thi sinh khoi nhom.");
    });
  };

  const deleteCandidateAccount = async (member: GroupMembershipRecord) => {
    const confirmed = await notify.confirm({
      title: "Xoa tai khoan thi sinh?",
      text: `Tai khoan "${member.full_name}" se bi xoa vinh vien khoi he thong.`,
      confirmText: "Xoa tai khoan",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) {
      return;
    }

    await mutation.run(async () => {
      await apiRequest(`/api/v1/users/${member.user_id}/`, {
        method: "DELETE",
      });
      await reloadRoster();
      notify.success("Da xoa tai khoan thi sinh.");
    });
  };

  const importMembers = async () => {
    if (!groupId || !importFile) {
      notify.error("Chon file CSV truoc khi import.");
      return;
    }

    await mutation.run(async () => {
      const formData = new FormData();
      formData.append("file", importFile);
      const summary = await apiRequest<ImportSummary>(
        `/api/v1/groups/${groupId}/memberships/import/`,
        {
          method: "POST",
          body: formData,
        },
      );

      setImportSummary(summary);
      setImportFile(null);
      setImportInputKey((previous) => previous + 1);
      await reloadRoster();
      notify.success(
        summary.failed_rows
          ? `Import ${summary.assigned_users} thanh vien, co ${summary.failed_rows} dong loi.`
          : `Da import ${summary.assigned_users} thanh vien.`,
      );
    });
  };

  return (
    <div>
      <PageHeader
        title={group ? `Thanh vien - ${group.name}` : "Thanh vien nhom"}
        description="Danh sach thi sinh day du thong tin, tai khoan va mat khau cho quan tri vien."
        action={
          <>
            <Button asChild variant="outline">
              <Link to="/groups">
                <ArrowLeft className="h-4 w-4" />
                Ve danh sach nhom
              </Link>
            </Button>
            <Button onClick={openCreateCandidateDialog}>
              <Plus className="h-4 w-4" />
              Them thi sinh
            </Button>
          </>
        }
      />

      {(groupDetail.error || membershipsList.error || rolesList.error || schoolsList.error || mutation.error) && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {groupDetail.error || membershipsList.error || rolesList.error || schoolsList.error || mutation.error}
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Tim theo ten, email, tai khoan, SBD, truong..."
                className="pl-10"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <Badge variant="outline" className="w-fit">
              <Users className="mr-1 h-4 w-4" />
              {totalCount} thanh vien
            </Badge>
          </div>

          <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">Import thanh vien tu CSV</h3>
                <p className="mt-1 text-xs text-gray-600">
                  Ho tro cac cot: full_name, username, password, date_of_birth, school_code,
                  ward, national_exam_subject, exam_block, candidate_number, email, phone_number.
                </p>
              </div>
              <ImportTemplateActions template={groupMembershipImportTemplate} selectedFormat="csv" />
            </div>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
              <Input
                key={importInputKey}
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              />
              <Button
                variant="outline"
                onClick={() => void importMembers()}
                disabled={mutation.isSubmitting || !importFile}
                className="lg:w-auto"
              >
                <Upload className="h-4 w-4" />
                {mutation.isSubmitting && importFile ? "Dang import..." : "Import CSV"}
              </Button>
            </div>
            {importFile ? (
              <p className="mt-2 text-xs text-gray-500">File da chon: {importFile.name}</p>
            ) : null}
          </div>

          {importSummary ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Ket qua import gan nhat</h3>
                <Badge variant={importSummary.failed_rows ? "secondary" : "outline"}>
                  {importSummary.failed_rows ? `${importSummary.failed_rows} dong loi` : "Thanh cong"}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-600 md:grid-cols-3">
                <div>Tong dong: <strong>{importSummary.total_rows}</strong></div>
                <div>Tao moi: <strong>{importSummary.created_users}</strong></div>
                <div>Cap nhat: <strong>{importSummary.updated_users}</strong></div>
                <div>Gan nhom: <strong>{importSummary.assigned_users}</strong></div>
                <div>Bo qua: <strong>{importSummary.skipped_rows}</strong></div>
                <div>Loi: <strong>{importSummary.failed_rows}</strong></div>
              </div>
              {importSummary.errors.length ? (
                <div className="mt-4 max-h-40 space-y-2 overflow-y-auto">
                  {importSummary.errors.map((error) => (
                    <div
                      key={`${error.row_number}:${error.identifier}`}
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                    >
                      Dong {error.row_number} {error.identifier ? `(${error.identifier})` : ""}: {error.message}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 px-4">STT</TableHead>
                <TableHead className="min-w-56">Ho ten</TableHead>
                <TableHead className="min-w-32">Ngay sinh</TableHead>
                <TableHead className="min-w-56">Truong</TableHead>
                <TableHead className="min-w-36">Xa/Phuong</TableHead>
                <TableHead className="min-w-44">Mon thi quoc gia</TableHead>
                <TableHead className="min-w-28">Khoi thi</TableHead>
                <TableHead className="min-w-28">SBD</TableHead>
                <TableHead className="min-w-56">Email lien lac</TableHead>
                <TableHead className="min-w-36">SDT lien lac</TableHead>
                <TableHead className="min-w-36">Tai khoan</TableHead>
                <TableHead className="min-w-36">Mat khau</TableHead>
                <TableHead className="min-w-40 text-right">Thao tac</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membershipsList.isLoading ? (
                <TableRow>
                  <TableCell colSpan={13} className="h-32 text-center text-sm text-gray-500">
                    Dang tai danh sach thanh vien...
                  </TableCell>
                </TableRow>
              ) : memberships.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="h-32 text-center text-sm text-gray-500">
                    Chua co thanh vien nao phu hop.
                  </TableCell>
                </TableRow>
              ) : (
                memberships.map((member, index) => (
                  <TableRow key={member.id}>
                    <TableCell className="px-4 text-gray-500">{rangeStart + index}</TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-900">{displayValue(member.full_name)}</div>
                    </TableCell>
                    <TableCell>{formatDate(member.date_of_birth)}</TableCell>
                    <TableCell>
                      {member.school ? `${member.school.name} (${member.school.code})` : "-"}
                    </TableCell>
                    <TableCell>{displayValue(member.ward)}</TableCell>
                    <TableCell>{displayValue(member.national_exam_subject)}</TableCell>
                    <TableCell>{displayValue(member.exam_block || member.student_class)}</TableCell>
                    <TableCell>{displayValue(member.candidate_number)}</TableCell>
                    <TableCell>{displayValue(member.email)}</TableCell>
                    <TableCell>{displayValue(member.phone_number)}</TableCell>
                    <TableCell className="font-mono text-xs">{displayValue(member.username)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {displayValue(member.visible_password)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Xem chi tiet"
                          onClick={() => void loadCandidateForDialog(member.user_id, "detail")}
                        >
                          <Eye className="h-4 w-4 text-slate-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Sua thi sinh"
                          onClick={() => void loadCandidateForDialog(member.user_id, "edit")}
                        >
                          <Edit className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Bo khoi nhom"
                          onClick={() => void removeMember(member)}
                          disabled={mutation.isSubmitting}
                        >
                          <UserMinus className="h-4 w-4 text-amber-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Xoa tai khoan"
                          onClick={() => void deleteCandidateAccount(member)}
                          disabled={mutation.isSubmitting}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Hien thi <strong>{rangeStart}-{rangeEnd}</strong> tren <strong>{totalCount}</strong> thanh vien
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!membershipsList.data?.previous || membershipsList.isLoading}
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
            disabled={!membershipsList.data?.next || membershipsList.isLoading}
            onClick={() => setPage((previous) => previous + 1)}
          >
            Sau
          </Button>
        </div>
      </div>

      <Dialog open={Boolean(candidateDialogMode)} onOpenChange={closeCandidateDialog}>
        <DialogContent className="max-h-[92dvh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {candidateDialogMode === "create"
                ? "Them thi sinh"
                : candidateDialogMode === "edit"
                  ? "Sua thong tin thi sinh"
                  : "Chi tiet thi sinh"}
            </DialogTitle>
            <DialogDescription>
              Quan tri vien co the xem tai khoan, mat khau va cap nhat thong tin thanh vien.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div>
              <Label htmlFor="candidate-full-name">Ho ten</Label>
              <Input
                id="candidate-full-name"
                className="mt-2"
                value={candidateFormState.full_name}
                disabled={isDialogReadonly}
                onChange={(event) =>
                  setCandidateFormState((previous) => ({
                    ...previous,
                    full_name: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-date-of-birth">Ngay sinh</Label>
              <Input
                id="candidate-date-of-birth"
                type="date"
                className="mt-2"
                value={candidateFormState.date_of_birth}
                disabled={isDialogReadonly}
                onChange={(event) =>
                  setCandidateFormState((previous) => ({
                    ...previous,
                    date_of_birth: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-school">Truong</Label>
              <Select
                value={candidateFormState.school_id}
                disabled={isDialogReadonly}
                onValueChange={(value) =>
                  setCandidateFormState((previous) => ({ ...previous, school_id: value }))
                }
              >
                <SelectTrigger id="candidate-school" className="mt-2">
                  <SelectValue placeholder="Chon truong" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Khong gan truong</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={String(school.id)}>
                      {school.name} ({school.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="candidate-ward">Xa/Phuong</Label>
              <Input
                id="candidate-ward"
                className="mt-2"
                value={candidateFormState.ward}
                disabled={isDialogReadonly}
                onChange={(event) =>
                  setCandidateFormState((previous) => ({ ...previous, ward: event.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-national-subject">Mon thi quoc gia</Label>
              <Input
                id="candidate-national-subject"
                className="mt-2"
                value={candidateFormState.national_exam_subject}
                disabled={isDialogReadonly}
                onChange={(event) =>
                  setCandidateFormState((previous) => ({
                    ...previous,
                    national_exam_subject: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-exam-block">Khoi thi</Label>
              <Input
                id="candidate-exam-block"
                className="mt-2"
                value={candidateFormState.exam_block}
                disabled={isDialogReadonly}
                onChange={(event) =>
                  setCandidateFormState((previous) => ({
                    ...previous,
                    exam_block: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-number">SBD</Label>
              <Input
                id="candidate-number"
                className="mt-2"
                value={candidateFormState.candidate_number}
                disabled={isDialogReadonly}
                onChange={(event) =>
                  setCandidateFormState((previous) => ({
                    ...previous,
                    candidate_number: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-email">Email lien lac</Label>
              <Input
                id="candidate-email"
                className="mt-2"
                value={candidateFormState.email}
                disabled={isDialogReadonly}
                onChange={(event) =>
                  setCandidateFormState((previous) => ({ ...previous, email: event.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-phone">SDT lien lac</Label>
              <Input
                id="candidate-phone"
                className="mt-2"
                value={candidateFormState.phone_number}
                disabled={isDialogReadonly}
                onChange={(event) =>
                  setCandidateFormState((previous) => ({
                    ...previous,
                    phone_number: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-username">Tai khoan</Label>
              <Input
                id="candidate-username"
                className="mt-2 font-mono"
                value={candidateFormState.username}
                disabled={isDialogReadonly}
                onChange={(event) =>
                  setCandidateFormState((previous) => ({
                    ...previous,
                    username: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-password">
                {candidateDialogMode === "edit" ? "Mat khau moi" : "Mat khau"}
              </Label>
              <Input
                id="candidate-password"
                type={isDialogReadonly ? "text" : "password"}
                className="mt-2 font-mono"
                value={candidateFormState.password}
                disabled={isDialogReadonly}
                placeholder={
                  candidateDialogMode === "edit"
                    ? "De trong neu khong doi"
                    : "Nhap mat khau"
                }
                onChange={(event) =>
                  setCandidateFormState((previous) => ({
                    ...previous,
                    password: event.target.value,
                  }))
                }
              />
              {candidateDialogMode === "detail" ? (
                <p className="mt-2 text-xs text-gray-500">
                  Mat khau hien thi trong bang roster. Neu tai khoan cu chua co du lieu, o nay co the trong.
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => closeCandidateDialog(false)}>
              Dong
            </Button>
            {candidateDialogMode !== "detail" ? (
              <Button onClick={() => void saveCandidate()} disabled={mutation.isSubmitting}>
                {mutation.isSubmitting ? "Dang luu..." : "Luu thong tin"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
