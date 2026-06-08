import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  Globe2,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";

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

const SUPPORT_ZALO_URL = "https://zalo.me/fermattech";
const SUPPORT_PHONE = "0969 627 162";
const SUPPORT_EMAIL = "khaothi@fermat.vn";

const partners = [
  {
    name: "School Connect Online",
    initials: "SCO",
    className: "bg-blue-700",
  },
  {
    name: "AYSBC",
    initials: "AY",
    className: "bg-emerald-600",
  },
  {
    name: "FermatTech",
    initials: "FT",
    className: "bg-slate-900",
  },
];

const normalizeLoginErrorMessage = (message: string) =>
  message.trim() === "User is inactive"
    ? "Your account is inactive or locked. Please contact an administrator."
    : message;

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { isSubmitting, run } = useMutationState();
  const { t } = useTranslation(["auth", "common"]);

  const [identifier, setIdentifier] = useState("candidate@example.com");
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
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-700 text-sm font-black text-white">
              FT
            </div>
            <div>
              <p className="font-bold leading-none text-slate-950 dark:text-white">FermatTech</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Candidate portal
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button asChild variant="outline" className="rounded-lg border-slate-300 px-3" aria-label="Trang chủ">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Trang chủ</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-16">
        <section className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-800 shadow-sm dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Cổng đăng nhập thí sinh
          </div>
          <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-normal text-slate-950 sm:text-5xl dark:text-white">
            Đăng nhập để vào phòng thi và khu vực được BTC phân công
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Kiểm tra email để nhận thông tin đăng nhập hoặc liên hệ với BTC.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {partners.map((partner) => (
              <div
                key={partner.name}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${partner.className} text-[10px] font-black text-white`}>
                  {partner.initials}
                </div>
                <p className="mt-3 text-sm font-bold leading-5 text-slate-900 dark:text-white">{partner.name}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="flex items-center gap-3">
              <Globe2 className="h-6 w-6 text-blue-700 dark:text-blue-300" />
              <h2 className="text-lg font-black uppercase tracking-wide text-slate-950 dark:text-white">
                LIÊN HỆ HỖ TRỢ
              </h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-200">
              Mọi thắc mắc cần giải đáp, Phụ huynh có thể liên hệ với BTC qua:
            </p>
            <div className="mt-5 grid gap-3">
              <a
                href={SUPPORT_ZALO_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-900 hover:border-blue-400 dark:border-blue-800 dark:bg-slate-950 dark:text-blue-200"
              >
                <span>Zalo OA: {SUPPORT_ZALO_URL}</span>
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
                className="flex items-center gap-3 rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:border-blue-400 dark:border-blue-800 dark:bg-slate-950 dark:text-white"
              >
                <Phone className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                Hotline: {SUPPORT_PHONE}
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-3 rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:border-blue-400 dark:border-blue-800 dark:bg-slate-950 dark:text-white"
              >
                <Mail className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                Email: {SUPPORT_EMAIL}
              </a>
            </div>
            <p className="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200">Trân trọng,</p>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <Card className="w-full max-w-md rounded-lg border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-blue-700 text-white shadow-sm">
                <LockKeyhole className="h-7 w-7" />
              </div>
              <CardTitle className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">
                {t("auth:login.title")}
              </CardTitle>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Dành cho thí sinh đã nhận tài khoản từ Ban Tổ chức.
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <Label htmlFor="identifier" className="text-sm font-bold">
                    {t("auth:login.identifierLabel")}
                  </Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder={t("auth:login.identifierPlaceholder")}
                    className="mt-2 rounded-lg border-slate-300"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-sm font-bold">
                    {t("auth:login.passwordLabel")}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="mt-2 rounded-lg border-slate-300"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-300">{t("auth:login.rememberMe")}</span>
                  </label>
                  <Link to="/forgot-password" className="text-sm font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300">
                    {t("auth:login.forgotPassword")}
                  </Link>
                </div>
                <Button className="w-full rounded-lg bg-blue-700 text-white hover:bg-blue-800" size="lg" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("auth:login.submitting")}
                    </>
                  ) : (
                    t("auth:login.submit")
                  )}
                </Button>
              </form>

              <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                <p className="flex items-center gap-2 font-bold">
                  <CheckCircle className="h-4 w-4" />
                  {t("auth:login.demoCredentials")}
                </p>
                <p className="mt-2 font-mono text-xs">candidate@example.com / admin123456</p>
              </div>

              <div className="mt-6 text-center">
                <Link to="/" className="text-sm font-semibold text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300">
                  Quay lại xem các cuộc thi
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
