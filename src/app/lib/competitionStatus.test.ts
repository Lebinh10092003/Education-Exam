import { describe, expect, it } from "vitest";

import { getCompetitionStatus, parseVietnameseDate, sortCompetitionsByStatus } from "./competitionStatus";

describe("competition status", () => {
  const today = new Date(2026, 4, 30, 15, 0); // 30/05/2026 15:00

  it("derives status from today's date", () => {
    expect(getCompetitionStatus("31/05/2026", today)).toBe("upcoming");
    expect(getCompetitionStatus("30/05/2026", today)).toBe("ongoing");
    expect(getCompetitionStatus("29/05/2026", today)).toBe("ended");
    expect(getCompetitionStatus("07/06/2026", new Date(2026, 9, 30))).toBe("ended");
  });

  it("rejects invalid dates", () => {
    expect(parseVietnameseDate("31/02/2026")).toBeNull();
    expect(parseVietnameseDate("2026-05-30")).toBeNull();
  });

  it("puts ongoing first, then nearest upcoming, then most recent ended", () => {
    const sorted = sortCompetitionsByStatus(
      [
        { key: "a", date: "01/05/2026" },
        { key: "b", date: "07/06/2026" },
        { key: "c", date: "30/05/2026" },
        { key: "d", date: "31/05/2026" },
        { key: "e", date: "15/05/2026" },
      ],
      today,
    );
    expect(sorted.map((item) => `${item.key}:${item.status}`)).toEqual([
      "c:ongoing",
      "d:upcoming",
      "b:upcoming",
      "e:ended",
      "a:ended",
    ]);
  });
});
