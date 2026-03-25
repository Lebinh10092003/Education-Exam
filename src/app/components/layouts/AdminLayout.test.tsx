import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ContextType } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../../i18n";
import { AuthContext, type AuthProfile } from "../../auth/AuthContext";
import { LegacyUiTranslationBridge } from "../LegacyUiTranslationBridge";
import { AdminLayout } from "./AdminLayout";

const mockApiRequest = vi.fn();

vi.mock("../../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../../lib/http")>("../../lib/http");
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

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

const buildAuthValue = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  tokens: { access: "access-token", refresh: "refresh-token" },
  profile: adminProfile,
  isAuthenticated: true,
  isBootstrapping: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshProfile: vi.fn(),
  hasAnyRole: vi.fn().mockReturnValue(true),
  ...overrides,
});

const renderLayout = (initialEntry = "/users") =>
  render(
    <AuthContext.Provider value={buildAuthValue()}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route path="*" element={<div>Page content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

const renderLayoutWithBridge = (initialEntry = "/users") =>
  render(
    <>
      <LegacyUiTranslationBridge />
      <AuthContext.Provider value={buildAuthValue()}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/" element={<AdminLayout />}>
              <Route path="*" element={<div>Page content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </>,
  );

describe("AdminLayout", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    window.localStorage.clear();
    await i18n.changeLanguage("vi");
    mockApiRequest.mockResolvedValue({ unread_count: 0 });
  });

  it("keeps the exam section collapsed until it is opened", async () => {
    const user = userEvent.setup();

    renderLayout();

    const examSectionButton = (await screen.findAllByRole("button", { name: "Quản lý kỳ thi" })).at(-1);

    expect(examSectionButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Danh sách kỳ thi")).not.toBeInTheDocument();
    expect(screen.queryByText("Giám sát trực tiếp")).not.toBeInTheDocument();
    expect(screen.queryByText("Kỷ luật và chứng chỉ")).not.toBeInTheDocument();

    await user.click(examSectionButton!);

    expect((await screen.findAllByRole("button", { name: "Quản lý kỳ thi" })).at(-1)).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("Danh sách kỳ thi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Giám sát trực tiếp").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kỷ luật và chứng chỉ").length).toBeGreaterThan(0);

    await user.click((await screen.findAllByRole("button", { name: "Quản lý kỳ thi" })).at(-1)!);

    await waitFor(() => {
      expect(screen.queryByText("Danh sách kỳ thi")).not.toBeInTheDocument();
    });
  });

  it("updates the switcher label and navigation copy when the locale changes", async () => {
    const user = userEvent.setup();

    renderLayout();

    await user.click((await screen.findAllByRole("button", { name: /^VI$/i })).at(-1)!);
    await user.click(await screen.findByRole("menuitemradio", { name: /English/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^EN$/i })).toBeInTheDocument();
    });

    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("User Management").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Exam Management" }).length).toBeGreaterThan(0);

    await user.click((await screen.findAllByRole("button", { name: "Exam Management" })).at(-1)!);

    expect(screen.getAllByText("Exam List").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Live Monitoring").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Discipline & Certificates").length).toBeGreaterThan(0);
  });

  it("keeps the exam group active for discipline routes", async () => {
    renderLayout("/discipline");

    const examSectionButton = (await screen.findAllByRole("button", { name: "Quản lý kỳ thi" })).at(-1);
    expect(examSectionButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("Kỷ luật và chứng chỉ").length).toBeGreaterThan(0);
  });

  it("keeps the admin shell fully localized when the legacy bridge is mounted", async () => {
    const user = userEvent.setup();

    await i18n.changeLanguage("en");
    renderLayoutWithBridge();

    await user.click((await screen.findAllByRole("button", { name: /^EN$/i })).at(-1)!);
    await user.click(await screen.findByRole("menuitemradio", { name: /Ti.ng Vi.t/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^VI$/i })).toBeInTheDocument();
    });

    expect(screen.getAllByText("Tổng quan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nhóm thí sinh").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Môn học").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Quản lý người dùng").length).toBeGreaterThan(0);
    expect(screen.getAllByPlaceholderText("Tìm kiếm...").length).toBeGreaterThan(0);
  });
});
