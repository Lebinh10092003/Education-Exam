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
      </>,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /EN/i }));
    await user.click(await screen.findByRole("menuitemradio", { name: /Ti.ng Vi.t/i }));

    await waitFor(() => {
      expect(screen.getByText(translateLegacyUiText("vi", "Dashboard"))).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /EN/i }));
    await user.click(await screen.findByRole("menuitemradio", { name: /^English$/i }));

    await waitFor(() => {
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
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
