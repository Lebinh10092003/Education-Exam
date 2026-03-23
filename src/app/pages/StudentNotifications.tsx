import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  MailOpen,
  RefreshCcw,
  Search,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
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
import { apiRequest, isApiError, type PaginatedResponse } from "../lib/http";
import { emitNotificationStateChanged } from "../lib/notifications";
import { notify } from "../lib/notify";

interface NotificationRecord {
  id: number;
  title: string;
  message: string;
  category: string;
  priority: "low" | "medium" | "high";
  is_read: boolean;
  created_at: string;
}

interface NotificationUnreadCount {
  unread_count: number;
}

interface StudentNotificationsPayload {
  list: PaginatedResponse<NotificationRecord>;
  unreadCount: number;
  accessDenied: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  exam: "Exams",
  submission: "Submissions",
  grading: "Grading",
  user: "Account",
  system: "System",
  alert: "Alerts",
  result: "Results",
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  exam: Bell,
  submission: CheckCircle2,
  grading: Bell,
  user: Bell,
  system: Bell,
  alert: Bell,
  result: CheckCircle2,
};

const emptyNotifications: PaginatedResponse<NotificationRecord> = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function StudentNotifications() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tabFilter, setTabFilter] = useState("all");
  const debouncedSearch = useDebouncedValue(searchQuery, 250);
  const mutation = useMutationState();

  const notificationsState = useAsyncList(
    async (): Promise<StudentNotificationsPayload> => {
      try {
        const [list, unread] = await Promise.all([
          apiRequest<PaginatedResponse<NotificationRecord>>("/api/v1/notifications/", {
            query: {
              page_size: 50,
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
          apiRequest<NotificationUnreadCount>("/api/v1/notifications/unread-count/"),
        ]);

        return {
          list,
          unreadCount: unread.unread_count,
          accessDenied: false,
        };
      } catch (error) {
        if (isApiError(error) && error.status === 403) {
          return {
            list: emptyNotifications,
            unreadCount: 0,
            accessDenied: true,
          };
        }
        throw error;
      }
    },
    [debouncedSearch, categoryFilter, tabFilter],
  );

  useEffect(() => {
    emitNotificationStateChanged();
  }, [notificationsState.data?.unreadCount]);

  const notifications = notificationsState.data?.list.results ?? [];
  const unreadCount = notificationsState.data?.unreadCount ?? 0;
  const totalCount = notificationsState.data?.list.count ?? 0;
  const categoryOptions = useMemo(
    () =>
      Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  const markNotificationAsRead = async (notification: NotificationRecord) => {
    if (notification.is_read || notificationsState.data?.accessDenied) {
      return;
    }

    try {
      await mutation.run(() =>
        apiRequest(`/api/v1/notifications/${notification.id}/mark-read/`, {
          method: "POST",
        }),
      );
      await notificationsState.reload();
      emitNotificationStateChanged();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update the notification.";
      notify.error(message);
    }
  };

  const markAllAsRead = async () => {
    if (notificationsState.data?.accessDenied || unreadCount === 0) {
      return;
    }

    try {
      await mutation.run(() =>
        apiRequest("/api/v1/notifications/mark-all-read/", {
          method: "POST",
        }),
      );
      await notificationsState.reload();
      emitNotificationStateChanged();
      notify.success("All notifications marked as read.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update notifications.";
      notify.error(message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Exam reminders, result updates, and student-facing alerts in one inbox."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-blue-600 text-white hover:bg-blue-600">{unreadCount} unread</Badge>
            <Button variant="outline" onClick={() => void notificationsState.reload()} disabled={notificationsState.isLoading}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => void markAllAsRead()} disabled={mutation.isSubmitting || unreadCount === 0}>
              <MailOpen className="h-4 w-4" />
              Mark All as Read
            </Button>
          </div>
        }
      />

      {notificationsState.error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {notificationsState.error}
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-6 p-6">
          <Tabs value={tabFilter} onValueChange={setTabFilter}>
            <TabsList>
              <TabsTrigger value="all">All ({totalCount})</TabsTrigger>
              <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
              <TabsTrigger value="read">Read ({Math.max(totalCount - unreadCount, 0)})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search notifications..."
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[220px]">
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

          {notificationsState.data?.accessDenied ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center">
              <Bell className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-4 text-base font-medium text-slate-900">Notifications are not enabled for this student account yet.</p>
              <p className="mt-2 text-sm text-slate-500">
                The screen is ready, but your current role does not have access to the notifications API.
              </p>
            </div>
          ) : notificationsState.isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Loading notifications...
            </div>
          ) : notifications.length ? (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const Icon = CATEGORY_ICONS[notification.category] ?? Bell;

                return (
                  <div
                    key={notification.id}
                    className={`rounded-2xl border p-5 ${
                      notification.is_read
                        ? "border-slate-200 bg-white"
                        : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">{notification.title}</p>
                            {!notification.is_read ? <span className="h-2 w-2 rounded-full bg-blue-600" /> : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{notification.message || "No message supplied."}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <Badge variant="outline">
                              {CATEGORY_LABELS[notification.category] ?? notification.category}
                            </Badge>
                            <span>{formatDateTime(notification.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      {!notification.is_read ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void markNotificationAsRead(notification)}
                          disabled={mutation.isSubmitting}
                        >
                          <MailOpen className="h-4 w-4" />
                          Mark as Read
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <Bell className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-4 text-base font-medium text-slate-900">No notifications matched the current filters.</p>
              <p className="mt-2 text-sm text-slate-500">New exam and result updates will appear here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
