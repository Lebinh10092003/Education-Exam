import { Languages, Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";

import { DEFAULT_LOCALE, setStoredLocale, type AppLocale } from "../lib/storage";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";

type ThemePreference = "light" | "dark" | "system";

const normalizeTheme = (value: string | undefined): ThemePreference => {
  if (value === "dark" || value === "system") {
    return value;
  }
  return "light";
};

const normalizeLocale = (value: string | undefined): AppLocale =>
  value?.toLowerCase().startsWith("en") ? "en" : DEFAULT_LOCALE;

type StudentSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function StudentSettingsDialog({ open, onOpenChange }: StudentSettingsDialogProps) {
  const { t, i18n } = useTranslation(["common", "profile"]);
  const { theme, setTheme } = useTheme();

  const currentTheme = normalizeTheme(theme);
  const currentLocale = normalizeLocale(i18n.resolvedLanguage ?? i18n.language);

  const themeOptions: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
    { value: "light", label: t("profile:student.themes.light"), icon: Sun },
    { value: "dark", label: t("profile:student.themes.dark"), icon: Moon },
    { value: "system", label: t("profile:student.themes.system"), icon: Monitor },
  ];

  const localeOptions: Array<{ value: AppLocale; label: string; icon: typeof Languages }> = [
    { value: "vi", label: t("common:locale.vietnamese"), icon: Languages },
    { value: "en", label: t("common:locale.english"), icon: Languages },
  ];

  const updateThemePreference = (nextTheme: ThemePreference) => {
    if (nextTheme === currentTheme) {
      return;
    }

    setTheme(nextTheme);
  };

  const updateLocalePreference = async (nextLocale: AppLocale) => {
    if (nextLocale === currentLocale) {
      return;
    }

    setStoredLocale(nextLocale);
    await i18n.changeLanguage(nextLocale);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("profile:student.sections.systemSettings")}</DialogTitle>
          <DialogDescription>{t("profile:student.messages.settingsSaved")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label>{t("profile:student.labels.appearanceTheme")}</Label>
            <div className="grid gap-3 md:grid-cols-3">
              {themeOptions.map((option) => {
                const active = option.value === currentTheme;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    aria-pressed={active}
                    className={
                      active
                        ? "justify-start border-blue-600 bg-blue-600 text-white hover:bg-blue-600 hover:text-white"
                        : "justify-start"
                    }
                    onClick={() => updateThemePreference(option.value)}
                  >
                    <option.icon className="h-4 w-4" />
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <Label>{t("profile:student.labels.defaultLanguage")}</Label>
            <div className="grid gap-3 md:grid-cols-2">
              {localeOptions.map((option) => {
                const active = option.value === currentLocale;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    aria-pressed={active}
                    className={
                      active
                        ? "justify-start border-blue-600 bg-blue-600 text-white hover:bg-blue-600 hover:text-white"
                        : "justify-start"
                    }
                    onClick={() => void updateLocalePreference(option.value)}
                  >
                    <option.icon className="h-4 w-4" />
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.close")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
