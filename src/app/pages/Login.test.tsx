import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ContextType } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ThemeProvider } from "next-themes";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthProfile } from "../auth/AuthContext";
import i18n from "../i18n";
import { Login } from "./Login";

vi.mock("../lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
});

type AuthContextValue = NonNullable<ContextType<typeof AuthContext>>;

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
  tokens: null,
  profile: null,
  isAuthenticated: false,
  isBootstrapping: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshProfile: vi.fn(),
  hasAnyRole: vi.fn().mockReturnValue(false),
  ...overrides,
});

const renderLoginPage = (authOverrides: Partial<AuthContextValue> = {}) =>
  render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <AuthContext.Provider value={buildAuthValue(authOverrides)}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/candidate" element={<div>Candidate portal</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </ThemeProvider>,
  );

describe("Login", () => {
  it("renders partner logos and BTC support guidance", async () => {
    await i18n.changeLanguage("vi");

    renderLoginPage();

    expect(screen.getByText("School Connect Online")).toBeInTheDocument();
    expect(screen.getAllByText("AYSBC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FermatTech").length).toBeGreaterThan(0);
    expect(screen.getByText("Kiểm tra email để nhận thông tin đăng nhập hoặc liên hệ với BTC.")).toBeInTheDocument();
    expect(screen.getByText(/0969 627 162/)).toBeInTheDocument();
    expect(screen.getByText(/khaothi@fermat.vn/)).toBeInTheDocument();
  });

  it("submits the candidate demo credentials and redirects to the candidate portal", async () => {
    await i18n.changeLanguage("vi");
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue(candidateProfile);

    renderLoginPage({ login });

    await user.type(screen.getByLabelText(/Email hoặc tên đăng nhập/i), "candidate@example.com");
    await user.type(screen.getByLabelText(/Mật khẩu/i), "admin123456");

    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("candidate@example.com", "admin123456");
    });
    expect(await screen.findByText("Candidate portal")).toBeInTheDocument();
  });
});
