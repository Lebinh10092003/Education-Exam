import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../../i18n";
import { MaterialPreviewPanel } from "./MaterialPreviewPanel";

const mockConvertToHtml = vi.fn();

vi.mock("mammoth", () => ({
  default: {
    convertToHtml: (...args: unknown[]) => mockConvertToHtml(...args),
  },
}));

describe("MaterialPreviewPanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("en");
  });

  it("renders PDF files in an iframe preview", () => {
    render(
      <MaterialPreviewPanel
        file_name="guide.pdf"
        file_url="/media/materials/guide.pdf"
        mime_type="application/pdf"
        title="Study Guide"
      />,
    );

    expect(screen.getByTitle("Study Guide")).toBeInTheDocument();
  });

  it("suppresses direct download controls for protected PDF previews when requested", () => {
    render(
      <MaterialPreviewPanel
        disableDownloadControls
        file_name="guide.pdf"
        file_url="/media/materials/guide.pdf"
        mime_type="application/pdf"
        title="Study Guide"
      />,
    );

    expect(screen.getByTitle("Study Guide")).toHaveAttribute(
      "src",
      "/media/materials/guide.pdf#toolbar=0&navpanes=0&scrollbar=1",
    );
  });

  it("loads plain text files into a readable preview", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("chapter 1\nchapter 2", { status: 200 }),
    );

    render(
      <MaterialPreviewPanel
        file_name="notes.txt"
        file_url="/media/materials/notes.txt"
        mime_type="text/plain"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/chapter 1/i)).toBeInTheDocument();
    });
  });

  it("renders DOCX previews through mammoth conversion", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    );
    mockConvertToHtml.mockResolvedValueOnce({ value: "<p>Converted content</p>" });

    render(
      <MaterialPreviewPanel
        file_name="lesson-plan.docx"
        file_url="/media/materials/lesson-plan.docx"
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Converted content")).toBeInTheDocument();
    });
  });

  it("shows a fallback message for unsupported legacy office files", () => {
    render(
      <MaterialPreviewPanel
        file_name="legacy.doc"
        file_url="/media/materials/legacy.doc"
        mime_type="application/msword"
      />,
    );

    expect(screen.getByText(/inline preview is not available/i)).toBeInTheDocument();
  });
});
