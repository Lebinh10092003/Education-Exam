import { Suspense } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { Award, BookOpen, LayoutDashboard, LogOut, PlayCircle } from "lucide-react";

import { useAuth } from "../../auth/useAuth";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { RouteContentLoader } from "../RouteContentLoader";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

const navItems = [
  { labelKey: "candidate.dashboard", path: "/candidate/dashboard", icon: LayoutDashboard },
  { labelKey: "candidate.practice", path: "/candidate/practice", icon: PlayCircle },
  { labelKey: "candidate.results", path: "/candidate/results", icon: Award },
  { labelKey: "candidate.materials", path: "/candidate/materials", icon: BookOpen },
];

export function CandidateLayout() {
  const { t } = useTranslation(["navigation", "common"]);
  const location = useLocation();
  const { logout, profile } = useAuth();

  if (location.pathname.startsWith("/candidate/exam/")) {
    return (
      <Suspense fallback={<RouteContentLoader fullHeight />}>
        <Outlet />
      </Suspense>
    );
  }

  const displayName = profile?.full_name ?? t("common:fallback.candidateUser");
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "CA";
  const schoolName = profile?.school?.name ?? "";

  const isActive = (path: string) => {
    if (path === "/candidate/dashboard") {
      return location.pathname === "/candidate" || location.pathname === path;
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link to="/candidate/dashboard" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
                <span className="text-lg font-bold text-white">E</span>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">{t("common:app.name")}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{t("navigation:candidate.portal")}</p>
              </div>
            </Link>
            {schoolName ? <Badge variant="outline">{schoolName}</Badge> : null}
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {t(item.labelKey, { ns: "navigation" })}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center justify-between gap-3">
            <LanguageSwitcher />
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
                <p className="truncate text-xs text-gray-500">{profile?.email ?? ""}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              {t("common:actions.logout")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Suspense fallback={<RouteContentLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
