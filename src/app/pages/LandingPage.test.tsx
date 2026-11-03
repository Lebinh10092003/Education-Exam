import { fireEvent, render, screen } from "@testing-library/react";
import type { ContextType } from "react";
import { MemoryRouter } from "react-router";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "../auth/AuthContext";
import i18n from "../i18n";
import { LandingPage } from "./LandingPage";

const mockFetchCompetitions = vi.fn();
vi.mock("../lib/competitions", async () => {
  const actual = await vi.importActual<typeof import("../lib/competitions")>("../lib/competitions");
  return { ...actual, fetchPublicCompetitions: () => mockFetchCompetitions() };
});

const mockApiRequest = vi.fn();
vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return { ...actual, apiRequest: (...args: unknown[]) => mockApiRequest(...args) };
});

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
  beforeEach(() => {
    mockFetchCompetitions.mockReset();
    mockFetchCompetitions.mockResolvedValue([]);
  });

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

  it("offers a quick register button for each competition open for registration", async () => {
    await i18n.changeLanguage("vi");
    mockFetchCompetitions.mockResolvedValue([
      {
        id: 7, name: "Olympic Quốc tế về Toán học", code: "IMO", description: "", cycle: "4",
        exam_date: "2099-05-30", registration_deadline: "2099-05-01", info_url: "",
        status: "upcoming", accepts_registration: true,
      },
      {
        id: 8, name: "Olympic cũ", code: "OLD", description: "", cycle: "3",
        exam_date: "2020-05-30", registration_deadline: null, info_url: "",
        status: "ended", accepts_registration: false,
      },
    ]);

    renderLandingPage();

    // Bang (desktop) va the (dien thoai) deu co nut "Dang ky ngay" dan toi form da chon san cuoc thi.
    const quickLinks = (await screen.findAllByText("Đăng ký ngay", {}, { timeout: 5000 })).map((node) => node.closest("a"));
    expect(quickLinks).toHaveLength(2);
    quickLinks.forEach((link) => expect(link).toHaveAttribute("href", "/register?competition=7"));
    expect(screen.getAllByText(/Còn \d+ ngày/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Tra cứu kết quả" }).length).toBeGreaterThan(0);
  });

  it("looks up published results by username without sending auth", async () => {
    await i18n.changeLanguage("vi");
    mockApiRequest.mockReset();
    mockApiRequest.mockResolvedValue({
      count: 1, next: null, previous: null,
      results: [{
        id: 1, candidate_name: "Nguyễn Văn A", exam_name: "Kỳ thi thử", subject_name: "Toán",
        score: "8.00", max_score: "10.00", percentage: "80.00", passed: true, completed_date: "2026-06-01",
      }],
    });

    const { container } = renderLandingPage();

    fireEvent.change(container.querySelector("#lookup-username")!, { target: { value: "candidate01" } });
    fireEvent.submit(container.querySelector("#lookup-username")!.closest("form")!);

    expect(await screen.findByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(mockApiRequest).toHaveBeenCalledWith("/api/v1/public-results/lookup/", {
      auth: false,
      query: { type: "username", username: "candidate01" },
    });
  });
});
