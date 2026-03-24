import { describe, expect, it } from "vitest";

import {
  getPermissionDescription,
  getPermissionModuleLabel,
  normalizePermissionLocale,
} from "./permissionI18n";

describe("permissionI18n", () => {
  it("normalizes the current locale into en or vi", () => {
    expect(normalizePermissionLocale("en-US")).toBe("en");
    expect(normalizePermissionLocale("vi")).toBe("vi");
    expect(normalizePermissionLocale(undefined)).toBe("vi");
  });

  it("returns localized module labels for known permission modules", () => {
    expect(getPermissionModuleLabel("permissions", "vi")).toBe("Quyền");
    expect(getPermissionModuleLabel("materials", "en")).toBe("Materials");
  });

  it("builds localized descriptions from module and action instead of exposing backend seed text", () => {
    expect(
      getPermissionDescription(
        {
          module: "audit",
          action: "manage",
          description: "Manage access for audit.",
        },
        "en",
      ),
    ).toBe("Manage access for audit.");

    expect(
      getPermissionDescription(
        {
          module: "audit",
          action: "manage",
          description: "Manage access for audit.",
        },
        "vi",
      ),
    ).toBe("Quyền quản lý audit.");

    expect(
      getPermissionDescription(
        {
          module: "materials",
          action: "view",
        },
        "vi",
      ),
    ).toBe("Quyền xem tài liệu.");
  });

  it("falls back safely for unknown modules and unknown actions", () => {
    expect(getPermissionModuleLabel("identity_audit", "en")).toBe("Identity Audit");
    expect(
      getPermissionDescription(
        {
          module: "identity_audit",
          action: "approve",
          description: "",
        },
        "vi",
      ),
    ).toBe("Quyền identity audit.");
  });

  it("can infer the action from the permission code when action is missing", () => {
    expect(
      getPermissionDescription(
        {
          module: "materials",
          code: "materials.view",
        },
        "vi",
      ),
    ).toBe("Quyền xem tài liệu.");
  });
});
