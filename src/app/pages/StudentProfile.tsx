import { useMemo, useState } from "react";
import { Languages, Lock, Monitor, Moon, Phone, School, Sun, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";

import { useAuth } from "../auth/useAuth";
import { PageHeader } from "../components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { apiRequest } from "../lib/http";
import { notify } from "../lib/notify";
import { setStoredLocale, type AppLocale } from "../lib/storage";
import { useMutationState } from "../hooks/useMutationState";

type ThemePreference = "light" | "dark" | "system";

const normalizeTheme = (value: string | undefined): ThemePreference => {
  if (value === "dark" || value === "system") {
    return value;
  }
  return "light";
};

const normalizeLocale = (value: string | undefined): AppLocale =>
  value?.toLowerCase().startsWith("en") ? "en" : "vi";

export function StudentProfile() {
  const { t, i18n } = useTranslation(["common", "profile"]);
  const { theme, setTheme } = useTheme();
  const { profile } = useAuth();
  const passwordMutation = useMutationState();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const currentTheme = normalizeTheme(theme);
  const currentLocale = normalizeLocale(i18n.language ?? i18n.resolvedLanguage);

  const initials = useMemo(() => {
    const name = profile?.full_name || t("profile:student.userFallback");
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [profile?.full_name, t]);

  const translatedRoles =
    (profile?.roles ?? [])
      .map((role) => t(`common:roles.${role}`, { defaultValue: role }))
      .join(", ") || t("common:roles.candidate");

  const translatedStatus = t(`profile:student.status.${profile?.status ?? "inactive"}`, {
    defaultValue: profile?.status ?? "",
  });

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      notify.error(t("profile:student.messages.passwordRequired"));
      return;
    }

    try {
      await passwordMutation.run(() =>
        apiRequest("/api/v1/profile/change-password/", {
          method: "POST",
          body: {
            current_password: currentPassword,
            new_password: newPassword,
          },
        }),
      );
      setCurrentPassword("");
      setNewPassword("");
      notify.success(t("profile:student.messages.passwordUpdated"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("profile:student.messages.passwordUpdateFailed");
      notify.error(message);
    }
  };

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

  const themeOptions: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
    { value: "light", label: t("profile:student.themes.light"), icon: Sun },
    { value: "dark", label: t("profile:student.themes.dark"), icon: Moon },
    { value: "system", label: t("profile:student.themes.system"), icon: Monitor },
  ];

  const localeOptions: Array<{ value: AppLocale; label: string; icon: typeof Languages }> = [
    { value: "vi", label: t("common:locale.vietnamese"), icon: Languages },
    { value: "en", label: t("common:locale.english"), icon: Languages },
  ];

  return (
    <div>
      <PageHeader
        title={t("profile:student.title")}
        description={t("profile:student.description")}
      />

      {passwordMutation.error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {passwordMutation.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
        <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-950/70">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback>{initials || "ST"}</AvatarFallback>
              </Avatar>
              <h2 className="mt-4 text-xl font-semibold text-slate-950 dark:text-slate-100">
                {profile?.full_name || t("profile:student.userFallback")}
              </h2>
            </div>

            <div className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{t("profile:student.labels.roles")}</p>
                  <p>{translatedRoles}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <School className="mt-0.5 h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{t("profile:student.labels.school")}</p>
                  <p>{profile?.school?.name ?? t("profile:student.values.notAssigned")}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{t("profile:student.labels.phone")}</p>
                  <p>{profile?.phone_number || t("profile:student.values.notSet")}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-950/70">
            <CardHeader>
              <CardTitle>{t("profile:student.sections.accountDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 p-6 md:grid-cols-2">
              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {t("profile:student.messages.registrationLocked")}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="student-profile-full-name">{t("profile:student.labels.fullName")}</Label>
                <Input
                  id="student-profile-full-name"
                  className="mt-2"
                  value={profile?.full_name ?? ""}
                  disabled
                />
              </div>
              <div>
                <Label htmlFor="student-profile-phone">{t("profile:student.labels.phoneNumber")}</Label>
                <Input
                  id="student-profile-phone"
                  className="mt-2"
                  value={profile?.phone_number || t("profile:student.values.notSet")}
                  disabled
                />
              </div>
              <div>
                <Label htmlFor="student-profile-status">{t("profile:student.labels.accountStatus")}</Label>
                <Input id="student-profile-status" className="mt-2" value={translatedStatus} disabled />
              </div>
              <div>
                <Label htmlFor="student-profile-school">{t("profile:student.labels.school")}</Label>
                <Input
                  id="student-profile-school"
                  className="mt-2"
                  value={profile?.school?.name ?? t("profile:student.values.notAssigned")}
                  disabled
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-950/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-blue-600" />
                {t("profile:student.sections.security")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 p-6 md:grid-cols-2">
              <div>
                <Label htmlFor="student-profile-current-password">{t("profile:student.labels.currentPassword")}</Label>
                <Input
                  id="student-profile-current-password"
                  type="password"
                  className="mt-2"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="student-profile-new-password">{t("profile:student.labels.newPassword")}</Label>
                <Input
                  id="student-profile-new-password"
                  type="password"
                  className="mt-2"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {t("profile:student.securityNote")}
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={() => void changePassword()} disabled={passwordMutation.isSubmitting}>
                  {passwordMutation.isSubmitting
                    ? t("profile:student.buttons.updatingPassword")
                    : t("profile:student.buttons.updatePassword")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-950/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-blue-600" />
                {t("profile:student.sections.systemSettings")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {t("profile:student.messages.settingsSaved")}
              </div>

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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
