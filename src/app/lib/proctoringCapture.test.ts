import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildProctoringResources,
  claimStashedProctoringStreams,
  hasStashedProctoringStreams,
  releaseStashedProctoringStreams,
  stashProctoringStreams,
} from "./proctoringCapture";

const fakeTrack = (kind: "video" | "audio") => {
  const track = { kind, readyState: "live", stop: vi.fn(() => { track.readyState = "ended"; }) };
  return track as unknown as MediaStreamTrack & { readyState: string; stop: ReturnType<typeof vi.fn> };
};

const fakeStream = (video: MediaStreamTrack[], audio: MediaStreamTrack[] = []) =>
  ({
    getVideoTracks: () => video,
    getAudioTracks: () => audio,
    getTracks: () => [...video, ...audio],
  }) as unknown as MediaStream;

const buildResources = () => {
  const camera = fakeTrack("video");
  const mic = fakeTrack("audio");
  const screen = fakeTrack("video");
  const resources = buildProctoringResources(fakeStream([camera], [mic]), fakeStream([screen]));
  return { resources, camera, mic, screen };
};

describe("proctoring permission hand-off", () => {
  afterEach(() => releaseStashedProctoringStreams());

  it("hands the granted streams from the system check to the exam page", () => {
    const { resources, camera } = buildResources();
    stashProctoringStreams(5, resources);

    expect(hasStashedProctoringStreams(5)).toBe(true);
    expect(hasStashedProctoringStreams(6)).toBe(false);
    expect(claimStashedProctoringStreams(5)).toBe(resources);
    // Da nhan thi khong con trong kho, va khong bi tat.
    expect(claimStashedProctoringStreams(5)).toBeNull();
    expect(camera.stop).not.toHaveBeenCalled();
  });

  it("does not reuse streams after the candidate stopped screen sharing", () => {
    const { resources, screen, camera } = buildResources();
    stashProctoringStreams(5, resources);
    screen.readyState = "ended";

    expect(claimStashedProctoringStreams(5)).toBeNull();
    expect(camera.stop).toHaveBeenCalled();
  });

  it("stops unclaimed streams when released", () => {
    const { resources, camera, mic, screen } = buildResources();
    stashProctoringStreams(5, resources);
    releaseStashedProctoringStreams();

    expect(camera.stop).toHaveBeenCalled();
    expect(mic.stop).toHaveBeenCalled();
    expect(screen.stop).toHaveBeenCalled();
    expect(hasStashedProctoringStreams(5)).toBe(false);
  });
});
