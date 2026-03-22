import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { notify } from "../lib/notify";

import { getDefaultRouteForProfile } from "../auth/AuthContext";
import { useAuth } from "../auth/useAuth";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useMutationState } from "../hooks/useMutationState";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";

const normalizeLoginErrorMessage = (message: string) =>
  message.trim() === "User is inactive"
    ? "Your account is inactive or locked. Please contact an administrator."
    : message;

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { isSubmitting, run } = useMutationState();
  const { t } = useTranslation(["auth", "common"]);

  const [identifier, setIdentifier] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123456");
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const profile = await run(() => login(identifier.trim(), password));
      notify.success(t("auth:login.success"));
      navigate(getDefaultRouteForProfile(profile), { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("auth:errors.invalidCredentials");
      notify.error(normalizeLoginErrorMessage(message), {
        title: t("auth:login.failedTitle"),
        timer: 4000,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 flex items-center justify-center p-6">
      <div className="relative w-full max-w-md">
        <div className="absolute right-0 top-0 z-10">
          <LanguageSwitcher />
        </div>
        <Card className="w-full shadow-xl border-blue-100">
        <CardHeader className="text-center pb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <span className="text-white font-bold text-3xl">E</span>
          </div>
          <CardTitle className="text-3xl font-bold">{t("common:app.name")}</CardTitle>
          <p className="text-gray-600 mt-2">{t("auth:login.title")}</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="identifier">{t("auth:login.identifierLabel")}</Label>
              <Input
                id="identifier"
                type="text"
                placeholder={t("auth:login.identifierPlaceholder")}
                className="mt-2"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">{t("auth:login.passwordLabel")}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="mt-2"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <span className="text-sm text-gray-600">{t("auth:login.rememberMe")}</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {t("auth:login.forgotPassword")}
              </Link>
            </div>
            <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("auth:login.submitting") : t("auth:login.submit")}
            </Button>
          </form>
          <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <p className="font-medium">{t("auth:login.demoCredentials")}</p>
            <p className="mt-1">admin@example.com / admin123456</p>
          </div>
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {t("auth:login.noAccount")}{" "}
              <span className="text-blue-600 font-medium">{t("auth:login.contactAdmin")}</span>
            </p>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
