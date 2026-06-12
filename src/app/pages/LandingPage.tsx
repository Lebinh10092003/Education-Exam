import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  Atom,
  Award,
  BrainCircuit,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  Code2,
  ExternalLink,
  Languages,
  Mail,
  Moon,
  Network,
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
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

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
  image?: string;
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
    icon: Network,
    image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=600",
    tone: {
      badge: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
      border: "border-slate-200 dark:border-slate-800",
      icon: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
      text: "text-slate-900 dark:text-white",
    },
  },
  {
    key: "coding",
    icon: Code2,
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=600",
    tone: {
      badge: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
      border: "border-slate-200 dark:border-slate-800",
      icon: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
      text: "text-slate-900 dark:text-white",
    },
  },
  {
    key: "ai",
    icon: BrainCircuit,
    image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=600",
    tone: {
      badge: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
      border: "border-slate-200 dark:border-slate-800",
      icon: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
      text: "text-slate-900 dark:text-white",
    },
  },
  {
    key: "science",
    icon: Atom,
    image: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=600",
    tone: {
      badge: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
      border: "border-slate-200 dark:border-slate-800",
      icon: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
      text: "text-slate-900 dark:text-white",
    },
  },
  {
    key: "english",
    icon: Languages,
    image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=600",
    tone: {
      badge: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
      border: "border-slate-200 dark:border-slate-800",
      icon: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
      text: "text-slate-900 dark:text-white",
    },
  },
  {
    key: "finance",
    icon: Activity,
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=600",
    tone: {
      badge: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
      border: "border-slate-200 dark:border-slate-800",
      icon: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
      text: "text-slate-900 dark:text-white",
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

interface PublicResultRecord {
  id: number;
  candidate_name: string;
  exam_name: string;
  subject_name: string;
  score: string;
  max_score: string;
  percentage: string;
  passed: boolean | null;
  completed_date: string;
}

export function LandingPage() {
  const { t } = useTranslation("landing");
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, profile } = useAuth();
  const [faqOpen, setFaqOpen] = useState<Record<number, boolean>>({ 1: true });

  const [lookupType, setLookupType] = useState<"username" | "personal">("username");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<PublicResultRecord[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setHasSearched(true);
    setResults(null);

    const queryParams: Record<string, string> = { type: lookupType };
    if (lookupType === "username") {
      queryParams.username = username;
    } else {
      queryParams.full_name = fullName;
      queryParams.date_of_birth = dob;
      queryParams.phone_number = phone;
    }

    try {
      const data = await apiRequest<PaginatedResponse<PublicResultRecord>>("/api/v1/public-results/lookup/", {
        query: queryParams,
      });
      setResults(data.results ?? []);
    } catch (err) {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

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

          <nav className="hidden items-center gap-8 text-xs font-bold uppercase tracking-widest text-slate-500 md:flex dark:text-slate-400">
            <button className="hover:text-slate-950 dark:hover:text-white transition-colors" onClick={() => scrollToId("competitions")}>
              {t("nav.competitions")}
            </button>
            <button className="hover:text-slate-950 dark:hover:text-white transition-colors" onClick={() => scrollToId("partners")}>
              {t("nav.partners")}
            </button>
            <button className="hover:text-slate-950 dark:hover:text-white transition-colors" onClick={() => scrollToId("journey")}>
              {t("nav.journey")}
            </button>
            <button className="hover:text-slate-950 dark:hover:text-white transition-colors" onClick={() => scrollToId("result-lookup")}>
              {t("lookup.title")}
            </button>
            <button className="hover:text-slate-950 dark:hover:text-white transition-colors" onClick={() => scrollToId("support")}>
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
              className="hidden rounded-none bg-slate-950 px-6 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:inline-flex transition-colors text-xs font-bold uppercase tracking-widest"
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
        <section className="relative overflow-hidden bg-slate-950 min-h-[85vh] flex items-center">
          {/* Minimalist Background Image */}
          <div className="absolute inset-0 z-0">
            <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=2000" alt="Students learning" className="h-full w-full object-cover opacity-60 dark:opacity-40" />
            <div className="absolute inset-0 bg-slate-900/40 mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/20 to-slate-900/80" />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-24 sm:px-6 lg:px-8 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-sm mb-8">
              <Sparkles className="h-3 w-3" />
              {t("hero.badge")}
            </div>
            
            <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              {t("hero.title")}
            </h1>
            
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl font-light">
              {t("hero.subtitle")}
            </p>

            <div className="mt-12 flex flex-col gap-4 sm:flex-row justify-center w-full sm:w-auto">
              <Button asChild size="lg" className="rounded-none bg-white px-10 text-slate-950 hover:bg-slate-200 transition-colors duration-300 text-xs font-bold uppercase tracking-widest h-14 w-full sm:w-auto">
                <a href={REGISTRATION_URL} target="_blank" rel="noreferrer">
                  {t("hero.ctaRegister")}
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-none border border-white/30 bg-white/5 backdrop-blur-sm px-10 text-white hover:bg-white/10 hover:border-white/50 transition-all duration-300 text-xs font-bold uppercase tracking-widest h-14 w-full sm:w-auto"
                onClick={() => scrollToId("competitions")}
              >
                {t("hero.ctaExplore")}
              </Button>
            </div>
            
            <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16 items-center opacity-70 grayscale contrast-200 brightness-200">
              {partnerItems.map((partner) => (
                <div key={partner.key} className="flex items-center justify-center">
                  <img src={partner.logo} alt={partner.initials} className="h-10 w-auto object-contain" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="partners" className="border-b border-slate-200 py-16 dark:border-slate-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t("partners.title")} subtitle={t("partners.subtitle")} />
            <div className="mt-10 grid gap-8 lg:grid-cols-3">
              {partnerItems.map((partner) => {
                const points = t(`partners.${partner.key}.points`, { returnObjects: true }) as string[];

                return (
                  <div
                    key={partner.key}
                    className="rounded-xl border border-slate-200/80 bg-white/70 backdrop-blur-md p-6 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 dark:border-slate-800/80 dark:bg-slate-900/60 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white p-2 border border-slate-200 shadow-sm">
                          <img src={partner.logo} alt={partner.initials} className="h-full w-full object-contain" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-950 dark:text-white leading-tight">
                            {t(`partners.${partner.key}.name`)}
                          </h3>
                          <a
                            href={partner.href}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center gap-1"
                          >
                            Visit website
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>

                      <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-200">
                        {t(`partners.${partner.key}.desc`)}
                      </p>

                      <ul className="mt-5 space-y-3">
                        {Array.isArray(points) && points.map((point, idx) => (
                          <li key={idx} className="flex gap-2.5 items-start text-xs text-slate-600 dark:text-slate-300">
                            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500 mt-0.5" />
                            <span className="leading-normal">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
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

        <section id="journey" className="border-y border-slate-200 bg-white py-24 dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t("journey.title")} subtitle={t("journey.subtitle")} />
            <div className="mt-16 grid gap-8 md:grid-cols-5">
              {journeyKeys.map((key, index) => (
                <div key={key} className="group relative pt-8">
                  <div className="absolute top-0 left-0 text-7xl font-black text-slate-50 dark:text-slate-900 transition-colors group-hover:text-slate-100 dark:group-hover:text-slate-800/80 -z-10 select-none">
                    0{index + 1}
                  </div>
                  <div className="relative z-10 pl-4 border-l-2 border-slate-200 dark:border-slate-800 group-hover:border-slate-950 dark:group-hover:border-white transition-colors">
                    <h3 className="text-lg font-bold text-slate-950 dark:text-white">{t(`journey.steps.${key}.title`)}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t(`journey.steps.${key}.desc`)}</p>
                  </div>
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

            <div className="rounded-3xl bg-slate-950 p-8 sm:p-12 dark:bg-slate-900 flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-950">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{t("support.title")}</h2>
                  <p className="mt-1 text-sm text-slate-400">{t("support.subtitle")}</p>
                </div>
              </div>
              
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <a
                  href={ZALO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-sm font-bold text-white hover:bg-slate-800 transition-all flex flex-col items-center text-center group"
                >
                  <img src="/fermat-logo.png" className="mb-4 h-6 w-6 object-contain grayscale group-hover:grayscale-0 transition-all" alt="FermatTech" />
                  {t("support.zalo")}
                </a>
                <a
                  href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-sm font-bold text-white hover:bg-slate-800 transition-all flex flex-col items-center text-center"
                >
                  <Phone className="mb-4 h-6 w-6 text-slate-400" />
                  {SUPPORT_PHONE}
                </a>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-sm font-bold text-white hover:bg-slate-800 transition-all flex flex-col items-center text-center"
                >
                  <Mail className="mb-4 h-6 w-6 text-slate-400" />
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="result-lookup" className="border-t border-slate-200 py-16 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t("lookup.title")} subtitle={t("lookup.subtitle")} />

            <div className="mt-16 overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 rounded-xl shadow-sm">
              <div className="p-8 sm:p-12">
                <div className="flex justify-center border-b border-slate-200 dark:border-slate-800 pb-8 mb-8">
                  <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setLookupType("username");
                        setResults(null);
                        setHasSearched(false);
                      }}
                      className={`px-6 py-2.5 text-sm font-bold rounded-md transition-all duration-200 ${
                        lookupType === "username"
                          ? "bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      {t("lookup.tabUsername")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLookupType("personal");
                        setResults(null);
                        setHasSearched(false);
                      }}
                      className={`px-6 py-2.5 text-sm font-bold rounded-md transition-all duration-200 ${
                        lookupType === "personal"
                          ? "bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      {t("lookup.tabPersonal")}
                    </button>
                  </div>
                </div>

                <form onSubmit={handleLookup} className="space-y-4">
                  {lookupType === "username" ? (
                    <div>
                      <Label htmlFor="lookup-username" className="text-slate-700 dark:text-slate-300 font-semibold">{t("lookup.usernameLabel")}</Label>
                      <Input
                        id="lookup-username"
                        placeholder={t("lookup.usernamePlaceholder")}
                        className="mt-2 h-10 border-slate-200 dark:border-slate-800"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <Label htmlFor="lookup-fullname" className="text-slate-700 dark:text-slate-300 font-semibold">{t("lookup.fullNameLabel")}</Label>
                        <Input
                          id="lookup-fullname"
                          placeholder={t("lookup.fullNamePlaceholder")}
                          className="mt-2 h-10 border-slate-200 dark:border-slate-800"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lookup-dob" className="text-slate-700 dark:text-slate-300 font-semibold">{t("lookup.dobLabel")}</Label>
                        <Input
                          id="lookup-dob"
                          type="date"
                          placeholder={t("lookup.dobPlaceholder")}
                          className="mt-2 h-10 border-slate-200 dark:border-slate-800"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lookup-phone" className="text-slate-700 dark:text-slate-300 font-semibold">{t("lookup.phoneLabel")}</Label>
                        <Input
                          id="lookup-phone"
                          placeholder={t("lookup.phonePlaceholder")}
                          className="mt-2 h-10 border-slate-200 dark:border-slate-800"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-6">
                    <Button
                      type="submit"
                      disabled={isSearching}
                      className="w-full sm:w-auto bg-slate-950 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 text-white rounded-none px-8 py-6 text-xs font-bold uppercase tracking-widest transition-colors duration-300"
                    >
                      {isSearching ? t("lookup.searching") : t("lookup.btnSearch")}
                    </Button>
                  </div>
                </form>

                {hasSearched && !isSearching && results !== null && (
                  <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
                    <h3 className="text-lg font-bold text-slate-950 dark:text-white mb-4">
                      {t("lookup.tableTitle")}
                    </h3>

                    {results.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                        {t("lookup.noResult")}
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800/50 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                              <th className="px-4 py-3">{t("lookup.candidateName")}</th>
                              <th className="px-4 py-3">{t("lookup.examName")}</th>
                              <th className="px-4 py-3">{t("lookup.subjectName")}</th>
                              <th className="px-4 py-3 text-center">{t("lookup.score")}</th>
                              <th className="px-4 py-3 text-center">{t("lookup.status")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {results.map((result) => (
                              <tr key={result.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                                <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                                  {result.candidate_name}
                                </td>
                                <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                                  {result.exam_name}
                                </td>
                                <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                                  {result.subject_name}
                                </td>
                                <td className="px-4 py-4 text-center font-bold text-slate-900 dark:text-white">
                                  {result.score} / {result.max_score} ({result.percentage}%)
                                </td>
                                <td className="px-4 py-4 text-center">
                                  {result.passed === null ? (
                                    <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300">
                                      -
                                    </span>
                                  ) : result.passed ? (
                                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-950/30 dark:text-green-300">
                                      {t("lookup.pass")}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                                      {t("lookup.fail")}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
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
