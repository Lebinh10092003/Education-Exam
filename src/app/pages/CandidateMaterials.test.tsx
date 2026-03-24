import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../i18n";
import { CandidateMaterials } from "./CandidateMaterials";

const mockApiRequest = vi.fn();

vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

describe("CandidateMaterials", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("vi");
    mockApiRequest.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          title: "Candidate Exam Handbook",
          description: "",
          file_url: "/media/handbook.pdf",
          file_name: "handbook.pdf",
          file_size: 134,
          mime_type: "application/pdf",
          download_count: 0,
          created_at: "2026-03-24T14:06:00Z",
          subject: {
            id: 1,
            name: "Mathematics",
            code: "MATH101",
          },
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a view-only inline preview flow in Vietnamese for the candidate portal", async () => {
    render(
      <MemoryRouter>
        <CandidateMaterials />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Tài liệu học tập")).toBeInTheDocument();
    expect(
      screen.getByText("Các tài liệu học tập đang khả dụng cho tài khoản thí sinh của bạn."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quay lại tổng quan" })).toBeInTheDocument();
    expect(screen.getByText("Tải lên gần đây")).toBeInTheDocument();
    expect(screen.getByText("Lọc tài liệu")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tìm theo tiêu đề hoặc môn học...")).toBeInTheDocument();
    expect(screen.getByText("Xem tài liệu")).toBeInTheDocument();
    expect(
      screen.getByText("Tài liệu dành cho học sinh chỉ được xem trong cổng học viên và không hỗ trợ tải xuống."),
    ).toBeInTheDocument();
    expect(screen.getByText("Thư viện tài nguyên")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Dạng lưới" })).toBeInTheDocument();
    expect(screen.getAllByText("Tài liệu").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Xem trong trang" })).toBeInTheDocument();
    expect(screen.getByTitle("Candidate Exam Handbook")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mở" })).not.toBeInTheDocument();
  });
});
