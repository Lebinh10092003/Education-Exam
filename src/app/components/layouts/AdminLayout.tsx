import { Suspense, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Activity,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  ChevronDown,
  FileCheck,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Play,
  Search,
  Shield,
  Users,
  UsersRound,
  X,
  type LucideIcon,
  Trophy,
} from "lucide-react";

import { useAuth } from "../../auth/useAuth";
import { useAsyncList } from "../../hooks/useAsyncList";
import { apiRequest } from "../../lib/http";
import { NOTIFICATION_STATE_CHANGED_EVENT } from "../../lib/notifications";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { RouteContentLoader } from "../RouteContentLoader";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { BrandLogo } from "../BrandLogo";

type NavLocation = {
  pathname: string;
  search: string;
};

type NavLeafItem = {
  type: "item";
  icon: LucideIcon;
  labelKey: string;
  path: string;
  isActive?: (location: NavLocation) => boolean;
};

type NavGroupItem = {
  type: "group";
  icon: LucideIcon;
  labelKey: string;
  children: NavLeafItem[];
  isActive: (location: NavLocation) => boolean;
};

type NavEntry = NavLeafItem | NavGroupItem;

const isPathActive = (path: string, location: NavLocation) => {
  if (path === "/dashboard") {
    return location.pathname === "/dashboard";
  }
  return location.pathname === path || location.pathname.startsWith(`${path}/`);
};

const isExamMonitoringHubActive = (location: NavLocation) => location.pathname === "/exams/monitoring";
const isDisciplineActive = (location: NavLocation) =>
  location.pathname === "/discipline" || location.pathname.startsWith("/discipline/");

const isExamListActive = (location: NavLocation) => {
  if (isExamMonitoringHubActive(location) || isDisciplineActive(location)) {
    return false;
  }

  if (location.pathname === "/exams" || location.pathname === "/exams/create") {
    return true;
  }

  return /^\/exams\/[^/]+(?:\/edit|\/assign|\/monitor)?$/.test(location.pathname);
};

const navEntries: NavEntry[] = [
  { type: "item", icon: LayoutDashboard, labelKey: "admin.dashboard", path: "/dashboard" },
  { type: "item", icon: Users, labelKey: "admin.users", path: "/users" },
  { type: "item", icon: UsersRound, labelKey: "admin.groups", path: "/groups" },
  { type: "item", icon: BookOpen, labelKey: "admin.subjects", path: "/subjects" },
  { type: "item", icon: MessageSquareText, labelKey: "admin.questionBank", path: "/question-bank" },
  { type: "item", icon: Trophy, labelKey: "admin.competitions", path: "/competitions" },
  {
    type: "group",
    icon: FileCheck,
    labelKey: "admin.exams",
    isActive: (location) => isExamListActive(location) || isExamMonitoringHubActive(location) || isDisciplineActive(location),
    children: [
      {
        type: "item",
        icon: FileCheck,
        labelKey: "admin.examList",
        path: "/exams",
        isActive: isExamListActive,
      },
      {
        type: "item",
        icon: Play,
        labelKey: "admin.liveMonitoring",
        path: "/exams/monitoring",
        isActive: isExamMonitoringHubActive,
      },
      {
        type: "item",
        icon: Shield,
        labelKey: "admin.discipline",
        path: "/discipline",
        isActive: isDisciplineActive,
      },
    ],
  },
  { type: "item", icon: GraduationCap, labelKey: "admin.manualGrading", path: "/manual-grading" },
  { type: "item", icon: BookMarked, labelKey: "admin.materials", path: "/materials" },
  { type: "item", icon: BarChart3, labelKey: "admin.results", path: "/results" },
  { type: "item", icon: Shield, labelKey: "admin.roles", path: "/roles-permissions" },
  { type: "item", icon: Bell, labelKey: "admin.notifications", path: "/notifications" },
  { type: "item", icon: Activity, labelKey: "admin.audit", path: "/audit" },
];

const navLeaves = navEntries.flatMap((entry) => (entry.type === "group" ? entry.children : [entry]));

export function AdminLayout() {
  const { t } = useTranslation(["navigation", "common"]);
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [expandedNavGroups, setExpandedNavGroups] = useState<Record<string, boolean>>({});
  const { logout, profile } = useAuth();
  const notificationCount = useAsyncList(
    () => apiRequest<{ unread_count: number }>("/api/v1/notifications/unread-count/"),
    [location.pathname],
  );
  const navLocation = {
    pathname: location.pathname,
    search: location.search,
  };
  const displayName = profile?.full_name ?? t("common:fallback.adminUser");
  const primaryRole = profile?.roles?.[0] ?? "user";
  const translatedRole = t(`common:roles.${primaryRole}`, { defaultValue: primaryRole });
  const email = profile?.email ?? "";
  const unreadCount = notificationCount.data?.unread_count ?? 0;
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "EU";
  const getLeafActiveState = (item: NavLeafItem) =>
    item.isActive?.(navLocation) ?? isPathActive(item.path, navLocation);
  const getEntryActiveState = (entry: NavEntry) =>
    entry.type === "group" ? entry.isActive(navLocation) : getLeafActiveState(entry);
  const currentLabel = t(
    navLeaves.find((item) => getLeafActiveState(item))?.labelKey ?? "admin.dashboard",
    { ns: "navigation" },
  );

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const activeGroupKeys = navEntries
      .filter((entry): entry is NavGroupItem => entry.type === "group" && getEntryActiveState(entry))
      .map((entry) => entry.labelKey);

    if (activeGroupKeys.length === 0) {
      return;
    }

    setExpandedNavGroups((previous) => {
      const nextState = { ...previous };
      let hasChanges = false;

      for (const groupKey of activeGroupKeys) {
        if (!nextState[groupKey]) {
          nextState[groupKey] = true;
          hasChanges = true;
        }
      }

      return hasChanges ? nextState : previous;
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleNotificationChange = () => {
      void notificationCount.reload().catch(() => undefined);
    };

    window.addEventListener(NOTIFICATION_STATE_CHANGED_EVENT, handleNotificationChange);
    return () => {
      window.removeEventListener(NOTIFICATION_STATE_CHANGED_EVENT, handleNotificationChange);
    };
  }, [notificationCount.reload]);

  const toggleGroup = (groupKey: string, mobile = false) => {
    if (!mobile && sidebarCollapsed) {
      setSidebarCollapsed(false);
      setExpandedNavGroups((previous) => ({ ...previous, [groupKey]: true }));
      return;
    }

    setExpandedNavGroups((previous) => ({
      ...previous,
      [groupKey]: !(previous[groupKey] ?? false),
    }));
  };

  const renderNavLink = (item: NavLeafItem, options: { compact?: boolean; nested?: boolean; mobile?: boolean } = {}) => {
    const { compact = false, nested = false, mobile = false } = options;
    const isActive = getLeafActiveState(item);
    const label = t(item.labelKey, { ns: "navigation" });
    const paddingClass = compact
      ? "justify-center px-3 py-3"
      : nested
        ? "px-4 py-2"
        : mobile
          ? "px-4 py-3"
          : "px-6 py-3";

    return (
      <Link
        key={`${mobile ? "mobile" : "desktop"}:${item.labelKey}:${item.path}`}
        to={item.path}
        title={compact ? label : undefined}
        className={`flex items-center gap-3 rounded-lg transition-colors ${
          isActive
            ? "bg-blue-50 text-blue-600 dark:bg-blue-500/16 dark:text-blue-100 dark:ring-1 dark:ring-blue-400/25"
            : "text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-[var(--shell-elevated)] dark:hover:text-slate-50"
        } ${paddingClass}`}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {!compact ? <span className="font-medium">{label}</span> : null}
      </Link>
    );
  };

  const renderNavEntry = (entry: NavEntry, options: { mobile?: boolean } = {}) => {
    const { mobile = false } = options;
    if (entry.type === "item") {
      return renderNavLink(entry, { compact: !mobile && sidebarCollapsed, mobile });
    }

    const isActive = getEntryActiveState(entry);
    const label = t(entry.labelKey, { ns: "navigation" });
    const isExpanded = mobile
      ? expandedNavGroups[entry.labelKey] ?? isActive
      : sidebarCollapsed
        ? false
        : expandedNavGroups[entry.labelKey] ?? isActive;

    return (
      <div key={`${mobile ? "mobile" : "desktop"}:${entry.labelKey}`}>
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => toggleGroup(entry.labelKey, mobile)}
          className={`flex w-full items-center gap-3 rounded-lg text-left transition-colors ${
            mobile ? "px-4 py-3" : sidebarCollapsed ? "justify-center px-3 py-3" : "px-6 py-3"
          } ${
            isActive || isExpanded
              ? "bg-blue-50 text-blue-600 dark:bg-blue-500/16 dark:text-blue-100 dark:ring-1 dark:ring-blue-400/25"
              : "text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-[var(--shell-elevated)] dark:hover:text-slate-50"
          }`}
          title={!mobile && sidebarCollapsed ? label : undefined}
        >
          <entry.icon className="h-5 w-5 flex-shrink-0" />
          {!sidebarCollapsed || mobile ? <span className="font-medium">{label}</span> : null}
          {!sidebarCollapsed || mobile ? (
            <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          ) : null}
        </button>
        {isExpanded ? (
          <div
            className={
              mobile
                ? "ml-4 mt-1 space-y-1 border-l border-gray-200 pl-3 dark:border-white/[0.08]"
                : "ml-9 mt-1 space-y-1 border-l border-gray-200 pl-3 dark:border-white/[0.08]"
            }
          >
            {entry.children.map((child) =>
              renderNavLink(child, {
                compact: false,
                nested: true,
                mobile,
              }),
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 dark:bg-[var(--shell-background)] dark:text-slate-100">
      {mobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 dark:bg-[var(--shell-overlay)] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      <aside
        data-legacy-i18n-ignore="true"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-gray-200 bg-white transition-transform duration-300 dark:border-white/[0.08] dark:bg-[var(--shell-panel)] lg:hidden ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-white/[0.08]">
          <Link to="/dashboard" className="flex min-w-0 items-center">
            <BrandLogo size="sm" subtitle="EduExam" />
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-[var(--shell-elevated)]"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-1 px-3">{navEntries.map((entry) => renderNavEntry(entry, { mobile: true }))}</div>
        </nav>
      </aside>

      <aside
        data-legacy-i18n-ignore="true"
        className={`${
          sidebarCollapsed ? "w-20" : "w-64"
        } hidden border-r border-gray-200 bg-white transition-all duration-300 dark:border-white/[0.08] dark:bg-[var(--shell-panel)] lg:flex lg:flex-col`}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6 dark:border-white/[0.08]">
          {!sidebarCollapsed ? (
            <Link to="/dashboard" className="flex min-w-0 items-center">
              <BrandLogo size="sm" subtitle="EduExam" />
            </Link>
          ) : (
            <Link to="/dashboard" className="mx-auto">
              <BrandLogo variant="mark" size="sm" />
            </Link>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-1 px-3">{navEntries.map((entry) => renderNavEntry(entry))}</div>
        </nav>

        <button
          type="button"
          onClick={() => setSidebarCollapsed((previous) => !previous)}
          className="border-t border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-[var(--shell-elevated)]"
        >
          <Menu className="mx-auto h-5 w-5 text-gray-700 dark:text-slate-300" />
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="border-b border-gray-200 bg-white px-4 py-3 dark:border-white/[0.08] dark:bg-[var(--shell-panel)] sm:px-6"
          data-legacy-i18n-ignore="true"
        >
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
                  <span className="text-gray-500 dark:text-slate-400">{t("common:app.name")}</span>
                  <span className="text-gray-300 dark:text-slate-600">/</span>
                  <span className="font-medium text-gray-900 dark:text-slate-100">{currentLabel}</span>
                </div>
                <div className="sm:hidden">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">{t("navigation:currentPage")}</p>
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">{currentLabel}</p>
                </div>
              </div>
              <div className="hidden max-w-md flex-1 md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder={t("navigation:searchPlaceholder")}
                    className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/[0.08] dark:bg-[var(--shell-surface)] dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <LanguageSwitcher />
              <Link to="/notifications" className="relative rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-[var(--shell-elevated)]">
                <Bell className="h-5 w-5 text-gray-700 dark:text-slate-300" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex min-w-0 items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:bg-gray-50 dark:border-white/[0.06] dark:bg-[var(--shell-surface)] dark:hover:bg-[var(--shell-elevated)] sm:px-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden min-w-0 text-left sm:block">
                    <div className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{displayName}</div>
                    <div className="truncate text-xs text-gray-500 dark:text-slate-400">{translatedRole}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56"
                  data-legacy-i18n-ignore="true"
                >
                  <DropdownMenuLabel>{t("navigation:myAccount")}</DropdownMenuLabel>
                  <div className="px-2 pb-2 text-xs text-gray-500 dark:text-slate-400">{email}</div>
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
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder={t("navigation:searchPlaceholder")}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/[0.08] dark:bg-[var(--shell-surface)] dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 dark:bg-[var(--shell-background)] sm:p-6">
          <Suspense fallback={<RouteContentLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
