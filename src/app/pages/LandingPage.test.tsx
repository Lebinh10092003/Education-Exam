import { render, screen } from "@testing-library/react";
import type { ContextType } from "react";
import { MemoryRouter } from "react-router";
import { ThemeProvider } from "next-themes";
import { describe, expect, it, vi } from "vitest";

import { AuthContext } from "../auth/AuthContext";
import i18n from "../i18n";
import { LandingPage } from "./LandingPage";

type AuthContextValue = NonNullable<ContextType<typeof AuthContext>>;

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

const renderLandingPage = () =>
  render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <AuthContext.Provider value={buildAuthValue()}>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </ThemeProvider>,
  );

describe("LandingPage", () => {
  it("renders the FermatTech competition homepage content", async () => {
    await i18n.changeLanguage("vi");

    renderLandingPage();

    expect(screen.getByRole("heading", { name: "Khám phá các cuộc thi quốc tế cùng FermatTech" })).toBeInTheDocument();
    expect(screen.getAllByText("School Connect Online").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AYSBC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đăng nhập thí sinh").length).toBeGreaterThan(0);
  });

  it("links candidate login calls to the dedicated login page", async () => {
    await i18n.changeLanguage("vi");

    renderLandingPage();

    const loginLinks = screen.getAllByRole("link", { name: /Đăng nhập thí sinh/i });
    expect(loginLinks.some((link) => link.getAttribute("href") === "/login")).toBe(true);
  });
});
