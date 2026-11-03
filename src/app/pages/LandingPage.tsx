import { useEffect, useState } from "react";
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
  Clock,
  ChevronDown,
  Code2,
  ExternalLink,
  Flame,
  Languages,
  Mail,
  Menu,
  MessageCircle,
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
import { COMPETITION_STATUS_STYLES } from "../lib/competitionStatus";
import { apiRequest, type PaginatedResponse } from "../lib/http";
import {
  daysUntil,
  fetchPublicCompetitions,
  formatIsoDate,
  pickNextOpenCompetition,
  type PublicCompetition,
} from "../lib/competitions";
import { BrandLogo } from "../components/BrandLogo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";



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

const headerNavItems = [
  { id: "competitions", labelKey: "nav.competitions" },
  { id: "partners", labelKey: "nav.partners" },
  { id: "journey", labelKey: "nav.journey" },
  { id: "result-lookup", labelKey: "lookup.title" },
  { id: "support", labelKey: "nav.support" },
] as const;

function BrandMark() {
  return (
    <BrandLogo />
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Bang "Cac cuoc thi noi bat" lay tu he thong (quan tri vien them/sua o trang Cuoc thi & dang ky).
  const [competitions, setCompetitions] = useState<PublicCompetition[] | null>(null);
  const [competitionsError, setCompetitionsError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchPublicCompetitions()
      .then((items) => {
        if (!cancelled) setCompetitions(items);
      })
      .catch(() => {
        if (!cancelled) {
          setCompetitions([]);
          setCompetitionsError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
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
        auth: false,
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

  // CTA dang ky: link chon san cuoc thi, nhac han dang ky.
  const openCompetitions = (competitions ?? []).filter((item) => item.accepts_registration);
  const nextOpen = pickNextOpenCompetition(competitions ?? []);
  const registerHref = (exam?: PublicCompetition | null) => (exam ? `/register?competition=${exam.id}` : "/register");
  const deadlineInfo = (exam: PublicCompetition) => {
    if (!exam.accepts_registration || !exam.registration_deadline) return null;
    const days = daysUntil(exam.registration_deadline);
    if (days === null || days < 0) return null;
    return {
      label: days === 0 ? t("cta.lastDay") : t("cta.daysLeft", { count: days }),
      urgent: days <= 7,
    };
  };
  const nextOpenDeadline = nextOpen ? deadlineInfo(nextOpen) : null;
  const renderCompetitionAction = (exam: PublicCompetition, fullWidth = false) => {
    if (exam.accepts_registration) {
      return (
        <Button
          asChild
          size="sm"
          className={`rounded-lg bg-blue-600 font-semibold text-white shadow-sm hover:bg-blue-700 ${fullWidth ? "h-11 w-full text-base" : ""}`}
        >
          <Link to={registerHref(exam)} aria-label={`${t("cta.registerNow")} ${exam.code}`}>
            {t("cta.registerNow")}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      );
    }
    if (exam.status === "ended") {
      return (
        <Button
          size="sm"
          variant="outline"
          className={`rounded-lg font-semibold ${fullWidth ? "h-11 w-full" : ""}`}
          onClick={() => scrollToId("result-lookup")}
        >
          {t("cta.viewResults")}
        </Button>
      );
    }
    return <span className="text-xs font-medium text-slate-400">{t("cta.closed")}</span>;
  };
  const renderDeadline = (exam: PublicCompetition, withDate: boolean) => {
    const info = deadlineInfo(exam);
    if (!info) return null;
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium ${
          info.urgent ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"
        }`}
      >
        <Clock className="h-3 w-3" />
        {withDate
          ? `${info.label} · ${t("cta.deadline", { date: formatIsoDate(exam.registration_deadline) })}`
          : info.label}
      </span>
    );
  };

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
          <Link to="/" aria-label="FermatTech homepage" className="shrink-0">
            <BrandMark />
          </Link>

          <nav className="mx-auto hidden items-center gap-1 whitespace-nowrap text-sm font-semibold text-slate-600 xl:flex dark:text-slate-300">
            {headerNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white"
                onClick={() => scrollToId(item.id)}
              >
                {t(item.labelKey)}
              </button>
            ))}
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
              className="hidden rounded-xl border-0 bg-gradient-to-r from-blue-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all duration-300 hover:from-blue-700 hover:to-cyan-600 sm:inline-flex"
            >
              <Link to={registerHref(nextOpen)}>
                {t("hero.ctaRegister")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="hidden rounded-lg border-slate-300 px-3 sm:inline-flex">
              <Link to={isAuthenticated ? portalPath : "/login"}>
                {isAuthenticated ? t("nav.portal") : t("nav.login")}
              </Link>
            </Button>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg border-slate-200 xl:hidden dark:border-slate-800"
                  aria-label="Mở menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] p-0 sm:w-[340px]">
                <SheetHeader className="border-b border-slate-200 p-5 dark:border-slate-800">
                  <SheetTitle asChild>
                    <div>
                      <BrandLogo size="sm" />
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 p-3">
                  {headerNavItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="rounded-lg px-4 py-3 text-left text-base font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        window.setTimeout(() => scrollToId(item.id), 150);
                      }}
                    >
                      {t(item.labelKey)}
                    </button>
                  ))}
                </nav>
                <div className="mt-auto grid gap-2 border-t border-slate-200 p-5 dark:border-slate-800">
                  <Button asChild className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                    <Link to={registerHref(nextOpen)}>{t("hero.ctaRegister")}</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-xl">
                    <Link to={isAuthenticated ? portalPath : "/login"}>
                      {isAuthenticated ? t("nav.portal") : t("nav.login")}
                    </Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-slate-50 min-h-[85vh] flex items-center dark:bg-slate-950 py-24 lg:py-0">
          {/* Bright Tech Background */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <svg className="absolute h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="hero-dot-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.5" className="text-slate-300 dark:text-slate-800" fill="currentColor" />
                </pattern>
                <radialGradient id="hero-glow-blue" cx="30%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(59, 130, 246, 0.15)" />
                  <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                </radialGradient>
                <radialGradient id="hero-glow-cyan" cx="80%" cy="20%" r="40%">
                  <stop offset="0%" stopColor="rgba(6, 182, 212, 0.15)" />
                  <stop offset="100%" stopColor="rgba(6, 182, 212, 0)" />
                </radialGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#hero-dot-grid)" />
              <rect width="100%" height="100%" fill="url(#hero-glow-blue)" />
              <rect width="100%" height="100%" fill="url(#hero-glow-cyan)" />
            </svg>
          </div>

          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
            <div className="flex-1 text-center lg:text-left mt-8 lg:mt-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 backdrop-blur-md px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-700 shadow-sm mb-8 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-400">
                <Sparkles className="h-3.5 w-3.5" />
                {t("hero.badge")}
              </div>
              
              <h1 className="text-5xl font-extrabold tracking-tight text-slate-950 sm:text-6xl lg:text-[4.5rem] dark:text-white leading-[1.1] max-w-3xl mx-auto lg:mx-0">
                {t("hero.title")}
              </h1>
              
              <p className="mt-6 text-lg leading-relaxed text-slate-600 sm:text-xl font-medium max-w-2xl mx-auto lg:mx-0 dark:text-slate-300">
                {t("hero.subtitle")}
              </p>

              {nextOpen ? (
                <Link
                  to={registerHref(nextOpen)}
                  className="mt-8 inline-flex max-w-full items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition-colors hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  <Flame className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="truncate">{t("cta.heroOpen", { code: nextOpen.code })}</span>
                  {nextOpenDeadline ? (
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/60 dark:text-amber-100">
                      {nextOpenDeadline.label}
                    </span>
                  ) : null}
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              ) : null}

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Button
                  asChild
                  size="lg"
                  className="group h-14 w-full rounded-xl border-0 bg-gradient-to-r from-blue-600 to-cyan-500 px-8 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-600 hover:shadow-xl sm:w-auto"
                >
                  <Link to={registerHref(nextOpen)}>
                    {t("hero.ctaRegister")}
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 w-full rounded-xl border border-slate-300 bg-white/70 px-8 text-base font-semibold text-slate-700 backdrop-blur-sm transition-all duration-300 hover:bg-slate-100 sm:w-auto dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => scrollToId("competitions")}
                >
                  <CalendarDays className="mr-2 h-5 w-5" />
                  {t("hero.ctaExplore")}
                </Button>
              </div>
              <button
                type="button"
                onClick={() => scrollToId("result-lookup")}
                className="mt-5 text-sm font-semibold text-blue-700 underline-offset-4 hover:underline dark:text-cyan-400"
              >
                {t("cta.lookupLink")} →
              </button>
            </div>

            <div className="flex-1 w-full max-w-lg lg:max-w-none relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-3xl opacity-20 blur-2xl animate-pulse dark:opacity-30"></div>
              <div className="relative rounded-2xl overflow-hidden border border-white/40 shadow-2xl bg-white dark:border-slate-800 dark:bg-slate-900 aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/3]">
                <ImageWithFallback src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1200" alt="Học sinh học tập" loading="lazy" decoding="async" className="w-full h-full object-cover bg-slate-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent"></div>
              </div>
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
                        <div className="flex h-14 w-28 shrink-0 items-center justify-center rounded-xl bg-white px-3 py-2 border border-slate-200 shadow-sm">
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

        <section className="bg-slate-50 py-24 dark:bg-slate-900/40 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-3xl bg-blue-500/10 blur-[100px] rounded-full pointer-events-none dark:bg-blue-500/5"></div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
            <SectionHeading title={t("categories.title")} subtitle={t("categories.subtitle")} />
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {categoryItems.map((category) => {
                const Icon = category.icon;

                return (
                  <div key={category.key} className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 hover:-translate-y-1">
                    <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
                      {category.image && (
                        <>
                          <ImageWithFallback src={category.image} alt={t(`categories.${category.key}.title`)} loading="lazy" decoding="async" className="h-full w-full object-cover bg-slate-100 transition-transform duration-700 group-hover:scale-110" />
                          <div className="absolute inset-0 bg-gradient-to-t from-blue-900/60 via-blue-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        </>
                      )}
                      <div className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/90 backdrop-blur-md shadow-lg text-blue-600 dark:bg-slate-900/90 dark:text-cyan-400 translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 delay-100">
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-cyan-400 group-hover:bg-gradient-to-br group-hover:from-blue-600 group-hover:to-cyan-500 group-hover:text-white transition-colors duration-500">
                          <Icon className="h-4 w-4" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                          {t(`categories.${category.key}.title`)}
                        </h3>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        {t(`categories.${category.key}.desc`)}
                      </p>
                    </div>
                    <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-blue-500/30 dark:group-hover:border-cyan-400/30 pointer-events-none transition-colors duration-500"></div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="competitions" className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t("competitions.title")} subtitle={t("competitions.subtitle")} />
            
            <div className="mt-10 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block dark:border-slate-800 dark:bg-slate-900">
              <table className="table table-bordered table-hover w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800/50 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-4 font-bold">{t("competitions.table.headers.olympiad")}</th>
                    <th className="px-4 py-4 text-center font-bold">{t("competitions.table.headers.cycle")}</th>
                    <th className="px-4 py-4 text-center font-bold">{t("competitions.table.headers.date")}</th>
                    <th className="px-4 py-4 text-center font-bold">{t("competitions.table.headers.status")}</th>
                    <th className="px-6 py-4 text-right font-bold">{t("cta.actionHeader")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {competitions === null ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                        Đang tải lịch thi...
                      </td>
                    </tr>
                  ) : competitions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                        {competitionsError
                          ? "Chưa tải được lịch thi, vui lòng thử lại sau."
                          : "Lịch thi chu kỳ mới sẽ được cập nhật sớm."}
                      </td>
                    </tr>
                  ) : null}
                  {(competitions ?? []).map((exam) => (
                    <tr key={exam.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="exam-name font-semibold text-slate-900 dark:text-white block">
                          {exam.name}
                        </span>
                        <span className="exam-code text-xs text-slate-500 dark:text-slate-400 block mt-1">
                          {exam.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="cycle-badge inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {exam.cycle ? t("competitions.table.cycle", { num: exam.cycle }) : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="date-badge inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          {formatIsoDate(exam.exam_date)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${COMPETITION_STATUS_STYLES[exam.status]}`}
                        >
                          {t(`competitions.table.status.${exam.status}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-1">
                          {renderCompetitionAction(exam)}
                          {renderDeadline(exam, true)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Dien thoai: the thay cho bang, nut dang ky de bam */}
            <div className="mt-8 grid gap-3 md:hidden">
              {competitions === null ? (
                <p className="py-6 text-center text-sm text-slate-500">Đang tải lịch thi...</p>
              ) : competitions.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  {competitionsError ? "Chưa tải được lịch thi, vui lòng thử lại sau." : "Lịch thi chu kỳ mới sẽ được cập nhật sớm."}
                </p>
              ) : null}
              {(competitions ?? []).map((exam) => (
                <div
                  key={exam.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug text-slate-900 dark:text-white">{exam.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {exam.cycle ? `${exam.code} · ${t("competitions.table.cycle", { num: exam.cycle })}` : exam.code}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${COMPETITION_STATUS_STYLES[exam.status]}`}
                    >
                      {t(`competitions.table.status.${exam.status}`)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {`${t("competitions.table.headers.date")}: ${formatIsoDate(exam.exam_date)}`}
                    </span>
                    {renderDeadline(exam, false)}
                  </div>
                  <div className="mt-4">{renderCompetitionAction(exam, true)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="journey" className="border-y border-slate-200 bg-white py-24 dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t("journey.title")} subtitle={t("journey.subtitle")} />
            <div className="mt-16 grid gap-8 md:grid-cols-5 relative">
              <div className="absolute top-12 left-8 right-8 h-1 bg-gradient-to-r from-blue-100 via-blue-200 to-cyan-100 hidden md:block rounded-full dark:from-slate-800 dark:via-blue-900/50 dark:to-slate-800"></div>
              {journeyKeys.map((key, index) => (
                <div key={key} className="group relative pt-8 md:pt-0">
                  <div className="md:absolute md:top-8 md:left-1/2 md:-translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white border-4 border-slate-50 dark:bg-slate-900 dark:border-slate-950 text-slate-400 font-bold z-10 group-hover:border-blue-100 group-hover:text-blue-600 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-300 dark:group-hover:border-blue-900/50 dark:group-hover:text-cyan-400">
                    {index + 1}
                  </div>
                  <div className="md:pt-24 md:text-center text-left pl-12 md:pl-0 relative z-10">
                    <h3 className="text-lg font-bold text-slate-950 dark:text-white group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">{t(`journey.steps.${key}.title`)}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t(`journey.steps.${key}.desc`)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-14 flex flex-col items-center gap-2 text-center">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-blue-600 px-8 text-base font-semibold text-white shadow-md hover:bg-blue-700"
              >
                <Link to={registerHref(nextOpen)}>
                  {t("cta.journeyCta")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("cta.journeyNote")}</p>
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

            <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-500 p-8 sm:p-12 shadow-2xl shadow-blue-500/20 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-cyan-300/20 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="relative z-10 flex items-center gap-4 mb-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue-600 shadow-lg">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{t("support.title")}</h2>
                  <p className="mt-1 text-sm text-blue-100">{t("support.subtitle")}</p>
                </div>
              </div>
              
              <div className="relative z-10 mt-6 grid gap-4 sm:grid-cols-3">
                <a
                  href={ZALO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-white/10 border border-white/20 p-5 text-sm font-bold text-white hover:bg-white hover:text-blue-600 shadow-sm backdrop-blur-sm transition-all flex flex-col items-center text-center group"
                >
                  <MessageCircle className="mb-4 h-6 w-6 text-white group-hover:text-blue-600" />
                  {t("support.zalo")}
                </a>
                <a
                  href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}
                  className="rounded-xl bg-white/10 border border-white/20 p-5 text-sm font-bold text-white hover:bg-white hover:text-blue-600 shadow-sm backdrop-blur-sm transition-all flex flex-col items-center text-center group"
                >
                  <Phone className="mb-4 h-6 w-6 text-white group-hover:text-blue-600" />
                  {SUPPORT_PHONE}
                </a>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="rounded-xl bg-white/10 border border-white/20 p-5 text-sm font-bold text-white hover:bg-white hover:text-blue-600 shadow-sm backdrop-blur-sm transition-all flex flex-col items-center text-center group"
                >
                  <Mail className="mb-4 h-6 w-6 text-white group-hover:text-blue-600" />
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="result-lookup" className="relative border-t border-slate-200 py-24 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[800px] h-[800px] bg-cyan-400/10 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 relative z-10">
            <SectionHeading title={t("lookup.title")} subtitle={t("lookup.subtitle")} />

            <div className="mt-16 overflow-hidden border border-white/60 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/80 rounded-3xl shadow-xl shadow-blue-900/5">
              <div className="p-8 sm:p-12 relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400"></div>
                <div className="flex justify-center border-b border-slate-200 dark:border-slate-800 pb-8 mb-8">
                  <div className="flex gap-2 p-1.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setLookupType("username");
                        setResults(null);
                        setHasSearched(false);
                      }}
                      className={`px-8 py-3 text-sm font-bold rounded-lg transition-all duration-300 ${
                        lookupType === "username"
                          ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-cyan-400 shadow-md"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
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
                      className={`px-8 py-3 text-sm font-bold rounded-lg transition-all duration-300 ${
                        lookupType === "personal"
                          ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-cyan-400 shadow-md"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
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
                      className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg shadow-blue-500/25 text-white rounded-xl px-10 py-6 text-sm font-bold uppercase tracking-widest transition-all duration-300 border-0"
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
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 px-6 py-12 text-center shadow-2xl shadow-blue-500/20 sm:px-12">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              {openCompetitions.length > 0 ? (
                <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white">
                  <Flame className="h-4 w-4" />
                  {t("cta.bandOpen", { count: openCompetitions.length })}
                </p>
              ) : null}
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{t("cta.bandTitle")}</h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-blue-50 sm:text-lg">{t("cta.bandSubtitle")}</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-14 rounded-xl bg-white px-8 text-base font-bold text-blue-700 shadow-lg hover:bg-blue-50"
                >
                  <Link to={registerHref(nextOpen)}>
                    {t("hero.ctaRegister")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-14 rounded-xl border-white/50 bg-transparent px-8 text-base font-semibold text-white hover:bg-white/10 hover:text-white"
                >
                  <a href={ZALO_URL} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-5 w-5" />
                    {t("cta.bandSecondary")}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Dien thoai: nut dang ky luon trong tam tay */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:hidden dark:border-slate-800 dark:bg-slate-950/95">
        <Button asChild className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-base font-semibold text-white">
          <Link to={registerHref(nextOpen)}>
            {nextOpen ? t("cta.heroOpen", { code: nextOpen.code }) : t("hero.ctaRegister")}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>

      <footer className="border-t border-slate-200 bg-white pt-10 pb-24 sm:pb-10 dark:border-slate-800 dark:bg-slate-950">
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
