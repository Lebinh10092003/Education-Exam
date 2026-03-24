import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { notify } from "../lib/notify";
import { Download, Eye, ExternalLink, FileText, Plus, Search, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

import { MaterialPreviewPanel } from "../components/materials/MaterialPreviewPanel";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
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
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { resolveMaterialFileUrl } from "../lib/materialPreview";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";

interface SubjectOption {
  id: number;
  name: string;
  code: string;
}

interface MaterialRecord {
  id: number;
  title: string;
  description: string;
  subject: SubjectOption;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: {
    id: number | null;
    email: string;
    full_name: string;
  };
  download_count: number;
  is_active: boolean;
  created_at: string;
}

interface MaterialFormState {
  title: string;
  description: string;
  subjectId: string;
  file: File | null;
}

const buildDefaultFormState = (): MaterialFormState => ({
  title: "",
  description: "",
  subjectId: "",
  file: null,
});

const formatFileSize = (bytes: number) => {
  if (!bytes) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function MaterialsLibrary() {
  const { t } = useTranslation(["common"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formState, setFormState] = useState<MaterialFormState>(buildDefaultFormState());
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialRecord | null>(null);
  const [selectedMaterialPreviewUrl, setSelectedMaterialPreviewUrl] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mutation = useMutationState();

  const subjectsList = useAsyncList(
    () => apiRequest<PaginatedResponse<SubjectOption>>("/api/v1/subjects/", { query: { page_size: 100 } }),
    [],
  );
  const materialsList = useAsyncList(
    () =>
      apiRequest<PaginatedResponse<MaterialRecord>>("/api/v1/materials/", {
        query: {
          search: debouncedSearch,
          subject: subjectFilter === "all" ? undefined : subjectFilter,
        },
      }),
    [debouncedSearch, subjectFilter],
  );

  const materials = materialsList.data?.results ?? [];
  const subjects = subjectsList.data?.results ?? [];

  const currentFileLabel = useMemo(() => formState.file?.name ?? "Select a file to upload", [formState.file]);

  const resetForm = () => {
    setFormState(buildDefaultFormState());
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const syncMaterialAccess = async (material: MaterialRecord) => {
    const payload = await apiRequest<{ file_url: string; download_count: number }>(
      `/api/v1/materials/${material.id}/download/`,
    );

    materialsList.setData((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        results: previous.results.map((item) =>
          item.id === material.id
            ? { ...item, file_url: payload.file_url || item.file_url, download_count: payload.download_count }
            : item,
        ),
      };
    });

    setSelectedMaterial((current) =>
      current?.id === material.id
        ? {
            ...current,
            file_url: payload.file_url || current.file_url,
            download_count: payload.download_count,
          }
        : current,
    );

    return resolveMaterialFileUrl(payload.file_url || material.file_url);
  };

  const openMaterialPreview = (material: MaterialRecord) => {
    setSelectedMaterial(material);
    setSelectedMaterialPreviewUrl(resolveMaterialFileUrl(material.file_url));

    void syncMaterialAccess(material)
      .then((resolvedUrl) => {
        setSelectedMaterialPreviewUrl(resolvedUrl);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unable to open material.";
        notify.error(message);
      });
  };

  const openMaterialInNewTab = async (material: MaterialRecord) => {
    try {
      const resolvedUrl = await syncMaterialAccess(material);
      window.open(resolvedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open material.";
      notify.error(message);
    }
  };

  const downloadMaterial = async (material: MaterialRecord) => {
    try {
      const resolvedUrl = await syncMaterialAccess(material);
      const anchor = document.createElement("a");
      anchor.href = resolvedUrl;
      anchor.download = material.file_name;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to download material.";
      notify.error(message);
    }
  };

  const saveMaterial = async () => {
    if (!formState.title.trim() || !formState.subjectId || !formState.file) {
      notify.error("Title, subject, and file are required.");
      return;
    }

    const formData = new FormData();
    formData.append("title", formState.title.trim());
    formData.append("description", formState.description.trim());
    formData.append("subject_id", formState.subjectId);
    formData.append("file", formState.file);

    try {
      await mutation.run(() =>
        apiRequest<MaterialRecord>("/api/v1/materials/", {
          method: "POST",
          body: formData,
        }),
      );
      notify.success("Material uploaded.");
      setIsCreateDialogOpen(false);
      resetForm();
      await materialsList.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload material.";
      notify.error(message);
    }
  };

  const deleteMaterial = async (material: MaterialRecord) => {
    const confirmed = await notify.confirm({
      title: "Delete this material?",
      text: `Material "${material.title}" will be permanently removed.`,
      confirmText: "Delete Material",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmed) {
      return;
    }
    try {
      await mutation.run(() =>
        apiRequest<void>(`/api/v1/materials/${material.id}/`, {
          method: "DELETE",
        }),
      );
      notify.success("Material deleted.");
      if (selectedMaterial?.id === material.id) {
        setSelectedMaterial(null);
      }
      await materialsList.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete material.";
      notify.error(message);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFormState((current) => ({ ...current, file }));
  };

  return (
    <div>
      <PageHeader
        title="Materials Library"
        description="Upload, preview, and manage study materials from the backend."
        action={
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (!open) {
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {t("common:materials.uploadMaterial")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload Study Material</DialogTitle>
                <DialogDescription>Share a file with candidates and examiners.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="material-title">Title</Label>
                  <Input
                    id="material-title"
                    className="mt-2"
                    value={formState.title}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="e.g. Calculus Study Guide"
                  />
                </div>
                <div>
                  <Label htmlFor="material-subject">Subject</Label>
                  <Select
                    value={formState.subjectId}
                    onValueChange={(value) =>
                      setFormState((current) => ({ ...current, subjectId: value }))
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={String(subject.id)}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="material-description">Description</Label>
                  <Textarea
                    id="material-description"
                    className="mt-2"
                    value={formState.description}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, description: event.target.value }))
                    }
                    placeholder="Optional context for students."
                  />
                </div>
                <div>
                  <Label htmlFor="material-file">File</Label>
                  <label
                    className="mt-2 flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-blue-400"
                    htmlFor="material-file"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-700">{currentFileLabel}</p>
                    <p className="text-xs text-gray-500 mt-1">PDF, DOC, PPT, ZIP or other study assets</p>
                  </label>
                  <Input
                    ref={fileInputRef}
                    id="material-file"
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  {t("common:actions.cancel")}
                </Button>
                <Button onClick={() => void saveMaterial()} disabled={mutation.isSubmitting}>
                  {mutation.isSubmitting ? "Uploading..." : t("common:actions.upload")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {(materialsList.error || subjectsList.error || mutation.error) && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {materialsList.error ?? subjectsList.error ?? mutation.error}
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search materials..."
                className="pl-10"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={String(subject.id)}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Title</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Subject</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Size</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Uploaded By</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Downloads</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr key={material.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <button
                            className="font-medium text-gray-900 hover:text-blue-600"
                            onClick={() => openMaterialPreview(material)}
                            type="button"
                          >
                            {material.title}
                          </button>
                          <p className="text-xs text-gray-500">{formatDate(material.created_at)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant="outline">{material.subject.name}</Badge>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-700">
                      {material.mime_type || material.file_name.split(".").at(-1)?.toUpperCase() || "FILE"}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{formatFileSize(material.file_size)}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">
                      {material.uploaded_by.full_name || material.uploaded_by.email || "-"}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{material.download_count}</td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openMaterialPreview(material)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void downloadMaterial(material)}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void deleteMaterial(material)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!materialsList.isLoading && !materials.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={7}>
                      No materials found for the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={selectedMaterial !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMaterial(null);
            setSelectedMaterialPreviewUrl("");
          }
        }}
      >
        <DialogContent className="max-w-6xl sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{selectedMaterial?.title}</DialogTitle>
            <DialogDescription>
              {selectedMaterial?.subject.name} • {selectedMaterial ? formatDate(selectedMaterial.created_at) : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedMaterial ? (
            <div className="grid gap-6 py-2 lg:grid-cols-[minmax(0,1.6fr),320px]">
              <MaterialPreviewPanel
                file_name={selectedMaterial.file_name}
                file_url={selectedMaterialPreviewUrl || selectedMaterial.file_url}
                mime_type={selectedMaterial.mime_type}
                title={selectedMaterial.title}
              />
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  {selectedMaterial.description || "No description provided."}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <p className="text-gray-500">File</p>
                    <p className="font-medium text-gray-900">{selectedMaterial.file_name}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <p className="text-gray-500">Size</p>
                    <p className="font-medium text-gray-900">{formatFileSize(selectedMaterial.file_size)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <p className="text-gray-500">Downloads</p>
                    <p className="font-medium text-gray-900">{selectedMaterial.download_count}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <p className="text-gray-500">Uploaded By</p>
                    <p className="font-medium text-gray-900">
                      {selectedMaterial.uploaded_by.full_name || selectedMaterial.uploaded_by.email || "-"}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500">Type</span>
                    <Badge variant="outline">
                      {selectedMaterial.mime_type || selectedMaterial.file_name.split(".").at(-1)?.toUpperCase() || "FILE"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedMaterial(null);
                setSelectedMaterialPreviewUrl("");
              }}
            >
              {t("common:actions.close")}
            </Button>
            {selectedMaterial ? (
              <>
                <Button variant="outline" onClick={() => void downloadMaterial(selectedMaterial)}>
                  <Download className="w-4 h-4 mr-2" />
                  {t("common:actions.download")}
                </Button>
                <Button onClick={() => void openMaterialInNewTab(selectedMaterial)}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t("common:actions.openInNewTab")}
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
