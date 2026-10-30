import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  afterEach(() => cleanup());

  it("keeps the wide logo's aspect ratio instead of squeezing it into a square", () => {
    render(<BrandLogo subtitle="EduExam" />);
    const logo = screen.getByAltText("FermatTech");
    expect(logo).toHaveAttribute("src", "/fermat-logo.png");
    expect(logo.className).toContain("w-auto");
    expect(logo.className).not.toMatch(/\bw-10\b/);
    expect(screen.getByText("EduExam")).toBeInTheDocument();
  });

  it("renders the square mark for collapsed sidebars", () => {
    render(<BrandLogo variant="mark" />);
    expect(screen.getByAltText("FermatTech")).toHaveAttribute("src", "/fermat-mark.svg");
  });
});
