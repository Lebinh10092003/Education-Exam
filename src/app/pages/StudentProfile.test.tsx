import { render, screen } from "@testing-library/react";
import type { ContextType } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthProfile } from "../auth/AuthContext";
import i18n from "../i18n";
import { LOCALE_STORAGE_KEY } from "../lib/storage";
import { StudentProfile } from "./StudentProfile";

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
  roles: ["candidate", "student"],
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

describe("StudentProfile", () => {
  beforeEach(async () => {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders imported registration details as read-only and hides internal email", () => {
    render(
      <AuthContext.Provider value={buildAuthValue()}>
        <MemoryRouter>
          <StudentProfile />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(
      screen.getByText(
        "These registration details come from the imported roster and cannot be changed by the student account.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Full Name")).toBeDisabled();
    expect(screen.getByLabelText("Phone Number")).toBeDisabled();
    expect(screen.getByLabelText("Account Status")).toBeDisabled();
    expect(screen.queryByText("candidate@example.com")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
  });

  it("keeps system preferences out of the profile page", () => {
    render(
      <AuthContext.Provider value={buildAuthValue()}>
        <MemoryRouter>
          <StudentProfile />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(screen.queryByText("System Settings")).not.toBeInTheDocument();
    expect(screen.queryByText("Appearance Theme")).not.toBeInTheDocument();
    expect(screen.queryByText("Default Language")).not.toBeInTheDocument();
  });
});
