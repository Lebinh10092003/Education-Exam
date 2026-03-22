import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  Mail,
  MailOpen,
  RefreshCcw,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useAsyncList } from "../hooks/useAsyncList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMutationState } from "../hooks/useMutationState";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import { emitNotificationStateChanged } from "../lib/notifications";
import { notify } from "../lib/notify";

interface NotificationRecord {
  id: number;
  title: string;
  message: string;
  category: string;
  priority: "low" | "medium" | "high";
  action_url: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

interface NotificationUnreadCount {
  unread_count: number;
}

const PAGE_SIZE = 20;

const CATEGORY_LABELS: Record<string, string> = {
  exam: "Exams",
  submission: "Submissions",
  grading: "Grading",
  user: "Users",
  system: "System",
  alert: "Alerts",
  result: "Results",
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  exam: Bell,
  submission: CheckCircle2,
  grading: Mail,
  user: Users,
  system: Info,
  alert: AlertTriangle,
  result: CheckCircle2,
};

const PRIORITY_STYLES: Record<NotificationRecord["priority"], string> = {
  high: "border-red-300 text-red-700",
  medium: "border-amber-300 text-amber-700",
  low: "border-gray-300 text-gray-700",
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function NotificationCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tabFilter, setTabFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const debouncedSearch = useDebouncedValue(searchQuery, 250);
  const mutation = useMutationState();

  const notificationsList = useAsyncList(
    () =>
      apiRequest<PaginatedResponse<NotificationRecord>>("/api/v1/notifications/", {
        query: {
          page,
          page_size: PAGE_SIZE,
          search: debouncedSearch || undefined,
          category: categoryFilter !== "all" ? categoryFilter : undefined,
          is_read:
            tabFilter === "all"
              ? undefined
              : tabFilter === "read"
                ? true
                : false,
        },
      }),
    [page, debouncedSearch, categoryFilter, tabFilter],
  );

  const totalCount = useAsyncList(
    () => apiRequest<PaginatedResponse<NotificationRecord>>("/api/v1/notifications/", { query: { page_size: 1 } }),
    [],
  );

  const unreadCount = useAsyncList(
    () => apiRequest<NotificationUnreadCount>("/api/v1/notifications/unread-count/"),
    [],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter, tabFilter]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, debouncedSearch, categoryFilter, tabFilter]);

  const notifications = notificationsList.data?.results ?? [];
  const allCount = totalCount.data?.count ?? 0;
  const unreadTotal = unreadCount.data?.unread_count ?? 0;
  const readTotal = Math.max(allCount - unreadTotal, 0);
  const rangeStart = notifications.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = notifications.length === 0 ? 0 : rangeStart + notifications.length - 1;
  const selectedUnreadIds = notifications
    .filter((notification) => selectedIds.includes(notification.id) && !notification.is_read)
    .map((notification) => notification.id);

  const allCurrentSelected = notifications.length > 0 && selectedIds.length === notifications.length;
  const someCurrentSelected = selectedIds.length > 0 && !allCurrentSelected;

  const refreshLists = async () => {
    await Promise.all([
      notificationsList.reload(),
      totalCount.reload(),
      unreadCount.reload(),
    ]);
  };

  const toggleSelection = (notificationId: number) => {
    setSelectedIds((current) =>
      current.includes(notificationId)
        ? current.filter((value) => value !== notificationId)
        : [...current, notificationId],
    );
  };

  const toggleAllOnPage = () => {
    if (allCurrentSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(notifications.map((notification) => notification.id));
  };

  const markOneAsRead = async (notification: NotificationRecord) => {
    if (notification.is_read) {
      return;
    }

    try {
      await mutation.run(() =>
        apiRequest<NotificationRecord>(`/api/v1/notifications/${notification.id}/mark-read/`, {
          method: "POST",
        }),
      );
      await refreshLists();
      emitNotificationStateChanged();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update the notification.";
      notify.error(message);
    }
  };

  const markSelectedAsRead = async () => {
    if (selectedUnreadIds.length === 0) {
      notify.info("Select at least one unread notification.");
      return;
    }

    try {
      await mutation.run(() =>
        Promise.all(
          selectedUnreadIds.map((notificationId) =>
            apiRequest<NotificationRecord>(`/api/v1/notifications/${notificationId}/mark-read/`, {
              method: "POST",
            }),
          ),
        ),
      );
      setSelectedIds([]);
      await refreshLists();
      emitNotificationStateChanged();
      notify.success("Selected notifications marked as read.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update the selected notifications.";
      notify.error(message);
    }
  };

  const markAllAsRead = async () => {
    if (unreadTotal === 0) {
      notify.info("There are no unread notifications.");
      return;
    }

    try {
      await mutation.run(() =>
        apiRequest<{ updated_count: number; unread_count: number }>("/api/v1/notifications/mark-all-read/", {
          method: "POST",
        }),
      );
      setSelectedIds([]);
      await refreshLists();
      emitNotificationStateChanged();
      notify.success("All notifications marked as read.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update notifications.";
      notify.error(message);
    }
  };

  const categoryOptions = useMemo(
    () =>
      Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  return (
    <div>
      <PageHeader
        title="Notification Center"
        description="Review inbox notifications, filter them by category, and keep unread state in sync with the header."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-blue-600 hover:bg-blue-600">{unreadTotal} unread</Badge>
            <Button variant="outline" onClick={() => void refreshLists()} disabled={notificationsList.isLoading}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => void markAllAsRead()} disabled={mutation.isSubmitting || unreadTotal === 0}>
              <MailOpen className="mr-2 h-4 w-4" />
              Mark All as Read
            </Button>
          </div>
        }
      />

      {(notificationsList.error || totalCount.error || unreadCount.error || mutation.error) ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {notificationsList.error ?? totalCount.error ?? unreadCount.error ?? mutation.error}
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-6 p-6">
          <Tabs value={tabFilter} onValueChange={setTabFilter}>
            <TabsList>
              <TabsTrigger value="all">All ({allCount})</TabsTrigger>
              <TabsTrigger value="unread">Unread ({unreadTotal})</TabsTrigger>
              <TabsTrigger value="read">Read ({readTotal})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search notification title or message..."
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full lg:w-[220px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {notifications.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allCurrentSelected ? true : someCurrentSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAllOnPage}
                />
                <span className="text-sm text-gray-700">
                  {selectedIds.length > 0
                    ? `${selectedIds.length} notification(s) selected`
                    : "Select notifications on this page"}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={mutation.isSubmitting || selectedUnreadIds.length === 0}
                onClick={() => void markSelectedAsRead()}
              >
                <MailOpen className="mr-2 h-4 w-4" />
                Mark Selected as Read
              </Button>
            </div>
          ) : null}

          <div className="space-y-3">
            {notificationsList.isLoading ? (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
                <Bell className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-sm font-medium text-gray-900">No notifications matched the current filters.</p>
                <p className="mt-1 text-sm text-gray-500">Try removing some filters or come back after new activity is recorded.</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = CATEGORY_ICONS[notification.category] ?? AlertCircle;
                return (
                  <div
                    key={notification.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      notification.is_read
                        ? "border-gray-200 bg-white"
                        : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={selectedIds.includes(notification.id)}
                        onCheckedChange={() => toggleSelection(notification.id)}
                        className="mt-1"
                      />

                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          notification.priority === "high"
                            ? "bg-red-100 text-red-600"
                            : notification.priority === "medium"
                              ? "bg-amber-100 text-amber-600"
                              : "bg-blue-100 text-blue-600"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                              {!notification.is_read ? (
                                <span className="h-2 w-2 rounded-full bg-blue-600" />
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-gray-600">{notification.message || "No message supplied."}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={PRIORITY_STYLES[notification.priority]}>
                                {notification.priority}
                              </Badge>
                              <Badge variant="outline">{CATEGORY_LABELS[notification.category] ?? notification.category}</Badge>
                              <span className="text-xs text-gray-500">{formatDateTime(notification.created_at)}</span>
                            </div>
                          </div>

                          {!notification.is_read ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void markOneAsRead(notification)}
                              disabled={mutation.isSubmitting}
                            >
                              <MailOpen className="mr-2 h-4 w-4" />
                              Mark as Read
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Showing <strong>{rangeStart}</strong>-<strong>{rangeEnd}</strong> of <strong>{notificationsList.data?.count ?? 0}</strong> notification(s)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!notificationsList.data?.previous || notificationsList.isLoading}
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
                disabled={!notificationsList.data?.next || notificationsList.isLoading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
