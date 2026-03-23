import { render, screen } from "@testing-library/react";
import type { ContextType } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthProfile } from "../auth/AuthContext";
import { CandidateLayout } from "../components/layouts/CandidateLayout";

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
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the student sidebar shell", async () => {
    render(
      <AuthContext.Provider value={buildAuthValue()}>
        <MemoryRouter initialEntries={["/candidate/dashboard"]}>
          <CandidateLayout />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect((await screen.findAllByText("Student Portal")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("My Exams").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Notifications").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Help").length).toBeGreaterThan(0);
    expect(screen.getAllByText("EduExam Academy").length).toBeGreaterThan(0);
    expect(screen.getByText("Current Section")).toBeInTheDocument();
  });
});
