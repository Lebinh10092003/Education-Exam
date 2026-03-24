import { describe, expect, it } from "vitest";

import { clampPercentage } from "./utils";

describe("clampPercentage", () => {
  it("caps values above 100 to keep progress bars inside their track", () => {
    expect(clampPercentage(300)).toBe(100);
  });

  it("prevents negative or invalid values from breaking the UI", () => {
    expect(clampPercentage(-15)).toBe(0);
    expect(clampPercentage(Number.NaN)).toBe(0);
    expect(clampPercentage(undefined)).toBe(0);
  });
});
