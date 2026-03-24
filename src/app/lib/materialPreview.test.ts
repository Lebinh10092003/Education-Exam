import { describe, expect, it } from "vitest";

import { canPreviewMaterial, getMaterialPreviewKind, resolveMaterialFileUrl } from "./materialPreview";

describe("materialPreview", () => {
  it("classifies common inline preview types from MIME metadata", () => {
    expect(
      getMaterialPreviewKind({
        file_url: "/media/guide.pdf",
        file_name: "guide.pdf",
        mime_type: "application/pdf",
      }),
    ).toBe("pdf");

    expect(
      getMaterialPreviewKind({
        file_url: "/media/notes.txt",
        file_name: "notes.txt",
        mime_type: "text/plain",
      }),
    ).toBe("text");

    expect(
      getMaterialPreviewKind({
        file_url: "/media/photo.png",
        file_name: "photo.png",
        mime_type: "image/png",
      }),
    ).toBe("image");
  });

  it("falls back to the file extension when MIME metadata is missing", () => {
    expect(
      getMaterialPreviewKind({
        file_url: "/media/report.docx",
        file_name: "report.docx",
        mime_type: "",
      }),
    ).toBe("docx");

    expect(
      getMaterialPreviewKind({
        file_url: "/media/recording.webm",
        file_name: "recording.webm",
        mime_type: "",
      }),
    ).toBe("video");
  });

  it("marks unsupported legacy office files as non-previewable", () => {
    expect(
      canPreviewMaterial({
        file_url: "/media/legacy.doc",
        file_name: "legacy.doc",
        mime_type: "application/msword",
      }),
    ).toBe(false);
  });

  it("keeps relative media URLs same-origin friendly", () => {
    expect(resolveMaterialFileUrl("/media/materials/guide.pdf")).toBe("/media/materials/guide.pdf");
    expect(resolveMaterialFileUrl("media/materials/guide.pdf")).toBe("/media/materials/guide.pdf");
    expect(resolveMaterialFileUrl("https://cdn.example.com/guide.pdf")).toBe("https://cdn.example.com/guide.pdf");
  });
});
