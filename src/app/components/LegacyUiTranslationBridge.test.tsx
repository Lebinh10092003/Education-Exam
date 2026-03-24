import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import i18n from "../i18n";
import { translateLegacyUiText } from "../i18n/legacyUiFallback";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LegacyUiTranslationBridge } from "./LegacyUiTranslationBridge";

describe("LegacyUiTranslationBridge", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("updates hardcoded UI copy immediately when the locale changes", async () => {
    const user = userEvent.setup();

    render(
      <>
        <LegacyUiTranslationBridge />
        <LanguageSwitcher />
        <div>Dashboard</div>
        <div>Name</div>
        <div>Create Period</div>
        <div>Created 24 Mar 2026</div>
        <div>Updated 24 Mar 2026, 21:06</div>
        <div>24 Mar 2026, 21:06</div>
        <div>Used by 2 exam(s)</div>
        <div>Showing 1-1 of 1 proctored exams</div>
        <div>Pause Exam</div>
      </>,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Showing 1-1 of 1 proctored exams")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /EN/i }));
    await user.click(await screen.findByRole("menuitemradio", { name: /Ti.ng Vi.t/i }));

    await waitFor(() => {
      expect(screen.getByText(translateLegacyUiText("vi", "Dashboard"))).toBeInTheDocument();
      expect(screen.getByText(translateLegacyUiText("vi", "Name"))).toBeInTheDocument();
      expect(screen.getByText(translateLegacyUiText("vi", "Create Period"))).toBeInTheDocument();
      expect(screen.getByText(translateLegacyUiText("vi", "Created 24 Mar 2026"))).toBeInTheDocument();
      expect(screen.getByText(translateLegacyUiText("vi", "Updated 24 Mar 2026, 21:06"))).toBeInTheDocument();
      expect(screen.getByText(translateLegacyUiText("vi", "24 Mar 2026, 21:06"))).toBeInTheDocument();
      expect(screen.getByText(translateLegacyUiText("vi", "Used by 2 exam(s)"))).toBeInTheDocument();
      expect(
        screen.getByText(translateLegacyUiText("vi", "Showing 1-1 of 1 proctored exams")),
      ).toBeInTheDocument();
      expect(screen.getByText(translateLegacyUiText("vi", "Pause Exam"))).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /EN/i }));
    await user.click(await screen.findByRole("menuitemradio", { name: /^English$/i }));

    await waitFor(() => {
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Create Period")).toBeInTheDocument();
      expect(screen.getByText("Created 24 Mar 2026")).toBeInTheDocument();
      expect(screen.getByText("Updated 24 Mar 2026, 21:06")).toBeInTheDocument();
      expect(screen.getByText("24 Mar 2026, 21:06")).toBeInTheDocument();
      expect(screen.getByText("Used by 2 exam(s)")).toBeInTheDocument();
      expect(screen.getByText("Showing 1-1 of 1 proctored exams")).toBeInTheDocument();
      expect(screen.getByText("Pause Exam")).toBeInTheDocument();
    });
  });

  it("does not translate text or attributes inside ignored legacy-i18n regions", async () => {
    render(
      <>
        <LegacyUiTranslationBridge />
        <div>Dashboard</div>
        <div data-legacy-i18n-ignore="true">
          <div>Dashboard</div>
          <input aria-label="Search..." placeholder="Search..." title="Search..." />
        </div>
      </>,
    );

    await act(async () => {
      await i18n.changeLanguage("vi");
    });

    await waitFor(() => {
      expect(screen.getByText(translateLegacyUiText("vi", "Dashboard"))).toBeInTheDocument();
    });

    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    expect(screen.getByTitle("Search...")).toBeInTheDocument();
    expect(screen.getByLabelText("Search...")).toBeInTheDocument();
  });
});
