import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/http";
import { RegistrationPage, parseBirthDate } from "./RegistrationPage";

const mockApiRequest = vi.fn();
vi.mock("../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../lib/http")>("../lib/http");
  return { ...actual, apiRequest: (...args: unknown[]) => mockApiRequest(...args) };
});

const competitions = [
  {
    id: 7,
    name: "Olympic Quốc tế về Toán học",
    code: "IMO",
    description: "",
    cycle: "4",
    exam_date: "2027-05-30",
    registration_deadline: "2027-05-01",
    info_url: "",
    status: "upcoming",
    accepts_registration: true,
  },
  {
    id: 8,
    name: "Đã đóng đăng ký",
    code: "OLD",
    description: "",
    cycle: "3",
    exam_date: "2026-05-30",
    registration_deadline: null,
    info_url: "",
    status: "ended",
    accepts_registration: false,
  },
];

const fillForm = async (user: ReturnType<typeof userEvent.setup>, dob = "02/11/2012") => {
  await user.type(screen.getByLabelText(/họ và tên thí sinh/i), "Nguyễn Văn An");
  await user.type(screen.getByLabelText(/ngày\/tháng\/năm sinh/i), dob);
  await user.type(screen.getByLabelText(/số cccd/i), "001212000001");
  await user.type(screen.getByLabelText(/^trường/i), "THCS Giảng Võ");
  await user.type(screen.getByLabelText(/^lớp/i), "8A1");
  await user.type(screen.getByLabelText(/địa chỉ/i), "1 Giảng Võ");
  await user.type(screen.getByLabelText(/phường/i), "Giảng Võ");
  await user.type(screen.getByLabelText(/tỉnh|thành phố/i), "Hà Nội");
  await user.type(screen.getByLabelText(/email/i), "ph@example.com");
  await user.type(screen.getByLabelText(/điện thoại|sđt/i), "0912345678");
};

describe("RegistrationPage", () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/api/v1/public/competitions/") return competitions;
      return { id: 1, status: "new" };
    });
  });
  afterEach(() => cleanup());

  it("parses Vietnamese birth dates", () => {
    expect(parseBirthDate("02/11/2012")).toBe("2012-11-02");
    expect(parseBirthDate("2/1/2012")).toBe("2012-01-02");
    expect(parseBirthDate("31/02/2012")).toBeNull();
    expect(parseBirthDate("2012-11-02")).toBeNull();
  });

  it("lists only competitions open for registration from the API", async () => {
    render(
      <MemoryRouter>
        <RegistrationPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("IMO")).toBeInTheDocument();
    expect(screen.queryByText("OLD")).not.toBeInTheDocument();
    expect(mockApiRequest).toHaveBeenCalledWith("/api/v1/public/competitions/", { auth: false, query: { all: "1" } });
  });

  it("really submits the registration to the server", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegistrationPage />
      </MemoryRouter>,
    );
    await user.click(await screen.findByText("IMO"));
    await fillForm(user);
    await user.selectOptions(screen.getByLabelText(/khối thi/i), "Khối 8");
    await user.click(screen.getByRole("button", { name: /gửi hồ sơ đăng ký/i }));

    await waitFor(() =>
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/api/v1/public/competition-registrations/",
        expect.objectContaining({
          method: "POST",
          auth: false,
          body: expect.objectContaining({
            full_name: "Nguyễn Văn An",
            date_of_birth: "2012-11-02",
            grade: "Khối 8",
            competition_ids: [7],
            website: "",
          }),
        }),
      ),
    );
    expect(await screen.findByText(/đăng ký thành công/i)).toBeInTheDocument();
  }, 20_000);

  it("shows server validation errors instead of a fake success", async () => {
    const user = userEvent.setup();
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/api/v1/public/competitions/") return competitions;
      throw new ApiError("Bad request", 400, { competition_ids: ["Đã hết hạn đăng ký: IMO."] });
    });
    render(
      <MemoryRouter>
        <RegistrationPage />
      </MemoryRouter>,
    );
    await user.click(await screen.findByText("IMO"));
    await fillForm(user);
    await user.selectOptions(screen.getByLabelText(/khối thi/i), "Khối 8");
    await user.click(screen.getByRole("button", { name: /gửi hồ sơ đăng ký/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Đã hết hạn đăng ký: IMO.");
    expect(screen.queryByText(/đăng ký thành công/i)).not.toBeInTheDocument();
  }, 20_000);

  it("preselects the competition chosen on the homepage", async () => {
    render(
      <MemoryRouter initialEntries={["/register?competition=7"]}>
        <RegistrationPage />
      </MemoryRouter>,
    );
    await screen.findByText("IMO");
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked());
  });
});
