import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import {
  Search,
  Bell,
  Mail,
  AlertCircle,
  CheckCircle,
  Info,
  Trash2,
  MailOpen,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const notifications = [
  {
    id: 1,
    type: "exam",
    title: "Exam Starting Soon",
    message: "Mathematics Final Exam will start in 30 minutes",
    timestamp: "5 minutes ago",
    read: false,
    priority: "high",
    icon: AlertCircle,
    color: "red",
  },
  {
    id: 2,
    type: "submission",
    title: "New Exam Submission",
    message: "Alice Johnson submitted Physics Essay Test",
    timestamp: "15 minutes ago",
    read: false,
    priority: "medium",
    icon: CheckCircle,
    color: "green",
  },
  {
    id: 3,
    type: "system",
    title: "System Update Scheduled",
    message: "System maintenance scheduled for tonight at 2 AM",
    timestamp: "1 hour ago",
    read: false,
    priority: "low",
    icon: Info,
    color: "blue",
  },
  {
    id: 4,
    type: "grading",
    title: "Grading Required",
    message: "5 submissions pending manual grading",
    timestamp: "2 hours ago",
    read: true,
    priority: "medium",
    icon: Mail,
    color: "orange",
  },
  {
    id: 5,
    type: "user",
    title: "New User Registered",
    message: "Bob Smith created an account",
    timestamp: "3 hours ago",
    read: true,
    priority: "low",
    icon: CheckCircle,
    color: "green",
  },
  {
    id: 6,
    type: "exam",
    title: "Exam Completed",
    message: "Chemistry Lab Report has ended. 52/52 candidates completed.",
    timestamp: "5 hours ago",
    read: true,
    priority: "medium",
    icon: CheckCircle,
    color: "green",
  },
  {
    id: 7,
    type: "alert",
    title: "Connection Issues Detected",
    message: "3 candidates experiencing connectivity problems",
    timestamp: "Yesterday",
    read: true,
    priority: "high",
    icon: AlertCircle,
    color: "red",
  },
  {
    id: 8,
    type: "import",
    title: "Import Job Completed",
    message: "User import completed with 245 successful records",
    timestamp: "Yesterday",
    read: true,
    priority: "low",
    icon: Info,
    color: "blue",
  },
];

export function NotificationCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>(
    []
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const toggleNotification = (id: number) => {
    setSelectedNotifications((prev) =>
      prev.includes(id) ? prev.filter((nid) => nid !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedNotifications(
      selectedNotifications.length === notifications.length
        ? []
        : notifications.map((n) => n.id)
    );
  };

  return (
    <div>
      <PageHeader
        title="Notification Center"
        description="View and manage all system notifications"
        action={
          <div className="flex items-center gap-4">
            <Badge variant="default" className="bg-blue-600">
              {unreadCount} Unread
            </Badge>
            <Button variant="outline">
              <Bell className="w-4 h-4 mr-2" />
              Mark All as Read
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList>
              <TabsTrigger value="all">
                All ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
              <TabsTrigger value="read">
                Read ({notifications.length - unreadCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search notifications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="exam">Exams</SelectItem>
                    <SelectItem value="submission">Submissions</SelectItem>
                    <SelectItem value="grading">Grading</SelectItem>
                    <SelectItem value="user">Users</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="alert">Alerts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bulk Actions */}
              {selectedNotifications.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <span className="text-sm text-blue-900">
                    {selectedNotifications.length} notification(s) selected
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <MailOpen className="w-4 h-4 mr-2" />
                      Mark as Read
                    </Button>
                    <Button size="sm" variant="outline">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}

              {/* Notifications List */}
              <div className="space-y-2">
                {notifications.map((notification) => {
                  const Icon = notification.icon;
                  return (
                    <div
                      key={notification.id}
                      className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                        notification.read
                          ? "bg-white border-gray-200"
                          : "bg-blue-50 border-blue-200"
                      } hover:shadow-sm`}
                    >
                      <Checkbox
                        checked={selectedNotifications.includes(notification.id)}
                        onCheckedChange={() => toggleNotification(notification.id)}
                        className="mt-1"
                      />
                      <div
                        className={`p-2 rounded-lg ${
                          notification.color === "red"
                            ? "bg-red-100"
                            : notification.color === "green"
                            ? "bg-green-100"
                            : notification.color === "blue"
                            ? "bg-blue-100"
                            : "bg-orange-100"
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 ${
                            notification.color === "red"
                              ? "text-red-600"
                              : notification.color === "green"
                              ? "text-green-600"
                              : notification.color === "blue"
                              ? "text-blue-600"
                              : "text-orange-600"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3
                                className={`font-medium ${
                                  notification.read
                                    ? "text-gray-900"
                                    : "text-blue-900"
                                }`}
                              >
                                {notification.title}
                              </h3>
                              {!notification.read && (
                                <span className="w-2 h-2 bg-blue-600 rounded-full" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-gray-500">
                                {notification.timestamp}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  notification.priority === "high"
                                    ? "border-red-300 text-red-700"
                                    : notification.priority === "medium"
                                    ? "border-orange-300 text-orange-700"
                                    : "border-gray-300 text-gray-700"
                                }`}
                              >
                                {notification.priority}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {notification.type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {!notification.read && (
                          <Button size="sm" variant="ghost">
                            <MailOpen className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">
                          <Trash2 className="w-4 h-4 text-gray-400" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="mt-6 flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Showing <strong>1-8</strong> of <strong>8</strong>{" "}
                  notifications
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm">
                    1
                  </Button>
                  <Button variant="outline" size="sm">
                    Next
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="unread">
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">
                  Showing {unreadCount} unread notifications
                </p>
              </div>
            </TabsContent>

            <TabsContent value="read">
              <div className="text-center py-12">
                <MailOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">
                  Showing {notifications.length - unreadCount} read notifications
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
