import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { notify } from "../lib/notify";

import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { apiRequest } from "../lib/http";
import { useMutationState } from "../hooks/useMutationState";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const mutation = useMutationState();
  const { t } = useTranslation(["auth", "common"]);

  const handleSubmit = async () => {
    if (!email.trim()) {
      notify.error(t("auth:errors.emailRequired"));
      return;
    }

    try {
      const response = await mutation.run(() =>
        apiRequest<{ detail: string }>("/api/v1/auth/forgot-password/", {
          method: "POST",
          auth: false,
          body: { email: email.trim() },
        }),
      );
      setSuccessMessage(response.detail);
      notify.success(t("auth:forgotPassword.success"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("auth:errors.resetRequestFailed");
      notify.error(message);
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
          <CardTitle className="text-2xl font-bold">{t("auth:forgotPassword.title")}</CardTitle>
          <p className="text-gray-600 mt-2">
            {t("auth:forgotPassword.description")}
          </p>
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
              <Label htmlFor="forgot-password-email">{t("auth:forgotPassword.emailLabel")}</Label>
              <Input
                id="forgot-password-email"
                type="email"
                placeholder={t("auth:forgotPassword.emailPlaceholder")}
                className="mt-2"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <Button className="w-full" size="lg" disabled={mutation.isSubmitting}>
              {mutation.isSubmitting ? t("auth:forgotPassword.submitting") : t("auth:forgotPassword.submit")}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("auth:forgotPassword.backToLogin")}
            </Link>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
