import { describe, expect, it } from "vitest";

import { resolveMediaServerUrl } from "./proctoringMedia";

describe("resolveMediaServerUrl", () => {
  it("keeps absolute LiveKit URLs", () => {
    expect(resolveMediaServerUrl("wss://khaothi.fermat.vn/livekit", { protocol: "https:", host: "x" })).toBe(
      "wss://khaothi.fermat.vn/livekit",
    );
  });

  it("joins relative paths with the current host", () => {
    expect(resolveMediaServerUrl("/livekit", { protocol: "https:", host: "abc.trycloudflare.com" })).toBe(
      "wss://abc.trycloudflare.com/livekit",
    );
    expect(resolveMediaServerUrl("/livekit", { protocol: "http:", host: "localhost:5173" })).toBe(
      "ws://localhost:5173/livekit",
    );
  });
});
