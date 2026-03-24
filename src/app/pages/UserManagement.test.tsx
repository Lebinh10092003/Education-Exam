import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../i18n";
import { UserManagement } from "./UserManagement";

const mockApiRequest = vi.fn();

vi.mock("../lib/http", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({
    profile: { id: 999, email: "admin@example.com", full_name: "Admin User" },
  }),
}));

describe("UserManagement", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("vi");

    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/api/v1/users/") {
        return { count: 0, next: null, previous: null, results: [] };
      }
      if (path === "/api/v1/roles/") {
        return { count: 0, next: null, previous: null, results: [] };
      }
      if (path === "/api/v1/schools/") {
        return { count: 0, next: null, previous: null, results: [] };
      }
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it("renders the primary action buttons in Vietnamese", async () => {
    render(<UserManagement />);

    expect(await screen.findByRole("button", { name: "Nhập CSV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm người dùng" })).toBeInTheDocument();
  });
});
