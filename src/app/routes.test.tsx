import { render, screen } from "@testing-library/react";
import type { ContextType } from "react";
import { matchRoutes, MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthProfile, getDefaultRouteForProfile } from "./auth/AuthContext";
import { ProtectedAdminLayout, ProtectedCandidateLayout } from "./components/auth/ProtectedRoute";
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
    expect(matchRoutes(routeConfig, "/materials")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/manual-grading")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/notifications")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/audit")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/exam-periods")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/exam-rooms")).toBeTruthy();
    expect(matchRoutes(routeConfig, "/roles-permissions")).toBeTruthy();
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
    render(
      <AuthContext.Provider
        value={buildAuthValue({
          profile: adminProfile,
          isAuthenticated: true,
          hasAnyRole: vi.fn().mockReturnValue(true),
        })}
      >
        <MemoryRouter initialEntries={["/"]}>
          <ProtectedAdminLayout />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findAllByText("Tổng quan")).not.toHaveLength(0);
  });

  it("renders the shared candidate shell for authenticated candidates", async () => {
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

    expect(await screen.findAllByText("Student Portal")).not.toHaveLength(0);
    expect(screen.getAllByText("My Exams")).not.toHaveLength(0);
  });

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
