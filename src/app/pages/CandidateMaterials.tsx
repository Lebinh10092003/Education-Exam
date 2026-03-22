import { useMemo, useState } from "react";
import { Link } from "react-router";
import { BookOpen, Download, Eye, File, FileText, Search, Video } from "lucide-react";

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

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
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
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
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

  return (
    <div>
      <PageHeader
        title="Learning Materials"
        description="Active study resources available to your candidate account."
        action={
          <Button variant="outline" asChild>
            <Link to="/candidate/dashboard">Back to Dashboard</Link>
          </Button>
        }
      />

      {materialsList.error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {materialsList.error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px,minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest Uploads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestMaterials.length ? (
                latestMaterials.map((material) => (
                  <div key={material.id} className="rounded-lg border border-gray-200 p-3">
                    <p className="truncate text-sm font-medium text-gray-900">{material.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{material.subject.name}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatDate(material.created_at)}</p>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">No active materials yet.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filter Materials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search title or subject..."
                  className="pl-10"
                />
              </div>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Resource Library
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs defaultValue="grid" className="space-y-6">
              <TabsList>
                <TabsTrigger value="grid">Grid View</TabsTrigger>
                <TabsTrigger value="list">List View</TabsTrigger>
              </TabsList>

              <TabsContent value="grid" className="space-y-4">
                {materialsList.isLoading ? (
                  <div className="py-12 text-center text-sm text-gray-500">Loading materials...</div>
                ) : filteredMaterials.length ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {filteredMaterials.map((material) => {
                      const materialType = getMaterialType(material);
                      const TypeIcon = typeIcons[materialType];
                      return (
                        <Card key={material.id} className="border border-gray-200 shadow-none">
                          <CardContent className="space-y-4 p-5">
                            <div className="flex items-start gap-4">
                              <div className="rounded-lg bg-blue-100 p-3">
                                <TypeIcon className="h-6 w-6 text-blue-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-gray-900">{material.title}</h3>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">{material.subject.name}</Badge>
                                  <Badge variant="outline">{materialType}</Badge>
                                </div>
                              </div>
                            </div>

                            <p className="line-clamp-3 text-sm text-gray-600">
                              {material.description || "No description provided."}
                            </p>

                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{formatBytes(material.file_size)}</span>
                              <span>{formatDate(material.created_at)}</span>
                            </div>

                            <div className="flex gap-2">
                              <Button asChild className="flex-1" disabled={!material.file_url}>
                                <a href={material.file_url} target="_blank" rel="noreferrer">
                                  <Eye className="h-4 w-4" />
                                  Open
                                </a>
                              </Button>
                              <Button variant="outline" asChild disabled={!material.file_url}>
                                <a href={material.file_url} download={material.file_name}>
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-gray-500">No materials matched the current filters.</div>
                )}
              </TabsContent>

              <TabsContent value="list">
                {materialsList.isLoading ? (
                  <div className="py-12 text-center text-sm text-gray-500">Loading materials...</div>
                ) : filteredMaterials.length ? (
                  <div className="space-y-3">
                    {filteredMaterials.map((material) => {
                      const materialType = getMaterialType(material);
                      const TypeIcon = typeIcons[materialType];
                      return (
                        <div key={material.id} className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 md:flex-row md:items-center">
                          <div className="rounded-lg bg-blue-100 p-3">
                            <TypeIcon className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900">{material.title}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <Badge variant="outline">{material.subject.name}</Badge>
                              <span>{formatBytes(material.file_size)}</span>
                              <span>{formatDate(material.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" asChild disabled={!material.file_url}>
                              <a href={material.file_url} target="_blank" rel="noreferrer">
                                <Eye className="h-4 w-4" />
                                Open
                              </a>
                            </Button>
                            <Button variant="outline" asChild disabled={!material.file_url}>
                              <a href={material.file_url} download={material.file_name}>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-gray-500">No materials matched the current filters.</div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
