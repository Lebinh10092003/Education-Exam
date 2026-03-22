import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "./http";
import { setStoredLocale } from "./storage";

describe("apiRequest locale propagation", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.localStorage.clear();
  });

  it("attaches the selected locale to request headers", async () => {
    setStoredLocale("en");

    await apiRequest<{ ok: boolean }>("/api/v1/ping/", { auth: false });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(new Headers(init?.headers).get("Accept-Language")).toBe("en");
  });
});
