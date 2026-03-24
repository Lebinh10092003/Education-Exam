import { useMemo, useState } from "react";
import { Lock, Phone, School, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../auth/useAuth";
import { PageHeader } from "../components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { apiRequest } from "../lib/http";
import { notify } from "../lib/notify";
import { useMutationState } from "../hooks/useMutationState";

export function StudentProfile() {
  const { t } = useTranslation(["common", "profile"]);
  const { profile } = useAuth();
  const passwordMutation = useMutationState();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

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
        </div>
      </div>
    </div>
  );
}
