import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ContextType } from "react";
import { Link, matchRoutes, MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthProfile, getDefaultRouteForProfile } from "./auth/AuthContext";
import { ProtectedAdminLayout, ProtectedCandidateLayout } from "./components/auth/ProtectedRoute";
import i18n from "./i18n";
import { ExamMonitorRedirectRoute, routeConfig } from "./routes";

type AuthContextValue = NonNullable<ContextType<typeof AuthContext>>;

const adminProfile: AuthProfile = {
  id: 1,
  username: "admin",
  email: "admin@example.com",
  full_name: "Admin User",
  status: "active",
  is_active: true,
  phone_number: "",
  school: null,
  roles: ["administrator"],
  avatar_url: "",
};

const candidateProfile: AuthProfile = {
  id: 2,
  username: "candidate",
  email: "candidate@example.com",
  full_name: "Candidate User",
  status: "active",
  is_active: true,
  phone_number: "",
  school: null,
  roles: ["candidate"],
  avatar_url: "",
};

const buildAuthValue = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  tokens: { access: "access-token", refresh: "refresh-token" },
  profile: null,
  isAuthenticated: false,
  isBootstrapping: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshProfile: vi.fn(),
  hasAnyRole: vi.fn().mockReturnValue(false),
  ...overrides,
});

describe("route configuration", () => {
  it("sends candidates to the dashboard index after login", () => {
    expect(getDefaultRouteForProfile(candidateProfile)).toBe("/candidate");
  });

  it("registers the expanded admin routes", () => {
    expect(matchRoutes(routeConfig, "/")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/reset-password")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/users")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/groups/7/members")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/materials")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/manual-grading")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/notifications")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/audit")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/roles-permissions")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/results/9/review")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/exams/monitoring")?.at(-1)?.route.path).toBe("exams/monitoring");
    expect(matchRoutes(routeConfig, "/exams/42")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/exams/42/monitor")).toBeTruthy();
  });

  it("registers the expanded candidate routes while keeping the dashboard as the default candidate destination", () => {
    expect(matchRoutes(routeConfig, "/candidate/practice")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/candidate/practice/sessions/42")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/candidate/practice/sessions/42/review")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/candidate/exam/42")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/candidate")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/candidate/dashboard")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/candidate/exams")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/candidate/exams/42/instructions")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/candidate/results")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/candidate/results/42")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/candidate/materials")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/candidate/notifications")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/candidate/profile")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/candidate/help")).toBeTruthy();
    expect(getDefaultRouteForProfile(candidateProfile)).toBe("/candidate");
  });
});

describe("protected layouts", () => {
  it("renders the admin shell for authenticated admin users", async () => {
    await i18n.changeLanguage("vi");

    render(
      <AuthContext.Provider
        value={buildAuthValue({
          profile: adminProfile,
          isAuthenticated: true,
          hasAnyRole: vi.fn().mockReturnValue(true),
        })}
      >
        <MemoryRouter initialEntries={["/dashboard"]}>
          <ProtectedAdminLayout />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findAllByText(i18n.t("admin.dashboard", { ns: "navigation" }))).not.toHaveLength(0);
    expect(screen.getAllByText(i18n.t("admin.exams", { ns: "navigation" }))).not.toHaveLength(0);
    expect(screen.queryByText(i18n.t("admin.examList", { ns: "navigation" }))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t("admin.liveMonitoring", { ns: "navigation" }))).not.toBeInTheDocument();
  });

  it("renders the shared candidate shell for authenticated candidates", async () => {
    await i18n.changeLanguage("en");

    render(
      <AuthContext.Provider
        value={buildAuthValue({
          profile: candidateProfile,
          isAuthenticated: true,
          hasAnyRole: vi.fn().mockReturnValue(false),
        })}
      >
        <MemoryRouter initialEntries={["/candidate/dashboard"]}>
          <ProtectedCandidateLayout />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findAllByText(i18n.t("candidate.portal", { ns: "navigation" }))).not.toHaveLength(0);
    expect(screen.getAllByText(i18n.t("candidate.exams", { ns: "navigation" }))).not.toHaveLength(0);
  });

  it("keeps candidate routing stable when navigating from practice into a practice session route", async () => {
    await i18n.changeLanguage("en");
    const user = userEvent.setup();

    render(
      <AuthContext.Provider
        value={buildAuthValue({
          profile: candidateProfile,
          isAuthenticated: true,
          hasAnyRole: vi.fn().mockReturnValue(false),
        })}
      >
        <MemoryRouter initialEntries={["/candidate/practice"]}>
          <Routes>
            <Route path="/candidate" element={<ProtectedCandidateLayout />}>
              <Route
                path="practice"
                element={<Link to="/candidate/practice/sessions/44">Open Practice Session</Link>}
              />
              <Route path="practice/sessions/:id" element={<div>Practice Session Screen</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findByRole("link", { name: "Open Practice Session" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Open Practice Session" }));

    expect(await screen.findByText("Practice Session Screen")).toBeInTheDocument();
  }, 15000);

  it("redirects legacy exam monitoring routes to the canonical detail query route", async () => {
    render(
      <MemoryRouter initialEntries={["/exams/42/monitor"]}>
        <Routes>
          <Route path="/exams/:id/monitor" element={<ExamMonitorRedirectRoute />} />
          <Route path="/exams/:id" element={<div>Exam detail page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Exam detail page")).toBeInTheDocument();
  });
});
