import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ContextType } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthProfile } from "../auth/AuthContext";
import { LegacyUiTranslationBridge } from "../components/LegacyUiTranslationBridge";
import { CandidateLayout } from "../components/layouts/CandidateLayout";
import i18n from "../i18n";
import { LOCALE_STORAGE_KEY } from "../lib/storage";

const mockSetTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme: mockSetTheme,
  }),
}));

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

const renderLayoutWithBridge = (initialEntry = "/candidate/dashboard") =>
  render(
    <>
      <LegacyUiTranslationBridge />
      <AuthContext.Provider value={buildAuthValue()}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/candidate/*" element={<CandidateLayout />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </>,
  );

describe("CandidateLayout", () => {
  beforeEach(async () => {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
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

  it("opens the settings modal from the top navigation menu and applies workspace preferences", async () => {
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

    const trigger = screen.getByText("Candidate User").closest("button");
    expect(trigger).not.toBeNull();

    await user.click(trigger!);

    expect(await screen.findByText("My Account")).toBeInTheDocument();
    expect(screen.getByText("candidate@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Logout" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Settings" }));

    expect(await screen.findByText(i18n.t("profile:student.sections.systemSettings"))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");

    await user.click(screen.getByRole("button", { name: i18n.t("common:locale.vietnamese") }));

    await waitFor(() => {
      expect(i18n.resolvedLanguage ?? i18n.language).toMatch(/^vi/);
    });

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("vi");
  });

  it("updates the topbar language badge immediately when the locale changes in settings", async () => {
    const user = userEvent.setup();

    await i18n.changeLanguage("en");
    renderLayoutWithBridge("/candidate/materials");

    expect(await screen.findByRole("button", { name: "EN" })).toBeInTheDocument();
    expect(screen.getAllByText("Student Portal").length).toBeGreaterThan(0);

    const trigger = screen.getByText("Candidate User").closest("button");
    expect(trigger).not.toBeNull();

    await user.click(trigger!);
    await user.click(await screen.findByRole("menuitem", { name: "Settings" }));
    await user.click(await screen.findByRole("button", { name: "Tiếng Việt" }));
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "VI" })).toBeInTheDocument();
    });

    expect(screen.getAllByText("Cổng thí sinh").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tài liệu").length).toBeGreaterThan(0);
    expect(screen.getByText("Mục hiện tại")).toBeInTheDocument();
  });
});
