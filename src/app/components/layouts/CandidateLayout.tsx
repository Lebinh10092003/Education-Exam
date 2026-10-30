import { Suspense, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Award,
  Bell,
  BookOpen,
  ChevronDown,
  CircleHelp,
  FileText,
  Home,
  Menu,
  Play,
  X,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "../../auth/useAuth";
import { useAsyncList } from "../../hooks/useAsyncList";
import { apiRequest, isApiError } from "../../lib/http";
import { NOTIFICATION_STATE_CHANGED_EVENT } from "../../lib/notifications";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { RouteContentLoader } from "../RouteContentLoader";
import { StudentSettingsDialog } from "../StudentSettingsDialog";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../ui/utils";
import { BrandLogo } from "../BrandLogo";

type CandidateNavItem = {
  path: string;
  labelKey: string;
  icon: LucideIcon;
};

const primaryNavItems: CandidateNavItem[] = [
  { path: "/candidate", labelKey: "candidate.dashboard", icon: Home },
  { path: "/candidate/exams", labelKey: "candidate.exams", icon: FileText },
  { path: "/candidate/practice", labelKey: "candidate.practice", icon: Play },
  { path: "/candidate/materials", labelKey: "candidate.materials", icon: BookOpen },
  { path: "/candidate/results", labelKey: "candidate.results", icon: Award },
  { path: "/candidate/notifications", labelKey: "candidate.notifications", icon: Bell },
];

const secondaryNavItems: CandidateNavItem[] = [
  { path: "/candidate/help", labelKey: "candidate.help", icon: CircleHelp },
];

const loadUnreadCount = async () => {
  try {
    return await apiRequest<{ unread_count: number }>("/api/v1/notifications/unread-count/");
  } catch (error) {
    if (isApiError(error) && error.status === 403) {
      return { unread_count: 0 };
    }
    throw error;
  }
};

const findActiveLabelKey = (pathname: string) => {
  if (pathname === "/candidate" || pathname === "/candidate/dashboard") {
    return "candidate.dashboard";
  }

  // "/candidate" (Tong quan) chi khop khi trung khit, neu khong moi trang con deu bi nhan la Tong quan.
  const matchedPrimary = primaryNavItems.find(
    (item) => pathname === item.path || (item.path !== "/candidate" && pathname.startsWith(`${item.path}/`)),
  );
  if (matchedPrimary) {
    return matchedPrimary.labelKey;
  }

  const matchedSecondary = secondaryNavItems.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
  if (matchedSecondary) {
    return matchedSecondary.labelKey;
  }

  return "candidate.portal";
};

export function CandidateLayout() {
  const { t } = useTranslation(["common", "navigation"]);
  const location = useLocation();
  const { logout, profile } = useAuth();
  const unreadCount = useAsyncList(loadUnreadCount, []);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const refreshUnreadCount = () => {
      void unreadCount.reload().catch(() => undefined);
    };

    window.addEventListener(NOTIFICATION_STATE_CHANGED_EVENT, refreshUnreadCount);
    return () => window.removeEventListener(NOTIFICATION_STATE_CHANGED_EVENT, refreshUnreadCount);
  }, [unreadCount.reload]);

  if (
    location.pathname.startsWith("/candidate/exam/") ||
    location.pathname.startsWith("/candidate/practice/sessions/")
  ) {
    return (
      <Suspense fallback={<RouteContentLoader fullHeight />}>
        <Outlet />
      </Suspense>
    );
  }

  const displayName = profile?.full_name?.trim() || t("common:fallback.candidateUser");
  const schoolName = profile?.school?.name ?? "";
  const email = profile?.email ?? "";
  const primaryRole = profile?.roles?.[0] ?? "candidate";
  const translatedRole = t(`common:roles.${primaryRole}`, { defaultValue: primaryRole });
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "ST";
  const activeLabelKey = findActiveLabelKey(location.pathname);
  const activeLabel = t(activeLabelKey, { ns: "navigation" });

  const isActive = (path: string) => {
    if (path === "/candidate") {
      return location.pathname === "/candidate" || location.pathname === "/candidate/dashboard";
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const renderNavLink = (
    item: CandidateNavItem,
    options: { compact?: boolean } = {},
  ) => {
    const active = isActive(item.path);
    const badgeValue = item.path === "/candidate/notifications" ? unreadCount.data?.unread_count ?? 0 : 0;
    const label = t(item.labelKey, { ns: "navigation" });

    return (
      <Link
        key={item.path}
        to={item.path}
        className={cn(
          "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors",
          active
            ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500/16 dark:text-blue-100 dark:ring-1 dark:ring-blue-400/25 dark:shadow-none"
            : "text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-[var(--shell-elevated)] dark:hover:text-slate-50",
          options.compact ? "px-4" : "",
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
        {badgeValue > 0 ? (
          <Badge className={cn(
            "ml-auto min-w-5 rounded-full px-1.5 py-0 text-[11px]",
            active ? "bg-white/20 text-white hover:bg-white/20" : "bg-red-500 text-white hover:bg-red-500",
          )}>
            {badgeValue > 99 ? "99+" : badgeValue}
          </Badge>
        ) : null}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_14%,#f8fafc_100%)] text-slate-900 dark:bg-[linear-gradient(180deg,#0f1115_0%,#131923_18%,#0f1115_100%)] dark:text-slate-100">
      {mobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/40 dark:bg-[var(--shell-overlay)] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      <aside
        data-legacy-i18n-ignore="true"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform duration-300 dark:border-white/[0.08] dark:bg-[var(--shell-panel)] lg:hidden ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-white/[0.08]">
          <Link to="/candidate" className="flex min-w-0 items-center">
            <BrandLogo size="sm" subtitle={t("candidate.portal", { ns: "navigation" })} />
          </Link>
          <button
            type="button"
            aria-label="Close navigation panel"
            className="rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[var(--shell-elevated)]"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {schoolName ? (
            <Badge variant="outline" className="mb-5 rounded-full border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/12 dark:text-blue-200">
              {schoolName}
            </Badge>
          ) : null}

          <div className="space-y-1">
            {primaryNavItems.map((item) => renderNavLink(item, { compact: true }))}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-white/[0.08]">
            <div className="space-y-1">
              {secondaryNavItems.map((item) => renderNavLink(item, { compact: true }))}
            </div>
          </div>
        </div>
      </aside>

      <aside
        data-legacy-i18n-ignore="true"
        className="hidden w-72 shrink-0 border-r border-slate-200 bg-white dark:border-white/[0.08] dark:bg-[var(--shell-panel)] lg:flex lg:flex-col"
      >
        <div className="border-b border-slate-200 px-6 py-5 dark:border-white/[0.08]">
          <Link to="/candidate" className="flex min-w-0 items-center">
            <BrandLogo subtitle={t("candidate.portal", { ns: "navigation" })} />
          </Link>
          {schoolName ? (
            <Badge variant="outline" className="mt-4 rounded-full border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/12 dark:text-blue-200">
              {schoolName}
            </Badge>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="space-y-1">
            {primaryNavItems.map((item) => renderNavLink(item))}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-white/[0.08]">
            <div className="space-y-1">{secondaryNavItems.map((item) => renderNavLink(item))}</div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="border-b border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur dark:border-white/[0.08] dark:bg-[var(--shell-panel)]/95 sm:px-6"
          data-legacy-i18n-ignore="true"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Open navigation"
                className="rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[var(--shell-elevated)] lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  {t("currentSection", { ns: "navigation" })}
                </p>
                <p className="truncate text-lg font-semibold text-slate-950 dark:text-slate-100">{activeLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              {!isActive("/candidate/notifications") && (unreadCount.data?.unread_count ?? 0) > 0 ? (
                <Link
                  to="/candidate/notifications"
                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/12 dark:text-red-200"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount.data?.unread_count}
                </Link>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex min-w-0 items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1.5 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[var(--shell-surface)] dark:hover:bg-[var(--shell-elevated)] sm:px-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden min-w-0 text-left sm:block">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{displayName}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{translatedRole}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t("navigation:myAccount")}</DropdownMenuLabel>
                  {email ? <div className="px-2 pb-2 text-xs text-slate-500 dark:text-slate-400">{email}</div> : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/candidate/profile">{t("common:actions.profile")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                    {t("common:actions.settings")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>{t("common:actions.logout")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {settingsOpen ? <StudentSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} /> : null}

        <main className="flex-1 overflow-y-auto px-4 py-8 dark:bg-transparent sm:px-6">
          <Suspense fallback={<RouteContentLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
