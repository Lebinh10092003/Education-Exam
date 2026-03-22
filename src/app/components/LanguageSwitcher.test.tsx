import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import i18n from "../i18n";
import { LOCALE_STORAGE_KEY } from "../lib/storage";
import { LanguageSwitcher } from "./LanguageSwitcher";

describe("LanguageSwitcher", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("vi");
  });

  it("changes the active locale and persists it locally", async () => {
    const user = userEvent.setup();

    render(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: /VI/i }));
    await user.click(await screen.findByRole("menuitemradio", { name: /English/i }));

    await waitFor(() => {
      expect(i18n.resolvedLanguage).toBe("en");
    });

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
    expect(screen.getByRole("button", { name: /EN/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /EN/i }));
    await user.click(await screen.findByRole("menuitemradio", { name: /Ti.ng Vi.t/i }));

    await waitFor(() => {
      expect(i18n.resolvedLanguage ?? i18n.language).toMatch(/^vi/);
    });

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("vi");
    expect(screen.getByRole("button", { name: /VI/i })).toBeInTheDocument();
  });
});
