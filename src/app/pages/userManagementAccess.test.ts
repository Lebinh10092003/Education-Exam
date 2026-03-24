import { describe, expect, it } from "vitest";

import { getUserAccessActions } from "./userManagementAccess";

describe("getUserAccessActions", () => {
  it("returns only lock for active users", () => {
    expect(getUserAccessActions("active")).toEqual(["lock"]);
  });

  it("returns only unlock for locked users", () => {
    expect(getUserAccessActions("locked")).toEqual(["unlock"]);
  });

  it("returns both unlock and lock for pending users", () => {
    expect(getUserAccessActions("pending")).toEqual(["unlock", "lock"]);
  });
});
