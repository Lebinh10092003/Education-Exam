import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest } from "./http";
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

  it("summarizes HTML error pages instead of exposing raw markup", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        "<!DOCTYPE html><html><head><title>Page not found at /missing/</title></head><body><header id='summary'><h1>Page not found (404)</h1></header></body></html>",
        {
          status: 404,
          headers: { "content-type": "text/html; charset=utf-8" },
        },
      ),
    );

    await expect(apiRequest("/api/v1/missing/", { auth: false })).rejects.toMatchObject<ApiError>({
      message: "Page not found (404)",
      status: 404,
    });
  });
});
