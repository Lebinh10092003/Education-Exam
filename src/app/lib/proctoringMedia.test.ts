import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConnect = vi.fn();
const mockPublishTrack = vi.fn();

vi.mock("livekit-client", () => ({
  Room: vi.fn(function MockRoom() {
    return {
      connect: (...args: unknown[]) => mockConnect(...args),
      localParticipant: {
        publishTrack: (...args: unknown[]) => mockPublishTrack(...args),
      },
      disconnect: vi.fn(),
    };
  }),
  Track: {
    Source: {
      Camera: "camera",
    },
  },
}));

describe("proctoringMedia", () => {
  beforeEach(() => {
    vi.resetModules();
    mockConnect.mockReset();
    mockPublishTrack.mockReset();
  });

  it("surfaces a local setup hint when the LiveKit signal server is unreachable", async () => {
    mockConnect.mockRejectedValue(new Error("could not establish signal connection: Failed to fetch"));

    const { connectCandidatePublisher } = await import("./proctoringMedia");

    await expect(
      connectCandidatePublisher(
        {
          provider: "livekit",
          server_url: "ws://127.0.0.1:7880",
          room_name: "room",
          participant_name: "candidate-1-session-1",
          access_token: "token",
          expires_at: "2026-03-23T00:00:00Z",
        },
        {} as MediaStreamTrack,
      ),
    ).rejects.toThrow(/docker compose up -d livekit/i);
  });
});
