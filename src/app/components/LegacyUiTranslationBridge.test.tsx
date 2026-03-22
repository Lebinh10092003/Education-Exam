import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import i18n from "../i18n";
import { translateLegacyUiText } from "../i18n/legacyUiFallback";
import { LegacyUiTranslationBridge } from "./LegacyUiTranslationBridge";
import { LanguageSwitcher } from "./LanguageSwitcher";

describe("LegacyUiTranslationBridge", () => {
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
  });
});
