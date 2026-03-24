import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    render(<GroupManagement />);

    expect(await screen.findByText("No groups matched the current filters.")).toBeInTheDocument();
    expect(screen.queryByText("All Schools")).not.toBeInTheDocument();
    expect(mockApiRequest).not.toHaveBeenCalledWith("/api/v1/schools/", expect.anything());
  });
});
