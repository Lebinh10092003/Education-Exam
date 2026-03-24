// @vitest-environment node
import { describe, expect, it } from "vitest";

import config from "../../vite.config";

describe("vite dev server proxy", () => {
  it("forwards media requests to Django instead of falling back to the SPA shell", () => {
    expect(config.server?.proxy).toMatchObject({
      "/media": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    });
  });
});
