import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StudentNotifications } from "./StudentNotifications";

const mockApiRequest = vi.fn();
const mockNotifyError = vi.fn();
const mockNotifySuccess = vi.fn();

vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

vi.mock("../lib/notify", () => ({
  notify: {
    success: (...args: unknown[]) => mockNotifySuccess(...args),
    error: (...args: unknown[]) => mockNotifyError(...args),
    info: vi.fn(),
    confirm: vi.fn(),
  },
}));

const buildPaginated = <T,>(results: T[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

describe("StudentNotifications", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    let notifications = [
      {
        id: 1,
        title: "Published result available",
        message: "Your mathematics result is now available.",
        category: "result",
        priority: "medium",
        is_read: false,
        created_at: "2026-03-23T08:30:00Z",
      },
    ];

    mockApiRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/api/v1/notifications/") {
        return buildPaginated(notifications);
      }

      if (path === "/api/v1/notifications/unread-count/") {
        return {
          unread_count: notifications.filter((notification) => !notification.is_read).length,
        };
      }

      if (path === "/api/v1/notifications/1/mark-read/" && options?.method === "POST") {
        notifications = notifications.map((notification) =>
          notification.id === 1
            ? { ...notification, is_read: true }
            : notification,
        );
        return notifications[0];
      }

      throw new Error(`Unhandled apiRequest path: ${path}`);
    });
  });

  it("renders student notifications from the live API path and marks an item as read", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <StudentNotifications />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Published result available")).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /mark as read/i }));

    await waitFor(() => {
      expect(screen.getByText("0 unread")).toBeInTheDocument();
    });

    expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/v1/notifications/1/mark-read/",
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.queryByRole("button", { name: /mark as read/i })).not.toBeInTheDocument();
  });
});
