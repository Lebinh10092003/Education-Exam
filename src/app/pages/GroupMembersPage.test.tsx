import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";

import { GroupMembersPage } from "./GroupMembersPage";

const mockApiRequest = vi.fn();

vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/groups/7/members"]}>
      <Routes>
        <Route path="/groups/:id/members" element={<GroupMembersPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("GroupMembersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/api/v1/groups/7/") {
        return {
          id: 7,
          name: "IMO Group",
          description: "",
          is_active: true,
          member_count: 1,
          exams_count: 0,
          created_at: "2026-06-08T00:00:00Z",
          updated_at: "2026-06-08T00:00:00Z",
        };
      }
      if (path === "/api/v1/groups/7/memberships/") {
        return {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 11,
              user_id: 22,
              username: "imo001",
              full_name: "Le Van Binh",
              email: "binh@example.com",
              date_of_birth: "2003-08-24",
              school: { id: 1, name: "Fermat School", code: "FERMAT" },
              phone_number: "0901234567",
              student_class: "12",
              ward: "Phuong 1",
              national_exam_subject: "Toan",
              exam_block: "A00",
              candidate_number: "IMO001",
              visible_password: "imo-pass",
              is_active: true,
              created_at: "2026-06-08T00:00:00Z",
            },
          ],
        };
      }
      if (path === "/api/v1/roles/") {
        return { count: 1, next: null, previous: null, results: [{ id: 3, name: "Candidate", slug: "candidate" }] };
      }
      if (path === "/api/v1/schools/") {
        return { count: 1, next: null, previous: null, results: [{ id: 1, name: "Fermat School", code: "FERMAT" }] };
      }
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it("renders full roster credentials columns and member values", async () => {
    renderPage();

    expect(await screen.findByText("Le Van Binh")).toBeInTheDocument();
    expect(screen.getByText("Tai khoan")).toBeInTheDocument();
    expect(screen.getByText("Mat khau")).toBeInTheDocument();
    expect(screen.getByText("imo001")).toBeInTheDocument();
    expect(screen.getByText("imo-pass")).toBeInTheDocument();
    expect(screen.getByText("IMO001")).toBeInTheDocument();
  });
});
