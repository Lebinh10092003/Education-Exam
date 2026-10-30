import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { BookOpen, Eye, File, FileText, Search, Video } from "lucide-react";

import { MaterialPreviewPanel } from "../components/materials/MaterialPreviewPanel";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { apiRequest, type PaginatedResponse } from "../lib/http";

interface CandidateMaterialRecord {
  id: number;
  title: string;
  description: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  download_count: number;
  created_at: string;
  subject: {
    id: number;
    name: string;
    code: string;
  };
}

const normalizeMaterialLocale = (locale: string) => (locale.toLowerCase().startsWith("vi") ? "vi-VN" : "en-GB");

const formatDate = (value: string, locale: string) =>
  new Intl.DateTimeFormat(normalizeMaterialLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const formatBytes = (size: number) => {
  if (!size) {
    return "Unknown size";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const getMaterialType = (material: CandidateMaterialRecord) => {
  if (material.mime_type.startsWith("video/")) {
    return "video";
  }
  if (material.mime_type.startsWith("image/")) {
    return "image";
  }
  return "document";
};

const typeIcons = {
  document: FileText,
  video: Video,
  image: File,
};

export function CandidateMaterials() {
  const { t, i18n } = useTranslation("common");
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  const materialsList = useAsyncList(
    () =>
      apiRequest<PaginatedResponse<CandidateMaterialRecord>>("/api/v1/my-materials/", {
        query: {
          page_size: 100,
          search: debouncedSearch,
        },
      }),
    [debouncedSearch],
  );

  const materials = materialsList.data?.results ?? [];
  const subjects = useMemo(
    () => Array.from(new Set(materials.map((material) => material.subject.name))).sort(),
    [materials],
  );

  const filteredMaterials = useMemo(() => {
    return materials.filter((material) => {
      const matchesSubject = subjectFilter === "all" || material.subject.name === subjectFilter;
      const matchesType = typeFilter === "all" || getMaterialType(material) === typeFilter;
      return matchesSubject && matchesType;
    });
  }, [materials, subjectFilter, typeFilter]);

  const latestMaterials = filteredMaterials.slice(0, 3);
  const currentLocale = i18n.resolvedLanguage ?? i18n.language;
  const selectedMaterial = useMemo(
    () => filteredMaterials.find((material) => material.id === selectedMaterialId) ?? filteredMaterials[0] ?? null,
    [filteredMaterials, selectedMaterialId],
  );
  const typeLabels = {
    document: t("materials.typeBadge.document"),
    video: t("materials.typeBadge.video"),
    image: t("materials.typeBadge.image"),
  } as const;

  useEffect(() => {
    if (!filteredMaterials.length) {
      setSelectedMaterialId(null);
      return;
    }

    if (!filteredMaterials.some((material) => material.id === selectedMaterialId)) {
      setSelectedMaterialId(filteredMaterials[0].id);
    }
  }, [filteredMaterials, selectedMaterialId]);

  return (
    <div>
      <PageHeader
        title={t("materials.pageTitle")}
        description={t("materials.pageDescription")}
        action={
          <Button variant="outline" asChild>
            <Link to="/candidate/dashboard">{t("materials.backToDashboard")}</Link>
          </Button>
        }
      />

      {materialsList.error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {materialsList.error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("materials.latestUploads")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestMaterials.length ? (
                latestMaterials.map((material) => (
                  <div key={material.id} className="rounded-lg border border-gray-200 p-3">
                    <p className="truncate text-sm font-medium text-gray-900">{material.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{material.subject.name}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatDate(material.created_at, currentLocale)}</p>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">{t("materials.emptyLatest")}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("materials.filterTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("materials.searchPlaceholder")}
                  className="pl-10"
                />
              </div>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("materials.subjectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("materials.allSubjects")}</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("materials.typePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("materials.allTypes")}</SelectItem>
                  <SelectItem value="document">{t("materials.typeFilter.document")}</SelectItem>
                  <SelectItem value="video">{t("materials.typeFilter.video")}</SelectItem>
                  <SelectItem value="image">{t("materials.typeFilter.image")}</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("materials.previewTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {selectedMaterial ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{selectedMaterial.subject.name}</Badge>
                        <Badge variant="outline">{typeLabels[getMaterialType(selectedMaterial)]}</Badge>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{selectedMaterial.title}</h3>
                        <p className="mt-1 text-sm text-gray-600">
                          {selectedMaterial.description || t("materials.noDescription")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>{selectedMaterial.file_size ? formatBytes(selectedMaterial.file_size) : t("materials.unknownSize")}</p>
                      <p className="mt-1">{formatDate(selectedMaterial.created_at, currentLocale)}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {t("materials.webOnlyNotice")}
                  </div>
                  <MaterialPreviewPanel
                    disableDownloadControls
                    fallbackMessage={t("materials.webOnlyFallback")}
                    file_name={selectedMaterial.file_name}
                    file_url={selectedMaterial.file_url}
                    mime_type={selectedMaterial.mime_type}
                    title={selectedMaterial.title}
                  />
                </>
              ) : (
                <div className="py-12 text-center text-sm text-gray-500">{t("materials.previewEmpty")}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                {t("materials.libraryTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Tabs defaultValue="grid" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="grid">{t("materials.gridView")}</TabsTrigger>
                  <TabsTrigger value="list">{t("materials.listView")}</TabsTrigger>
                </TabsList>

                <TabsContent value="grid" className="space-y-4">
                  {materialsList.isLoading ? (
                    <div className="py-12 text-center text-sm text-gray-500">{t("materials.loadingList")}</div>
                  ) : filteredMaterials.length ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {filteredMaterials.map((material) => {
                        const materialType = getMaterialType(material);
                        const TypeIcon = typeIcons[materialType];
                        const isSelected = selectedMaterial?.id === material.id;
                        return (
                          <Card
                            key={material.id}
                            className={`border shadow-none transition-colors ${
                              isSelected ? "border-blue-300 bg-blue-50/50" : "border-gray-200"
                            }`}
                          >
                            <CardContent className="space-y-4 p-5">
                              <div className="flex items-start gap-4">
                                <div className="rounded-lg bg-blue-100 p-3">
                                  <TypeIcon className="h-6 w-6 text-blue-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-semibold text-gray-900">{material.title}</h3>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">{material.subject.name}</Badge>
                                    <Badge variant="outline">{typeLabels[materialType]}</Badge>
                                  </div>
                                </div>
                              </div>

                              <p className="line-clamp-3 text-sm text-gray-600">
                                {material.description || t("materials.noDescription")}
                              </p>

                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{material.file_size ? formatBytes(material.file_size) : t("materials.unknownSize")}</span>
                                <span>{formatDate(material.created_at, currentLocale)}</span>
                              </div>

                              <Button
                                className="w-full"
                                disabled={!material.file_url}
                                onClick={() => setSelectedMaterialId(material.id)}
                                variant={isSelected ? "default" : "outline"}
                              >
                                <Eye className="h-4 w-4" />
                                {t("materials.viewInPage")}
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-sm text-gray-500">{t("materials.noMatches")}</div>
                  )}
                </TabsContent>

                <TabsContent value="list">
                  {materialsList.isLoading ? (
                    <div className="py-12 text-center text-sm text-gray-500">{t("materials.loadingList")}</div>
                  ) : filteredMaterials.length ? (
                    <div className="space-y-3">
                      {filteredMaterials.map((material) => {
                        const materialType = getMaterialType(material);
                        const TypeIcon = typeIcons[materialType];
                        const isSelected = selectedMaterial?.id === material.id;
                        return (
                          <div
                            key={material.id}
                            className={`flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center ${
                              isSelected ? "border-blue-300 bg-blue-50/50" : "border-gray-200"
                            }`}
                          >
                            <div className="rounded-lg bg-blue-100 p-3">
                              <TypeIcon className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900">{material.title}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                <Badge variant="outline">{material.subject.name}</Badge>
                                <span>{material.file_size ? formatBytes(material.file_size) : t("materials.unknownSize")}</span>
                                <span>{formatDate(material.created_at, currentLocale)}</span>
                              </div>
                            </div>
                            <Button
                              className="w-full md:w-auto"
                              disabled={!material.file_url}
                              onClick={() => setSelectedMaterialId(material.id)}
                              variant={isSelected ? "default" : "outline"}
                            >
                              <Eye className="h-4 w-4" />
                              {t("materials.viewInPage")}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-sm text-gray-500">{t("materials.noMatches")}</div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
