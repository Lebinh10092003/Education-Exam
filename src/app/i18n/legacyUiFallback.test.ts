import { describe, expect, it } from "vitest";

import { translateLegacyUiText } from "./legacyUiFallback";

describe("translateLegacyUiText", () => {
  it("translates exact legacy UI labels for Vietnamese", () => {
    expect(translateLegacyUiText("vi", "Dashboard")).toBe("Tổng quan");
    expect(translateLegacyUiText("vi", "Open monitoring")).toBe("Mở giám sát");
  });

  it("translates dynamic legacy UI phrases for Vietnamese", () => {
    expect(translateLegacyUiText("vi", "3 monitoring alerts")).toBe("3 cảnh báo giám sát");
    expect(translateLegacyUiText("vi", "Page 2")).toBe("Trang 2");
    expect(translateLegacyUiText("vi", "Attempts 1/3")).toBe("Lượt làm 1/3");
  });

  it("keeps English text unchanged", () => {
    expect(translateLegacyUiText("en", "Dashboard")).toBe("Dashboard");
    expect(translateLegacyUiText("en", "Page 2")).toBe("Page 2");
  });
});
