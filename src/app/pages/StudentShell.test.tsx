import { cleanup, render, screen } from "@testing-library/react";
import type { ContextType } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthProfile } from "../auth/AuthContext";
import { CandidateLayout } from "../components/layouts/CandidateLayout";
import i18n from "../i18n";

type AuthContextValue = NonNullable<ContextType<typeof AuthContext>>;

const candidateProfile: AuthProfile = {
  id: 2,
  username: "candidate",
  email: "candidate@example.com",
  full_name: "Candidate User",
  status: "active",
  is_active: true,
  phone_number: "",
  school: {
    id: 1,
    name: "EduExam Academy",
    code: "EEA",
  },
  roles: ["candidate"],
  avatar_url: "",
};

const buildAuthValue = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  tokens: { access: "access-token", refresh: "refresh-token" },
  profile: candidateProfile,
  isAuthenticated: true,
  isBootstrapping: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshProfile: vi.fn(),
  hasAnyRole: vi.fn().mockReturnValue(false),
  ...overrides,
});

describe("CandidateLayout", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the student sidebar shell", async () => {
    render(
      <AuthContext.Provider value={buildAuthValue()}>
        <MemoryRouter initialEntries={["/candidate/dashboard"]}>
          <Routes>
            <Route path="/candidate/*" element={<CandidateLayout />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect((await screen.findAllByText("Student Portal")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("My Exams").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Notifications").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Help").length).toBeGreaterThan(0);
    expect(screen.getAllByText("EduExam Academy").length).toBeGreaterThan(0);
    expect(screen.getByText("Current Section")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();
  });

  it("keeps the mobile navigation drawer open while switching candidate menu items", async () => {
    const user = userEvent.setup();

    render(
      <AuthContext.Provider value={buildAuthValue()}>
        <MemoryRouter initialEntries={["/candidate/dashboard"]}>
          <Routes>
            <Route path="/candidate/*" element={<CandidateLayout />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    await user.click(screen.getByLabelText("Open navigation"));
    expect(screen.getByLabelText("Close navigation")).toBeInTheDocument();
    expect(screen.getAllByText("Candidate User").length).toBeGreaterThan(0);
    expect(screen.queryByText("candidate@example.com")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("link", { name: "Materials" })[0]);

    expect(screen.getByLabelText("Close navigation")).toBeInTheDocument();
    expect(screen.getAllByText("Candidate User").length).toBeGreaterThan(0);
    expect(screen.queryByText("candidate@example.com")).not.toBeInTheDocument();
  });
});
