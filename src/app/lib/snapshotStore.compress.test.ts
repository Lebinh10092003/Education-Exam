import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compressSnapshotForUpload } from "./snapshotStore";

type FakeCanvas = {
  width: number;
  height: number;
  getContext: () => { drawImage: ReturnType<typeof vi.fn>; imageSmoothingEnabled: boolean; imageSmoothingQuality: string };
  toBlob: (callback: (blob: Blob | null) => void, type: string, quality: number) => void;
};

const blobOfSize = (size: number, type: string) => new Blob([new Uint8Array(size)], { type });

describe("compressSnapshotForUpload", () => {
  const originalCreateElement = document.createElement.bind(document);
  let canvases: FakeCanvas[] = [];
  let encoder: (type: string, quality: number, canvas: FakeCanvas) => Blob | null;

  beforeEach(() => {
    canvases = [];
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 1920;
        naturalHeight = 1080;
        width = 1920;
        height = 1080;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName !== "canvas") {
        return originalCreateElement(tagName);
      }
      const canvas: FakeCanvas = {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: "low" }),
        toBlob: (callback, type, quality) => callback(encoder(type, quality, canvas)),
      };
      canvases.push(canvas);
      return canvas as unknown as HTMLElement;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("downscales webcam snapshots and prefers WebP", async () => {
    encoder = (type) => (type === "image/webp" ? blobOfSize(40_000, "image/webp") : blobOfSize(90_000, type));

    const result = await compressSnapshotForUpload(blobOfSize(300_000, "image/jpeg"), "webcam_snapshot");

    expect(result.type).toBe("image/webp");
    expect(result.size).toBe(40_000);
    expect(canvases[0].width).toBe(960);
    expect(canvases[0].height).toBe(540);
  });

  it("keeps screen captures larger so text stays readable", async () => {
    encoder = (type) => blobOfSize(80_000, type);

    await compressSnapshotForUpload(blobOfSize(500_000, "image/jpeg"), "screen_capture");

    expect(canvases[0].width).toBe(1280);
  });

  it("falls back to JPEG when the browser silently returns PNG for WebP", async () => {
    encoder = (type) => (type === "image/webp" ? blobOfSize(900_000, "image/png") : blobOfSize(70_000, "image/jpeg"));

    const result = await compressSnapshotForUpload(blobOfSize(300_000, "image/jpeg"), "webcam_snapshot");

    expect(result.type).toBe("image/jpeg");
    expect(result.size).toBe(70_000);
  });

  it("never returns a file bigger than the original", async () => {
    encoder = (type) => blobOfSize(500_000, type);
    const original = blobOfSize(120_000, "image/jpeg");

    const result = await compressSnapshotForUpload(original, "webcam_snapshot");

    expect(result).toBe(original);
  });
});
