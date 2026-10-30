import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/http";
import { McpAccessTokens } from "./McpAccessTokens";

const mockApiRequest = vi.fn();
const mockConfirm = vi.fn();
vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return { ...actual, apiRequest: (...args: unknown[]) => mockApiRequest(...args) };
});
vi.mock("../lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), confirm: (...args: unknown[]) => mockConfirm(...args) },
}));

const token = {
  id: 1,
  name: "Claude laptop",
  key_prefix: "eduexam_pat_abc123",
  created_at: "2026-10-30T03:00:00Z",
  expires_at: "2027-01-28T03:00:00Z",
  last_used_at: null,
  revoked_at: null,
  is_active: true,
};

describe("McpAccessTokens", () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    mockConfirm.mockReset();
  });
  afterEach(() => cleanup());

  it("creates a token, shows it once with the Claude Code command", async () => {
    const user = userEvent.setup();
    let created = false;
    mockApiRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === "POST") {
        created = true;
        return { ...token, token: "eduexam_pat_SECRET" };
      }
      return created ? [token] : [];
    });

    render(<McpAccessTokens />);
    await user.click(await screen.findByRole("button", { name: /tạo mã truy cập/i }));

    expect(await screen.findByTestId("new-mcp-token")).toHaveTextContent("eduexam_pat_SECRET");
    expect(screen.getByText(/claude mcp add --transport http eduexam .*\/mcp/)).toBeInTheDocument();
    expect(mockApiRequest).toHaveBeenCalledWith("/api/v1/api-tokens/", {
      method: "POST",
      body: { name: "Claude", expires_in_days: 90 },
    });
    expect(await screen.findByText("Claude laptop")).toBeInTheDocument();
  });

  it("revokes a token after confirmation", async () => {
    const user = userEvent.setup();
    mockConfirm.mockResolvedValue(true);
    mockApiRequest.mockImplementation(async () => [token]);

    render(<McpAccessTokens />);
    await user.click(await screen.findByRole("button", { name: /thu hồi/i }));

    await waitFor(() =>
      expect(mockApiRequest).toHaveBeenCalledWith("/api/v1/api-tokens/1/", { method: "DELETE" }),
    );
  });

  it("explains that only admins can connect", async () => {
    mockApiRequest.mockImplementation(async () => {
      throw new ApiError("Chỉ tài khoản quản trị mới tạo được mã truy cập MCP.", 403, {});
    });

    render(<McpAccessTokens />);

    expect(await screen.findByText(/Chỉ tài khoản quản trị/)).toBeInTheDocument();
  });
});
