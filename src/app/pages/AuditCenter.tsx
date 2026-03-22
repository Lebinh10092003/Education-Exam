import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Download,
  Eye,
  FileText,
  LogIn,
  RefreshCcw,
  Search,
  Shield,
  type LucideIcon,
} from "lucide-react";

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { notify } from "../lib/notify";

interface AuditActor {
  id: number | null;
  email: string;
  full_name: string;
}

interface AuditEventRecord {
  id: number;
  actor: AuditActor;
  actor_email: string;
  actor_name: string;
  action: string;
  category: string;
  severity: "info" | "warning" | "error";
  description: string;
  metadata: Record<string, unknown>;
  request_id: string;
  ip_address: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

interface AuditSummary {
  total_events: number;
  warning_events: number;
  error_events: number;
  today_events: number;
}

const PAGE_SIZE = 20;

const CATEGORY_LABELS: Record<string, string> = {
  authentication: "Authentication",
  security: "Security",
  exam: "Exam",
  grading: "Grading",
  results: "Results",
  proctoring: "Proctoring",
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  authentication: LogIn,
  security: Shield,
  exam: FileText,
  grading: Activity,
  results: FileText,
  proctoring: AlertTriangle,
};

const SEVERITY_STYLES: Record<AuditEventRecord["severity"], string> = {
  error: "border-red-300 text-red-700",
  warning: "border-amber-300 text-amber-700",
  info: "border-blue-300 text-blue-700",
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const downloadJson = (events: AuditEventRecord[]) => {
  const blob = new Blob([JSON.stringify(events, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `audit-events-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function AuditCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<AuditEventRecord | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  const events = useAsyncList(
    () =>
      apiRequest<PaginatedResponse<AuditEventRecord>>("/api/v1/audit/events/", {
        query: {
          page,
          page_size: PAGE_SIZE,
          search: debouncedSearch || undefined,
          category: categoryFilter !== "all" ? categoryFilter : undefined,
          severity: severityFilter !== "all" ? severityFilter : undefined,
        },
      }),
    [page, debouncedSearch, categoryFilter, severityFilter],
  );

  const summary = useAsyncList(
    () =>
      apiRequest<AuditSummary>("/api/v1/audit/events/summary/", {
        query: {
          search: debouncedSearch || undefined,
          category: categoryFilter !== "all" ? categoryFilter : undefined,
          severity: severityFilter !== "all" ? severityFilter : undefined,
        },
      }),
    [debouncedSearch, categoryFilter, severityFilter],
  );

  const eventRows = events.data?.results ?? [];
  const rangeStart = eventRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = eventRows.length === 0 ? 0 : rangeStart + eventRows.length - 1;

  const categoryOptions = useMemo(() => {
    const values = new Set<string>([
      "authentication",
      "security",
      "exam",
      "grading",
      "results",
      "proctoring",
      ...eventRows.map((event) => event.category),
    ]);
    return Array.from(values).sort();
  }, [eventRows]);

  const refreshData = async () => {
    try {
      await Promise.all([events.reload(), summary.reload()]);
    } catch {
      notify.error("Unable to refresh audit data.");
    }
  };

  const exportCurrentPage = () => {
    if (eventRows.length === 0) {
      notify.info("There are no audit events to export.");
      return;
    }
    downloadJson(eventRows);
    notify.success("Exported the current audit page.");
  };

  return (
    <div>
      <PageHeader
        title="Audit & Security Center"
        description="Inspect recorded activity from authentication, grading, results, proctoring, and assignment workflows."
        action={
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => void refreshData()} disabled={events.isLoading || summary.isLoading}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={exportCurrentPage}>
              <Download className="mr-2 h-4 w-4" />
              Export Current Page
            </Button>
          </div>
        }
      />

      {(events.error || summary.error) ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {events.error ?? summary.error}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-blue-600" />
              Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{summary.data?.total_events ?? 0}</p>
            <p className="mt-1 text-sm text-gray-600">Matching the current filters</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Error Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{summary.data?.error_events ?? 0}</p>
            <p className="mt-1 text-sm text-gray-600">Highest severity records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Warning Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{summary.data?.warning_events ?? 0}</p>
            <p className="mt-1 text-sm text-gray-600">Events that need review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-green-600" />
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{summary.data?.today_events ?? 0}</p>
            <p className="mt-1 text-sm text-gray-600">Events recorded today</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search action, description, actor, or request id..."
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full lg:w-[220px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {CATEGORY_LABELS[category] ?? category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 md:hidden">
            {events.isLoading ? (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                Loading audit events...
              </div>
            ) : eventRows.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
                <Shield className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-sm font-medium text-gray-900">No audit events matched the current filters.</p>
                <p className="mt-1 text-sm text-gray-500">Recorded actions will appear here once the relevant workflows are used.</p>
              </div>
            ) : (
              eventRows.map((event) => {
                const CategoryIcon = CATEGORY_ICONS[event.category] ?? Activity;
                return (
                  <div key={event.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <CategoryIcon className="h-4 w-4 text-gray-500" />
                          <p className="font-medium text-gray-900">{event.actor.full_name || event.actor_name || "System"}</p>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{event.actor.email || event.actor_email || "No email recorded"}</p>
                      </div>
                      <Badge variant="outline" className={SEVERITY_STYLES[event.severity]}>
                        {event.severity}
                      </Badge>
                    </div>

                    <p className="mt-4 text-sm text-gray-900">{event.description || event.action}</p>
                    <p className="mt-1 text-xs font-mono text-gray-500">{event.action}</p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{CATEGORY_LABELS[event.category] ?? event.category}</Badge>
                      <span className="text-xs text-gray-500">{formatDateTime(event.occurred_at)}</span>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => setSelectedEvent(event)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Detail
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Timestamp</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actor</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Severity</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">IP / Request</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Detail</th>
                </tr>
              </thead>
              <tbody>
                {events.isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                      Loading audit events...
                    </td>
                  </tr>
                ) : eventRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                      No audit events matched the current filters.
                    </td>
                  </tr>
                ) : (
                  eventRows.map((event) => {
                    const CategoryIcon = CATEGORY_ICONS[event.category] ?? Activity;
                    return (
                      <tr key={event.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm text-gray-700">{formatDateTime(event.occurred_at)}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-900">
                            <CategoryIcon className="h-4 w-4 text-gray-500" />
                            <span>{CATEGORY_LABELS[event.category] ?? event.category}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-gray-900">{event.actor.full_name || event.actor_name || "System"}</p>
                          <p className="text-xs text-gray-500">{event.actor.email || event.actor_email || "No email recorded"}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-900">{event.description || event.action}</p>
                          <p className="mt-1 text-xs font-mono text-gray-500">{event.action}</p>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant="outline" className={SEVERITY_STYLES[event.severity]}>
                            {event.severity}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-500">
                          <p>{event.ip_address || "-"}</p>
                          <p className="mt-1 font-mono">{event.request_id || "-"}</p>
                        </td>
                        <td className="px-4 py-4">
                          <Button variant="outline" size="sm" onClick={() => setSelectedEvent(event)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Showing <strong>{rangeStart}</strong>-<strong>{rangeEnd}</strong> of <strong>{events.data?.count ?? 0}</strong> event(s)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!events.data?.previous || events.isLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Page {page}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!events.data?.next || events.isLoading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet open={selectedEvent !== null} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{selectedEvent?.description || selectedEvent?.action}</SheetTitle>
            <SheetDescription>Audit Event #{selectedEvent?.id}</SheetDescription>
          </SheetHeader>

          {selectedEvent ? (
            <div className="space-y-6 py-6">
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge variant="outline">{CATEGORY_LABELS[selectedEvent.category] ?? selectedEvent.category}</Badge>
                  <Badge variant="outline" className={SEVERITY_STYLES[selectedEvent.severity]}>
                    {selectedEvent.severity}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    <span className="font-medium text-gray-900">Action:</span> <span className="font-mono">{selectedEvent.action}</span>
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Occurred at:</span> {formatDateTime(selectedEvent.occurred_at)}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">IP address:</span> {selectedEvent.ip_address || "-"}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Request id:</span> <span className="font-mono">{selectedEvent.request_id || "-"}</span>
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-medium text-gray-900">Actor</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <p>
                    <span className="font-medium text-gray-900">Name:</span>{" "}
                    {selectedEvent.actor.full_name || selectedEvent.actor_name || "System"}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Email:</span>{" "}
                    {selectedEvent.actor.email || selectedEvent.actor_email || "No email recorded"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-medium text-gray-900">Metadata</h3>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">
                  {JSON.stringify(selectedEvent.metadata, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
