import { describe, expect, it } from "vitest";

import {
  DEFAULT_SUBJECT_COLOR,
  generateSubjectCode,
  getSubjectColorPresentation,
  normalizeSubjectColorValue,
  normalizeSubjectCodeInput,
} from "./subjectManagementUtils";

describe("subjectManagementUtils", () => {
  it("builds acronym-based subject codes from normalized words", () => {
    expect(generateSubjectCode("Toán Cao Cấp")).toBe("TCC");
    expect(generateSubjectCode("internailtionnal Math Olympyad")).toBe("IMO");
  });

  it("falls back to short uppercase codes for single-word subjects", () => {
    expect(generateSubjectCode("Mathematics")).toBe("MAT");
  });

  it("adds a numeric suffix when the generated code already exists", () => {
    expect(generateSubjectCode("International Math Olympiad", ["IMO", "IMO2"])).toBe("IMO3");
  });

  it("normalizes manual subject code overrides", () => {
    expect(normalizeSubjectCodeInput("Mã toán nâng cao 10")).toBe("MA_TOAN_NANG_CAO");
  });

  it("converts subject colors to uppercase hex values", () => {
    expect(normalizeSubjectColorValue("#abc")).toBe("#AABBCC");
    expect(normalizeSubjectColorValue("bg-blue-600")).toBe("#2563EB");
    expect(normalizeSubjectColorValue("invalid")).toBe(DEFAULT_SUBJECT_COLOR);
  });

  it("renders hex colors as inline styles", () => {
    expect(getSubjectColorPresentation("#F59E0B").containerStyle).toEqual({ backgroundColor: "#F59E0B" });
  });
});
