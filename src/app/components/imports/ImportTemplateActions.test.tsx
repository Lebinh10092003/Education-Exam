import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { questionImportTemplate } from "../../lib/importTemplates";
import { ImportTemplateActions } from "./ImportTemplateActions";

describe("ImportTemplateActions", () => {
  it("opens a wide template preview dialog with the shared template content", async () => {
    const user = userEvent.setup();

    render(
      <ImportTemplateActions
        template={questionImportTemplate}
        selectedFormat="csv"
      />,
    );

    expect(screen.getByRole("button", { name: /view template/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download template/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /view template/i }));

    const dialogTitle = await screen.findByText(/question import template/i);
    const dialogContent = dialogTitle.closest('[data-slot="dialog-content"]');

    expect(dialogContent).toHaveClass("sm:max-w-5xl");
    expect(screen.getByText(/backend-compatible csv, json, or xlsx rows/i)).toBeInTheDocument();
  });
});
