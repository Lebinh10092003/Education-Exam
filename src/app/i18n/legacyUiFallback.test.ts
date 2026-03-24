import { describe, expect, it } from "vitest";

import { translateLegacyUiText } from "./legacyUiFallback";

describe("translateLegacyUiText", () => {
  it("translates exact legacy UI labels for Vietnamese", () => {
    expect(translateLegacyUiText("vi", "Dashboard")).toBe("Tổng quan");
    expect(translateLegacyUiText("vi", "Open monitoring")).toBe("Mở giám sát");
    expect(translateLegacyUiText("vi", "Name")).toBe("Tên");
    expect(translateLegacyUiText("vi", "Create Period")).toBe("Tạo đợt thi");
    expect(translateLegacyUiText("vi", "Monitored exams")).toBe("Kỳ thi được giám sát");
    expect(translateLegacyUiText("vi", "Candidate exited fullscreen during a protected exam.")).toBe(
      "Thí sinh đã thoát chế độ toàn màn hình trong một kỳ thi được bảo vệ.",
    );
  });

  it("translates dynamic legacy UI phrases for Vietnamese", () => {
    expect(translateLegacyUiText("vi", "3 monitoring alerts")).toBe("3 cảnh báo giám sát");
    expect(translateLegacyUiText("vi", "Page 2")).toBe("Trang 2");
    expect(translateLegacyUiText("vi", "Attempts 1/3")).toBe("Lượt làm 1/3");
    expect(translateLegacyUiText("vi", "Created 24 Mar 2026")).toBe("Tạo 24 Mar 2026");
    expect(translateLegacyUiText("vi", "Capacity 80")).toBe("Sức chứa 80");
    expect(translateLegacyUiText("vi", "Used by 2 exam(s)")).toBe("Được dùng cho 2 kỳ thi");
    expect(translateLegacyUiText("vi", "Showing 1-1 of 1 proctored exams")).toBe(
      "Hiển thị 1-1 trên tổng số 1 kỳ thi có giám sát",
    );
    expect(translateLegacyUiText("vi", "Add Members to North Valley - Grade 10B")).toBe(
      "Thêm thành viên vào North Valley - Grade 10B",
    );
  });

  it("keeps English text unchanged", () => {
    expect(translateLegacyUiText("en", "Dashboard")).toBe("Dashboard");
    expect(translateLegacyUiText("en", "Page 2")).toBe("Page 2");
    expect(translateLegacyUiText("en", "Candidate exited fullscreen mode.")).toBe(
      "Candidate exited fullscreen mode.",
    );
  });

  it("restores translated Vietnamese legacy text back to English", () => {
    expect(translateLegacyUiText("en", "Tổng quan")).toBe("Dashboard");
    expect(translateLegacyUiText("en", "Trang 2")).toBe("Page 2");
    expect(translateLegacyUiText("en", "Lượt làm 1/3")).toBe("Attempts 1/3");
    expect(translateLegacyUiText("en", "Tạo 24 Mar 2026")).toBe("Created 24 Mar 2026");
    expect(translateLegacyUiText("en", "Sức chứa 80")).toBe("Capacity 80");
    expect(translateLegacyUiText("en", "Được dùng cho 2 kỳ thi")).toBe("Used by 2 exam(s)");
    expect(translateLegacyUiText("en", "Hiển thị 1-1 trên tổng số 1 kỳ thi có giám sát")).toBe(
      "Showing 1-1 of 1 proctored exams",
    );
    expect(translateLegacyUiText("en", "Thêm thành viên vào North Valley - Grade 10B")).toBe(
      "Add Members to North Valley - Grade 10B",
    );
    expect(
      translateLegacyUiText(
        "en",
        "Thí sinh đã thoát chế độ toàn màn hình trong một kỳ thi được bảo vệ.",
      ),
    ).toBe("Candidate exited fullscreen during a protected exam.");
  });
});
