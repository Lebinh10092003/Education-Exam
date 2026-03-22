import { Suspense, useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  BookOpen,
  MessageSquareText,
  FileCheck,
  Play,
  GraduationCap,
  BookMarked,
  BarChart3,
  Bell,
  Shield,
  Activity,
  Calendar,
  MapPin,
  Search,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useAuth } from "../../auth/useAuth";
import { useAsyncList } from "../../hooks/useAsyncList";
import { apiRequest } from "../../lib/http";
import { NOTIFICATION_STATE_CHANGED_EVENT } from "../../lib/notifications";
import { RouteContentLoader } from "../RouteContentLoader";

const navItems = [
  { icon: LayoutDashboard, labelKey: "admin.dashboard", path: "/" },
  { icon: Users, labelKey: "admin.users", path: "/users" },
  { icon: UsersRound, labelKey: "admin.groups", path: "/groups" },
  { icon: BookOpen, labelKey: "admin.subjects", path: "/subjects" },
  { icon: MessageSquareText, labelKey: "admin.questionBank", path: "/question-bank" },
  { icon: FileCheck, labelKey: "admin.exams", path: "/exams" },
  { icon: Calendar, labelKey: "admin.examPeriods", path: "/exam-periods" },
  { icon: MapPin, labelKey: "admin.examRooms", path: "/exam-rooms" },
  { icon: Play, labelKey: "admin.liveMonitoring", path: "/exams" },
  { icon: GraduationCap, labelKey: "admin.manualGrading", path: "/manual-grading" },
  { icon: BookMarked, labelKey: "admin.materials", path: "/materials" },
  { icon: BarChart3, labelKey: "admin.results", path: "/results" },
  { icon: Shield, labelKey: "admin.roles", path: "/roles-permissions" },
  { icon: Bell, labelKey: "admin.notifications", path: "/notifications" },
  { icon: Activity, labelKey: "admin.audit", path: "/audit" },
];

export function AdminLayout() {
  const { t } = useTranslation(["navigation", "common"]);
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { logout, profile } = useAuth();
  const notificationCount = useAsyncList(
    () => apiRequest<{ unread_count: number }>("/api/v1/notifications/unread-count/"),
    [location.pathname],
  );
  const displayName = profile?.full_name ?? t("common:fallback.adminUser");
  const primaryRole = profile?.roles?.[0] ?? "user";
  const translatedRole = t(`common:roles.${primaryRole}`, { defaultValue: primaryRole });
  const email = profile?.email ?? "";
  const unreadCount = notificationCount.data?.unread_count ?? 0;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "EU";
  const getActiveState = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };
  const currentLabel = t(
    navItems.find((item) => getActiveState(item.path))?.labelKey ?? "admin.dashboard",
    { ns: "navigation" },
  );

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleNotificationChange = () => {
      void notificationCount.reload().catch(() => undefined);
    };

    window.addEventListener(NOTIFICATION_STATE_CHANGED_EVENT, handleNotificationChange);
    return () => {
      window.removeEventListener(NOTIFICATION_STATE_CHANGED_EVENT, handleNotificationChange);
    };
  }, [notificationCount.reload]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {mobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-gray-200 bg-white transition-transform duration-300 lg:hidden ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <span className="text-lg font-bold text-white">E</span>
            </div>
            <span className="text-xl font-bold text-gray-800">EduExam</span>
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {navItems.map((item) => {
            const isActive = getActiveState(item.path);
            return (
              <Link
                key={`mobile:${item.labelKey}:${item.path}`}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  isActive
                    ? "border-r-4 border-blue-600 bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium">{t(item.labelKey, { ns: "navigation" })}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <aside
        className={`${
          sidebarCollapsed ? "w-20" : "w-64"
        } hidden border-r border-gray-200 bg-white transition-all duration-300 lg:flex lg:flex-col`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          {!sidebarCollapsed && (
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <span className="font-bold text-xl text-gray-800">EduExam</span>
            </Link>
          )}
          {sidebarCollapsed && (
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-lg">E</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navItems.map((item) => {
            const isActive = getActiveState(item.path);
            return (
              <Link
                key={`${item.labelKey}:${item.path}`}
                to={item.path}
                className={`flex items-center gap-3 px-6 py-3 transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-600 border-r-4 border-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="font-medium">{t(item.labelKey, { ns: "navigation" })}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-4 border-t border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <Menu className="w-5 h-5 mx-auto text-gray-700" />
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:items-center lg:flex-1">
              <button
                type="button"
                className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="hidden items-center gap-2 text-sm sm:flex">
                  <span className="text-gray-500">{t("common:app.name")}</span>
                  <span className="text-gray-300">/</span>
                  <span className="font-medium text-gray-900">
                    {currentLabel}
                  </span>
                </div>
                <div className="sm:hidden">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{t("navigation:currentPage")}</p>
                  <p className="truncate text-sm font-semibold text-gray-900">{currentLabel}</p>
                </div>
              </div>
              <div className="hidden max-w-md flex-1 md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t("navigation:searchPlaceholder")}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <LanguageSwitcher />
              <Link to="/notifications" className="relative rounded-lg p-2 transition-colors hover:bg-gray-100">
                <Bell className="h-5 w-5 text-gray-700" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50 sm:px-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden min-w-0 text-left sm:block">
                  <div className="truncate text-sm font-medium text-gray-900">
                    {displayName}
                  </div>
                    <div className="truncate text-xs text-gray-500">{translatedRole}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t("navigation:myAccount")}</DropdownMenuLabel>
                  <div className="px-2 pb-2 text-xs text-gray-500">{email}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">{t("common:actions.profile")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>{t("common:actions.settings")}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>{t("common:actions.logout")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-3 md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t("navigation:searchPlaceholder")}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Suspense fallback={<RouteContentLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
