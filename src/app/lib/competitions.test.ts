import { describe, expect, it } from "vitest";

import { daysUntil, pickNextOpenCompetition, type PublicCompetition } from "./competitions";

const base = {
  name: "", description: "", cycle: "", info_url: "", status: "upcoming", accepts_registration: true,
} as const;

describe("competition helpers", () => {
  it("counts whole days until a date", () => {
    const today = new Date(2026, 9, 30, 23, 30);
    expect(daysUntil("2026-10-30", today)).toBe(0);
    expect(daysUntil("2026-11-02", today)).toBe(3);
    expect(daysUntil("2026-10-29", today)).toBe(-1);
    expect(daysUntil(null, today)).toBeNull();
  });

  it("picks the open competition with the nearest deadline", () => {
    const items: PublicCompetition[] = [
      { ...base, id: 1, code: "A", exam_date: "2027-06-01", registration_deadline: "2027-05-20" },
      { ...base, id: 2, code: "B", exam_date: "2027-05-01", registration_deadline: "2027-04-01" },
      { ...base, id: 3, code: "C", exam_date: "2027-01-01", registration_deadline: "2026-12-01", accepts_registration: false },
    ];
    expect(pickNextOpenCompetition(items)?.code).toBe("B");
    expect(pickNextOpenCompetition([])).toBeNull();
  });
});
