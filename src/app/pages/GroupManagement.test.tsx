import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

import { GroupManagement } from "./GroupManagement";

const mockApiRequest = vi.fn();

vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

describe("GroupManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/api/v1/groups/") {
        return { count: 0, next: null, previous: null, results: [] };
      }
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it("renders without school controls and does not fetch schools", async () => {
    render(
      <MemoryRouter>
        <GroupManagement />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No groups matched the current filters.")).toBeInTheDocument();
    expect(screen.queryByText("All Schools")).not.toBeInTheDocument();
    expect(mockApiRequest).not.toHaveBeenCalledWith("/api/v1/schools/", expect.anything());
  });

  it("links each group to the dedicated members page", async () => {
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/api/v1/groups/") {
        return {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 7,
              name: "IMO Group",
              description: "",
              is_active: true,
              member_count: 12,
              exams_count: 1,
              created_at: "2026-06-08T00:00:00Z",
              updated_at: "2026-06-08T00:00:00Z",
            },
          ],
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    render(
      <MemoryRouter>
        <GroupManagement />
      </MemoryRouter>,
    );

    const membersLink = await screen.findByRole("link", { name: /thanh vien/i });
    expect(membersLink).toHaveAttribute("href", "/groups/7/members");
  });
});
