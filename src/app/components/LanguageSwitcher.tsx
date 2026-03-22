import { useEffect, useState } from "react";
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
  const [currentLocale, setCurrentLocale] = useState<AppLocale>(() =>
    normalizeLocale(i18n.language || i18n.resolvedLanguage),
  );

  useEffect(() => {
    const syncLocale = (locale?: string) => {
      setCurrentLocale(normalizeLocale(locale ?? i18n.language ?? i18n.resolvedLanguage));
    };

    syncLocale();
    i18n.on("languageChanged", syncLocale);

    return () => {
      i18n.off("languageChanged", syncLocale);
    };
  }, [i18n]);

  const handleChange = async (locale: string) => {
    if (locale !== "vi" && locale !== "en") {
      return;
    }

    setCurrentLocale(locale);
    setStoredLocale(locale);
    await i18n.changeLanguage(locale);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Languages className="h-4 w-4" />
          {currentLocale.toUpperCase()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("locale.label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={currentLocale} onValueChange={(value) => void handleChange(value)}>
          <DropdownMenuRadioItem value="vi">{t("locale.vietnamese")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en">{t("locale.english")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
