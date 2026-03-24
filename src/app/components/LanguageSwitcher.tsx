import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { DEFAULT_LOCALE, type AppLocale, setStoredLocale } from "../lib/storage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";

const normalizeLocale = (value: string | undefined): AppLocale =>
  value?.toLowerCase().startsWith("en") ? "en" : DEFAULT_LOCALE;

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");
  const currentLocale = normalizeLocale(i18n.resolvedLanguage ?? i18n.language);

  const handleChange = async (locale: string) => {
    if (locale !== "vi" && locale !== "en") {
      return;
    }

    if (locale === currentLocale) {
      return;
    }

    setStoredLocale(locale);
    await i18n.changeLanguage(locale);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-legacy-i18n-ignore="true">
          <Languages className="h-4 w-4" />
          {currentLocale.toUpperCase()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44"
        data-legacy-i18n-ignore="true"
      >
        <DropdownMenuLabel>{t("locale.label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={currentLocale} onValueChange={(value) => void handleChange(value)}>
          <DropdownMenuRadioItem value="vi">{t("locale.vietnamese")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en">{t("locale.english")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
