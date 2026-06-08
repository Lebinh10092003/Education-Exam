import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Award,
  Bot,
  Calculator,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  Code2,
  ExternalLink,
  FlaskConical,
  Languages,
  Lightbulb,
  Mail,
  Moon,
  Phone,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";

import { useAuth } from "../auth/useAuth";
import { getDefaultRouteForProfile } from "../auth/AuthContext";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

const REGISTRATION_URL = "https://dangky.fermat.edu.vn/";
const SCO_URL = "https://www.schoolconnectonline.com/olympiad/vietnam.aspx";
const AYSBC_URL = "https://asiaysbc.com/";
const ZALO_URL = "https://zalo.me/fermattech";
const SUPPORT_EMAIL = "khaothi@fermat.vn";
const SUPPORT_PHONE = "0969 627 162";

type Tone = {
  badge: string;
  border: string;
  icon: string;
  text: string;
};

type Category = {
  key: string;
  icon: LucideIcon;
  tone: Tone;
};

type Partner = {
  key: "schoolConnect" | "aysbc" | "fermatTech";
  initials: string;
  href: string;
  tone: string;
  logo: string;
};

const categoryItems: Category[] = [
  {
    key: "math",
    icon: Calculator,
    tone: {
      badge: "bg-blue-50 text-blue-700",
      border: "border-blue-100",
      icon: "bg-blue-600 text-white",
      text: "text-blue-700",
    },
  },
  {
    key: "coding",
    icon: Code2,
    tone: {
      badge: "bg-cyan-50 text-cyan-700",
      border: "border-cyan-100",
      icon: "bg-cyan-600 text-white",
      text: "text-cyan-700",
    },
  },
  {
    key: "ai",
    icon: Bot,
    tone: {
      badge: "bg-violet-50 text-violet-700",
      border: "border-violet-100",
      icon: "bg-violet-600 text-white",
      text: "text-violet-700",
    },
  },
  {
    key: "science",
    icon: FlaskConical,
    tone: {
      badge: "bg-emerald-50 text-emerald-700",
      border: "border-emerald-100",
      icon: "bg-emerald-600 text-white",
      text: "text-emerald-700",
    },
  },
  {
    key: "english",
    icon: Languages,
    tone: {
      badge: "bg-amber-50 text-amber-700",
      border: "border-amber-100",
      icon: "bg-amber-500 text-white",
      text: "text-amber-700",
    },
  },
  {
    key: "finance",
    icon: Lightbulb,
    tone: {
      badge: "bg-rose-50 text-rose-700",
      border: "border-rose-100",
      icon: "bg-rose-600 text-white",
      text: "text-rose-700",
    },
  },
];

const partnerItems: Partner[] = [
  {
    key: "schoolConnect",
    initials: "SCO",
    href: SCO_URL,
    tone: "bg-blue-600",
    logo: "/scologo.svg",
  },
  {
    key: "aysbc",
    initials: "AY",
    href: AYSBC_URL,
    tone: "bg-emerald-600",
    logo: "/aysbc-logo.png",
  },
  {
    key: "fermatTech",
    initials: "FT",
    href: "https://fermat.edu.vn/",
    tone: "bg-slate-900",
    logo: "/fermat-logo.png",
  },
];

const journeyKeys = ["choose", "register", "email", "login", "certificate"] as const;
const benefitKeys = ["international", "materials", "reporting"] as const;

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-950 sm:text-4xl dark:text-white">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">{subtitle}</p>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <img src="/fermat-logo.png" alt="FermatTech" className="h-10 w-10 object-contain rounded-lg" />
      <div className="leading-tight">
        <p className="text-base font-bold text-slate-950 dark:text-white">FermatTech</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          Competitions
        </p>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { t } = useTranslation("landing");
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, profile } = useAuth();
  const [faqOpen, setFaqOpen] = useState<Record<number, boolean>>({ 1: true });

  const portalPath = profile ? getDefaultRouteForProfile(profile) : "/login";

  const scrollToId = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div
      className="min-h-screen bg-white text-slate-950 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100"
      data-legacy-i18n-ignore="true"
    >
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="FermatTech homepage">
            <BrandMark />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex dark:text-slate-300">
            <button className="hover:text-blue-700 dark:hover:text-blue-300" onClick={() => scrollToId("competitions")}>
              {t("nav.competitions")}
            </button>
            <button className="hover:text-blue-700 dark:hover:text-blue-300" onClick={() => scrollToId("partners")}>
              {t("nav.partners")}
            </button>
            <button className="hover:text-blue-700 dark:hover:text-blue-300" onClick={() => scrollToId("journey")}>
              {t("nav.journey")}
            </button>
            <button className="hover:text-blue-700 dark:hover:text-blue-300" onClick={() => scrollToId("support")}>
              {t("nav.support")}
            </button>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg border-slate-200 dark:border-slate-800"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="hidden h-4 w-4 dark:block" />
            </Button>
            <Button
              asChild
              className="hidden rounded-lg bg-blue-700 px-4 text-white hover:bg-blue-800 sm:inline-flex"
            >
              <a href={REGISTRATION_URL} target="_blank" rel="noreferrer">
                {t("hero.ctaRegister")}
              </a>
            </Button>
            <Button asChild variant="outline" className="hidden rounded-lg border-slate-300 px-3 sm:inline-flex">
              <Link to={isAuthenticated ? portalPath : "/login"}>
                {isAuthenticated ? t("nav.portal") : t("nav.login")}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-800 shadow-sm dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                <Sparkles className="h-3.5 w-3.5" />
                {t("hero.badge")}
              </div>
              <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-normal text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
                {t("hero.title")}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                {t("hero.subtitle")}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="rounded-lg bg-blue-700 px-6 text-white hover:bg-blue-800">
                  <a href={REGISTRATION_URL} target="_blank" rel="noreferrer">
                    {t("hero.ctaRegister")}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-lg border-slate-300 bg-white px-6 dark:bg-slate-950"
                  onClick={() => scrollToId("competitions")}
                >
                  {t("hero.ctaExplore")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button asChild size="lg" variant="ghost" className="rounded-lg px-6 text-blue-800 dark:text-blue-200">
                  <Link to="/login">{t("hero.ctaLogin")}</Link>
                </Button>
              </div>

              <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
                {[
                  ["6+", t("hero.statsCompetitions")],
                  ["3", t("hero.statsPartners")],
                  ["1-12", t("hero.statsGrades")],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{value}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      FermatTech
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-slate-950 dark:text-white">{t("hero.visualTitle")}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t("hero.visualSubtitle")}</p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-950 dark:text-white">{t("hero.visualExam")}</p>
                      <p className="mt-1 text-xs font-semibold text-blue-800 dark:text-blue-200">{t("hero.visualStatus")}</p>
                    </div>
                    <Award className="h-8 w-8 text-blue-700 dark:text-blue-300" />
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {[t("hero.visualChecklist1"), t("hero.visualChecklist2"), t("hero.visualChecklist3")].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
                    >
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  {partnerItems.map((partner) => (
                    <div key={partner.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950 flex flex-col items-center justify-center">
                      <img src={partner.logo} alt={partner.initials} className="mx-auto h-8 w-8 object-contain" />
                      <p className="mt-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 text-center">
                        {t(`partners.${partner.key}.name`)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="partners" className="border-b border-slate-200 py-14 dark:border-slate-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t("partners.title")} subtitle={t("partners.subtitle")} />
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {partnerItems.map((partner) => (
                <a
                  key={partner.key}
                  href={partner.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white p-1 border border-slate-200 shadow-sm">
                      <img src={partner.logo} alt={partner.initials} className="h-full w-full object-contain" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-950 dark:text-white">{t(`partners.${partner.key}.name`)}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {t(`partners.${partner.key}.desc`)}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-50 py-16 dark:bg-slate-900/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t("categories.title")} subtitle={t("categories.subtitle")} />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryItems.map((category) => {
                const Icon = category.icon;

                return (
                  <Card key={category.key} className={`rounded-lg border ${category.tone.border} bg-white dark:border-slate-800 dark:bg-slate-950`}>
                    <CardContent className="p-5">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${category.tone.icon}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">
                        {t(`categories.${category.key}.title`)}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {t(`categories.${category.key}.desc`)}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section id="competitions" className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t("competitions.title")} subtitle={t("competitions.subtitle")} />
            
            <div className="mt-10 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
              <table className="table table-bordered table-hover w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800/50 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-4 font-bold" width="46%">{t("competitions.table.headers.olympiad")}</th>
                    <th className="px-6 py-4 font-bold text-center" width="18%">{t("competitions.table.headers.cycle")}</th>
                    <th className="px-6 py-4 font-bold text-center" width="22%">{t("competitions.table.headers.date")}</th>
                    <th className="px-6 py-4 font-bold text-center" width="14%">{t("competitions.table.headers.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {[
                    { key: "imo", code: "IMO", cycle: "3", date: "31/05/2026", status: "upcoming" },
                    { key: "ico", code: "ICO", cycle: "3", date: "30/05/2026", status: "upcoming" },
                    { key: "ieio", code: "SCO IEIO", cycle: "3", date: "30/05/2026", status: "upcoming" },
                    { key: "ifko", code: "SCO IFKO", cycle: "3", date: "30/05/2026", status: "upcoming" },
                    { key: "ieo", code: "SCO IEO", cycle: "3", date: "07/06/2026", status: "upcoming" },
                    { key: "iso", code: "ISO", cycle: "3", date: "07/06/2026", status: "upcoming" },
                  ].map((exam) => (
                    <tr key={exam.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="exam-name font-semibold text-slate-900 dark:text-white block">
                          {t(`competitions.table.exams.${exam.key}.name`)}
                        </span>
                        <span className="exam-code text-xs text-slate-500 dark:text-slate-400 block mt-1">
                          {exam.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="cycle-badge inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {t("competitions.table.cycle", { num: exam.cycle })}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="date-badge inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          {exam.date}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="status-badge inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                          {t(`competitions.table.status.${exam.status}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="journey" className="border-y border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t("journey.title")} subtitle={t("journey.subtitle")} />
            <div className="mt-10 grid gap-4 md:grid-cols-5">
              {journeyKeys.map((key, index) => (
                <div key={key} className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-950 dark:text-white">{t(`journey.steps.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t(`journey.steps.${key}.desc`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="support" className="py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
            <div>
              <SectionHeading title={t("benefits.title")} subtitle={t("benefits.subtitle")} />
              <div className="mt-8 space-y-4">
                {benefitKeys.map((key) => (
                  <div key={key} className="flex gap-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <CheckCircle className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <h3 className="font-bold text-slate-950 dark:text-white">{t(`benefits.${key}.title`)}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t(`benefits.${key}.desc`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/30">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-700 text-white">
                <Users className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-3xl font-bold text-slate-950 dark:text-white">{t("support.title")}</h2>
              <p className="mt-3 text-base leading-7 text-slate-700 dark:text-slate-200">{t("support.subtitle")}</p>
              <p className="mt-4 rounded-lg border border-blue-200 bg-white p-4 text-sm font-semibold text-blue-900 dark:border-blue-800 dark:bg-slate-950 dark:text-blue-200">
                {t("support.note")}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <a
                  href={ZALO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-blue-200 bg-white p-4 text-sm font-bold text-slate-950 hover:border-blue-400 dark:border-blue-800 dark:bg-slate-950 dark:text-white flex flex-col items-start"
                >
                  <img src="/fermat-logo.png" className="mb-3 h-5 w-5 object-contain" alt="FermatTech" />
                  {t("support.zalo")}
                </a>
                <a
                  href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
                  className="rounded-lg border border-blue-200 bg-white p-4 text-sm font-bold text-slate-950 hover:border-blue-400 dark:border-blue-800 dark:bg-slate-950 dark:text-white"
                >
                  <Phone className="mb-3 h-5 w-5 text-blue-700 dark:text-blue-300" />
                  {SUPPORT_PHONE}
                </a>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="rounded-lg border border-blue-200 bg-white p-4 text-sm font-bold text-slate-950 hover:border-blue-400 dark:border-blue-800 dark:bg-slate-950 dark:text-white"
                >
                  <Mail className="mb-3 h-5 w-5 text-blue-700 dark:text-blue-300" />
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t("faqs.title")} subtitle={t("support.note")} />
            <div className="mt-8 space-y-3">
              {[1, 2, 3].map((num) => {
                const isOpen = faqOpen[num] || false;

                return (
                  <div key={num} className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                    <button
                      type="button"
                      onClick={() => setFaqOpen((current) => ({ ...current, [num]: !isOpen }))}
                      className="flex w-full items-center justify-between gap-4 text-left"
                    >
                      <span className="font-bold text-slate-950 dark:text-white">{t(`faqs.q${num}`)}</span>
                      <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen ? (
                      <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                        {t(`faqs.a${num}`)}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <BrandMark />
          <div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-blue-700 dark:hover:text-blue-300">
              {t("footer.contact")}
            </a>
            <a href="#" className="hover:text-blue-700 dark:hover:text-blue-300">
              {t("footer.privacy")}
            </a>
            <a href="#" className="hover:text-blue-700 dark:hover:text-blue-300">
              {t("footer.terms")}
            </a>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("footer.rights")}</p>
        </div>
      </footer>
    </div>
  );
}
