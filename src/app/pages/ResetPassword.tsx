import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { apiRequest } from "../lib/http";
import { notify } from "../lib/notify";
import { useMutationState } from "../hooks/useMutationState";

export function ResetPassword() {
  const { t } = useTranslation(["auth", "common"]);
  const [searchParams] = useSearchParams();
  const mutation = useMutationState();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const uid = useMemo(() => searchParams.get("uid") ?? "", [searchParams]);
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const handleSubmit = async () => {
    if (!uid || !token) {
      notify.error(t("auth:errors.resetRequestFailed"));
      return;
    }

    if (newPassword !== confirmPassword) {
      notify.error(t("auth:errors.passwordMismatch"));
      return;
    }

    try {
      const response = await mutation.run(() =>
        apiRequest<{ detail: string }>("/api/v1/auth/reset-password/", {
          method: "POST",
          auth: false,
          body: {
            uid,
            token,
            new_password: newPassword,
            confirm_password: confirmPassword,
          },
        }),
      );
      setSuccessMessage(response.detail);
      notify.success(response.detail);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t("auth:errors.resetRequestFailed"));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="relative w-full max-w-md">
        <div className="absolute right-0 top-0 z-10">
          <LanguageSwitcher />
        </div>
        <Card className="w-full">
          <CardHeader className="text-center pb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-3xl">E</span>
            </div>
            <CardTitle className="text-2xl font-bold">{t("auth:resetPassword.title")}</CardTitle>
            <p className="text-gray-600 mt-2">{t("auth:resetPassword.description")}</p>
          </CardHeader>
          <CardContent>
            {successMessage ? (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {successMessage}
              </div>
            ) : null}
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
            >
              <div>
                <Label htmlFor="reset-password-new">{t("auth:resetPassword.newPasswordLabel")}</Label>
                <Input
                  id="reset-password-new"
                  type="password"
                  className="mt-2"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label htmlFor="reset-password-confirm">{t("auth:resetPassword.confirmPasswordLabel")}</Label>
                <Input
                  id="reset-password-confirm"
                  type="password"
                  className="mt-2"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button className="w-full" size="lg" disabled={mutation.isSubmitting}>
                {mutation.isSubmitting ? t("auth:resetPassword.submitting") : t("auth:resetPassword.submit")}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("auth:resetPassword.goToLogin")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
