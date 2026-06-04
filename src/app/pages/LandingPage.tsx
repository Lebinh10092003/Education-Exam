import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import {
  Activity,
  Award,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Eye,
  FileText,
  GraduationCap,
  HelpCircle,
  Laptop,
  Loader2,
  Lock,
  Moon,
  Shield,
  Star,
  Sun,
  Users,
  Video,
  Clock,
} from "lucide-react";

import { useAuth } from "../auth/useAuth";
import { getDefaultRouteForProfile } from "../auth/AuthContext";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useMutationState } from "../hooks/useMutationState";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { notify } from "../lib/notify";

interface MockExam {
  id: number;
  titleKey: string;
  category: "math" | "science" | "languages" | "it";
  duration: number;
  questions: number;
  proctored: boolean;
  practice: boolean;
}

const mockExams: MockExam[] = [
  {
    id: 1,
    titleKey: "exams.list.math12",
    category: "math",
    duration: 90,
    questions: 50,
    proctored: true,
    practice: true,
  },
  {
    id: 2,
    titleKey: "exams.list.ieltsMock",
    category: "languages",
    duration: 120,
    questions: 80,
    proctored: true,
    practice: true,
  },
  {
    id: 3,
    titleKey: "exams.list.dsaCode",
    category: "it",
    duration: 60,
    questions: 30,
    proctored: false,
    practice: true,
  },
  {
    id: 4,
    titleKey: "exams.list.physics12",
    category: "science",
    duration: 50,
    questions: 40,
    proctored: true,
    practice: false,
  },
  {
    id: 5,
    titleKey: "exams.list.organicChem",
    category: "science",
    duration: 60,
    questions: 40,
    proctored: false,
    practice: true,
  },
];

// Abstract Vector Tech Art Component for the Hero Illustration (clean, no checkerboard, modern)
function HeroIllustration() {
  return (
    <div className="relative w-full aspect-square max-w-[450px] mx-auto flex items-center justify-center select-none">
      {/* Decorative colored glow circles */}
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 rounded-full blur-[80px]" />
      
      {/* SVG Vector Constellation Map representing Connectivity & Intelligence */}
      <svg className="w-full h-full stroke-slate-200 dark:stroke-slate-800 fill-none" viewBox="0 0 200 200">
        {/* Background Grid Pattern */}
        <defs>
          <pattern id="illustration-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" className="stroke-slate-100 dark:stroke-slate-900/60" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#illustration-grid)" className="rounded-2xl" />

        {/* Orbit Lines */}
        <circle cx="100" cy="100" r="70" strokeWidth="1" strokeDasharray="4,4" className="stroke-slate-200/80 dark:stroke-slate-800/80" />
        <circle cx="100" cy="100" r="40" strokeWidth="1" className="stroke-slate-200/60 dark:stroke-slate-800/50" />

        {/* Connecting Lines */}
        <line x1="30" y1="100" x2="100" y2="30" strokeWidth="1.5" className="stroke-blue-500/50 dark:stroke-blue-400/40" />
        <line x1="100" y1="30" x2="170" y2="100" strokeWidth="1.5" className="stroke-indigo-500/50 dark:stroke-indigo-400/40" />
        <line x1="170" y1="100" x2="100" y2="170" strokeWidth="1.5" className="stroke-blue-500/50 dark:stroke-blue-400/40" />
        <line x1="100" y1="170" x2="30" y2="100" strokeWidth="1.5" className="stroke-indigo-500/50 dark:stroke-indigo-400/40" />
        
        <line x1="100" y1="30" x2="100" y2="170" strokeWidth="1" strokeDasharray="2,2" className="stroke-slate-300 dark:stroke-slate-700" />
        <line x1="30" y1="100" x2="170" y2="100" strokeWidth="1" strokeDasharray="2,2" className="stroke-slate-300 dark:stroke-slate-700" />

        {/* Constellation Nodes (glowing circles) */}
        <circle cx="100" cy="30" r="6" className="fill-blue-600 stroke-white dark:stroke-slate-950" strokeWidth="2" />
        <circle cx="170" cy="100" r="6" className="fill-indigo-600 stroke-white dark:stroke-slate-950" strokeWidth="2" />
        <circle cx="100" cy="170" r="6" className="fill-purple-600 stroke-white dark:stroke-slate-950" strokeWidth="2" />
        <circle cx="30" cy="100" r="6" className="fill-blue-600 stroke-white dark:stroke-slate-950" strokeWidth="2" />

        {/* Central Core representing Platform Data */}
        <g className="hover:scale-110 transition-transform duration-300 origin-center">
          <circle cx="100" cy="100" r="16" className="fill-gradient bg-blue-600 fill-blue-600/10 stroke-blue-600" strokeWidth="2" />
          <circle cx="100" cy="100" r="6" className="fill-blue-600 animate-pulse" />
        </g>

        {/* Small Data particles */}
        <circle cx="65" cy="65" r="3" className="fill-slate-400 dark:fill-slate-600" />
        <circle cx="135" cy="65" r="3" className="fill-slate-400 dark:fill-slate-600" />
        <circle cx="65" cy="135" r="3" className="fill-slate-400 dark:fill-slate-600" />
        <circle cx="135" cy="135" r="3" className="fill-slate-400 dark:fill-slate-600" />
      </svg>
      
      {/* Floating minimal info badges */}
      <div className="absolute top-10 right-4 rounded-xl border border-slate-200/60 bg-white/90 p-3 shadow-lg dark:border-slate-800/80 dark:bg-slate-900/90 backdrop-blur-md flex items-center gap-2 hover:-translate-y-1 transition-transform">
        <Shield className="h-4 w-4 text-blue-600" />
        <span className="text-[10px] font-bold tracking-tight text-slate-800 dark:text-slate-200">Secure Environment</span>
      </div>
      
      <div className="absolute bottom-10 left-4 rounded-xl border border-slate-200/60 bg-white/90 p-3 shadow-lg dark:border-slate-800/80 dark:bg-slate-900/90 backdrop-blur-md flex items-center gap-2 hover:-translate-y-1 transition-transform">
        <Activity className="h-4 w-4 text-indigo-600" />
        <span className="text-[10px] font-bold tracking-tight text-slate-800 dark:text-slate-200">AI Proctoring Active</span>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { t } = useTranslation(["landing", "auth", "common"]);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { login, isAuthenticated, profile } = useAuth();
  const { isSubmitting, run } = useMutationState();

  // States
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [faqOpen, setFaqOpen] = useState<Record<number, boolean>>({});
  const [identifier, setIdentifier] = useState("candidate@example.com");
  const [password, setPassword] = useState("admin123456");

  // Handle student login
  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const authProfile = await run(() => login(identifier.trim(), password));
      notify.success(t("auth:login.success"));
      navigate(getDefaultRouteForProfile(authProfile), { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("auth:errors.invalidCredentials");
      notify.error(message, {
        title: t("auth:login.failedTitle"),
        timer: 4000,
      });
    }
  };

  // Toggle FAQ
  const toggleFaq = (index: number) => {
    setFaqOpen((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // Get active exam list
  const filteredExams = activeCategory === "all"
    ? mockExams
    : mockExams.filter((exam) => exam.category === activeCategory);

  // Smooth scroll
  const scrollToId = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100 font-sans" data-legacy-i18n-ignore="true">
      {/* Subtle Background grids */}
      <div className="absolute inset-0 -z-20 h-full w-full bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)]" />

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-md shadow-blue-500/10 group-hover:scale-105 transition-transform duration-300">
              <span className="text-lg font-black text-white">E</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
              EduExam
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500 dark:text-slate-400">
            <button
              onClick={() => scrollToId("overview")}
              className="transition-colors hover:text-blue-600 dark:hover:text-blue-400"
            >
              {t("nav.features")}
            </button>
            <button
              onClick={() => scrollToId("exams")}
              className="transition-colors hover:text-blue-600 dark:hover:text-blue-400"
            >
              {t("nav.exams")}
            </button>
            <button
              onClick={() => scrollToId("security")}
              className="transition-colors hover:text-blue-600 dark:hover:text-blue-400"
            >
              {t("nav.security")}
            </button>
            <button
              onClick={() => scrollToId("faqs")}
              className="transition-colors hover:text-blue-600 dark:hover:text-blue-400"
            >
              {t("nav.faq")}
            </button>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />

            {/* Light/Dark Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl border border-slate-200 dark:border-slate-800"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle Theme"
            >
              <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            {/* Entrance CTA */}
            {isAuthenticated && profile ? (
              <Button asChild className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow shadow-blue-500/10">
                <Link to={getDefaultRouteForProfile(profile)}>
                  {profile.roles.includes("candidate")
                    ? t("hero.portalButton")
                    : t("hero.adminPortalButton")}
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button onClick={() => scrollToId("login")} className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow shadow-blue-500/10">
                {t("hero.studentLogin")}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
            
            {/* Left Column (Copy and CTA) */}
            <div className="lg:col-span-7 text-center lg:text-left space-y-6">
              {/* Release Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/50 px-4 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/20 dark:text-blue-300">
                <Star className="h-3.5 w-3.5 fill-current" />
                <span>{t("hero.badge")}</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl leading-[1.1] text-slate-900 dark:text-white">
                {t("hero.titlePart1")}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-400">
                  {t("hero.titlePartGradient")}
                </span>
                {t("hero.titlePart2")}
              </h1>

              {/* Subheading */}
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                {t("hero.subtitle")}
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-2">
                <Button
                  size="lg"
                  className="rounded-xl px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white shadow shadow-blue-500/20"
                  onClick={() => scrollToId(isAuthenticated ? "exams" : "login")}
                >
                  {t("hero.ctaStart")}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-xl px-8 border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-transparent"
                  onClick={() => scrollToId("exams")}
                >
                  {t("hero.ctaExplore")}
                </Button>
              </div>

              {/* Quick Feature highlights */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-5 pt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  {t("hero.featureWebcam")}
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  {t("hero.featureSave")}
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  {t("hero.featureGrading")}
                </span>
              </div>
            </div>

            {/* Right Column (Minimalist Vector Illustration) */}
            <div className="lg:col-span-5 flex justify-center">
              <HeroIllustration />
            </div>

          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="overview" className="py-20 bg-slate-100/50 dark:bg-slate-900/10 border-y border-slate-200/50 dark:border-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("features.title")}
            </h2>
            <div className="h-1 w-12 bg-blue-600 mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* AI Proctoring */}
            <Card className="border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <Video className="h-6 w-6" />
                </div>
                <CardTitle className="mt-4 text-lg font-bold">{t("features.proctoring.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("features.proctoring.desc")}
                </p>
              </CardContent>
            </Card>

            {/* Auto Grading */}
            <Card className="border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <CardTitle className="mt-4 text-lg font-bold">{t("features.grading.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("features.grading.desc")}
                </p>
              </CardContent>
            </Card>

            {/* Question Bank */}
            <Card className="border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
                  <BookOpen className="h-6 w-6" />
                </div>
                <CardTitle className="mt-4 text-lg font-bold">{t("features.questionBank.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("features.questionBank.desc")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Featured Exams Section */}
      <section id="exams" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("exams.title")}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              {t("exams.subtitle")}
            </p>
            <div className="h-1 w-12 bg-blue-600 mx-auto rounded-full" />
          </div>

          {/* Category tabs switcher */}
          <div className="mt-12 flex flex-wrap justify-center gap-2">
            {(["all", "math", "science", "languages", "it"] as const).map((category) => (
              <Button
                key={category}
                variant={activeCategory === category ? "default" : "outline"}
                className={`rounded-full px-5 py-1 text-xs font-bold transition-all ${
                  activeCategory === category 
                    ? "bg-blue-600 text-white shadow hover:bg-blue-700" 
                    : "bg-white border-slate-200 text-slate-600 dark:bg-slate-900/50 dark:border-slate-800 dark:text-slate-300 hover:bg-slate-100"
                }`}
                onClick={() => setActiveCategory(category)}
              >
                {t(`exams.tabs.${category}`)}
              </Button>
            ))}
          </div>

          {/* Exams list grid */}
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredExams.map((exam) => (
              <Card
                key={exam.id}
                className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm flex flex-col justify-between overflow-hidden relative group"
              >
                <div className={`absolute top-0 left-0 w-full h-[3px] ${
                  exam.category === 'math' ? 'bg-blue-500' :
                  exam.category === 'languages' ? 'bg-purple-500' :
                  exam.category === 'it' ? 'bg-indigo-500' : 'bg-green-500'
                }`} />

                <CardHeader className="pt-6">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="rounded-full bg-blue-50/80 px-2 py-0.5 text-[9px] font-bold text-blue-700 uppercase dark:bg-blue-950/40 dark:text-blue-300">
                      {t(`exams.tabs.${exam.category}`)}
                    </span>
                    {exam.proctored && (
                      <span className="rounded-full bg-red-50/80 px-2 py-0.5 text-[9px] font-bold text-red-700 uppercase dark:bg-red-950/40 dark:text-red-300">
                        {t("exams.proctored")}
                      </span>
                    )}
                    {exam.practice && (
                      <span className="rounded-full bg-green-50/80 px-2 py-0.5 text-[9px] font-bold text-green-700 uppercase dark:bg-green-950/40 dark:text-green-300">
                        {t("exams.practice")}
                      </span>
                    )}
                  </div>
                  <CardTitle className="mt-3 text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {t(exam.titleKey)}
                  </CardTitle>
                  <CardDescription className="pt-2 text-xs flex gap-3 font-semibold text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t("exams.duration", { minutes: exam.duration })}</span>
                    <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{t("exams.questions", { count: exam.questions })}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {isAuthenticated && profile ? (
                    <Button asChild className="w-full rounded-xl mt-3 bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold">
                      <Link to="/candidate/exams">
                        {t("exams.startBtn")}
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full rounded-xl mt-3 border-slate-200 text-slate-700 hover:bg-blue-600 hover:text-white dark:border-slate-800 dark:text-slate-300 dark:hover:bg-blue-600 dark:hover:text-white transition-all font-semibold"
                      onClick={() => scrollToId("login")}
                    >
                      {t("exams.loginRequired")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Security Info Panel (Clean & Minimal) */}
      <section id="security" className="py-20 bg-slate-100/50 dark:bg-slate-900/10 border-y border-slate-200/50 dark:border-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
            
            {/* Copy */}
            <div className="lg:col-span-6 space-y-6">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t("security.title")}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-normal text-sm">
                {t("security.subtitle")}
              </p>
              <div className="h-1 w-12 bg-blue-600 rounded-full" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                <div className="flex gap-3">
                  <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                    <Video className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs">{t("security.camera.title")}</h3>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{t("security.camera.desc")}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs">{t("security.fullscreen.title")}</h3>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{t("security.fullscreen.desc")}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                    <Clipboard className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs">{t("security.clipboard.title")}</h3>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{t("security.clipboard.desc")}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                    <Eye className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs">{t("security.liveSupervision.title")}</h3>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{t("security.liveSupervision.desc")}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Icon card representation */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="w-full max-w-[400px] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                  <Shield className="h-7 w-7" />
                </div>
                <h4 className="font-bold text-slate-950 dark:text-white">{t("security.protocol.title")}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t("security.protocol.desc")}
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[10px] font-semibold">{t("security.protocol.lock")}</span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[10px] font-semibold">{t("security.protocol.webcam")}</span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[10px] font-semibold">{t("security.protocol.clipboard")}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Student Login Portal Block */}
      <section id="login" className="py-20 sm:py-28 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
            
            {/* Left side details */}
            <div className="lg:col-span-6 space-y-4 text-center lg:text-left">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                {t("hero.studentLogin")}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto lg:mx-0 leading-relaxed">
                {t("hero.studentLoginDesc")}
              </p>
            </div>

            {/* Right side clean login form */}
            <div className="lg:col-span-6 flex justify-center">
              {isAuthenticated && profile ? (
                <Card className="w-full max-w-md border-slate-200/80 shadow-2xl dark:border-slate-800/80 bg-white dark:bg-slate-900 backdrop-blur-lg rounded-2xl">
                  <CardHeader className="text-center pb-6">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                      <GraduationCap className="h-8 w-8" />
                    </div>
                    <CardTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {t("common:greeting", { name: profile.full_name }) || `Hi, ${profile.full_name}!`}
                    </CardTitle>
                    <CardDescription className="mt-1 text-slate-500 dark:text-slate-400 text-xs">
                      {t("hero.loggedInAs")} <span className="font-bold text-blue-600 dark:text-blue-400">{profile.roles[0]}</span>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button asChild size="lg" className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow shadow-blue-500/10">
                      <Link to={getDefaultRouteForProfile(profile)}>
                        {t("hero.portalButton")}
                        <ChevronRight className="ml-1.5 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="w-full max-w-md border-slate-200/80 shadow-2xl dark:border-slate-800 bg-white dark:bg-slate-900 relative overflow-hidden rounded-2xl">
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {t("hero.studentLogin")}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t("auth:login.title")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-4" onSubmit={handleLogin}>
                      <div className="space-y-1">
                        <Label htmlFor="identifier" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {t("auth:login.identifierLabel")}
                        </Label>
                        <Input
                          id="identifier"
                          type="text"
                          placeholder={t("auth:login.identifierPlaceholder")}
                          className="rounded-xl mt-1 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-800"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {t("auth:login.passwordLabel")}
                          </Label>
                          <Link
                            to="/forgot-password"
                            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {t("auth:login.forgotPassword")}
                          </Link>
                        </div>
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          className="rounded-xl mt-1 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-800"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      <Button
                        size="lg"
                        className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow"
                        type="submit"
                        disabled={isSubmitting}
                      >
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

                    {/* Account Hints */}
                    <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 text-xs text-blue-900 dark:border-blue-950/40 dark:bg-blue-950/20 dark:text-blue-200">
                      <p className="font-bold flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
                        <GraduationCap className="h-4 w-4" />
                        <span>{t("auth:login.demoCredentials")}</span>
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between border-b border-blue-100/50 pb-1 dark:border-blue-900/20">
                          <span>{t("hero.roleStudent")}: <span className="font-mono font-semibold">candidate@example.com</span></span>
                          <span className="font-mono bg-blue-100/80 px-1 rounded dark:bg-blue-900/40">admin123456</span>
                        </div>
                        <div className="flex justify-between pt-1">
                          <span>{t("hero.roleAdmin")}: <span className="font-mono font-semibold">admin@example.com</span></span>
                          <span className="font-mono bg-blue-100/80 px-1 rounded dark:bg-blue-900/40">admin123456</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faqs" className="bg-slate-100/50 py-20 dark:bg-slate-900/10 border-t border-slate-200/50 dark:border-slate-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("faqs.title")}
            </h2>
            <div className="h-1 bg-blue-600 w-12 mx-auto rounded-full" />
          </div>

          <div className="space-y-4">
            {[1, 2, 3].map((num) => {
              const qKey = `faqs.q${num}`;
              const aKey = `faqs.a${num}`;
              const isOpen = faqOpen[num] || false;

              return (
                <div
                  key={num}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md dark:border-slate-800 dark:bg-slate-900 transition-all duration-300"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(num)}
                    className="flex w-full items-center justify-between text-left font-bold text-slate-900 dark:text-white text-sm"
                  >
                    <span className="flex items-center gap-2.5">
                      <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      {t(qKey)}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 pt-3 dark:border-slate-800 pl-6">
                      {t(aKey)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8 space-y-6">
          <div className="flex justify-center items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-extrabold shadow">
              <span>E</span>
            </div>
            <span className="font-bold text-lg text-slate-950 dark:text-white">EduExam</span>
          </div>

          {/* Footer links */}
          <div className="flex justify-center gap-6 text-sm text-slate-500 dark:text-slate-400 font-semibold">
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              {t("footer.contact")}
            </a>
            <span>•</span>
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              {t("footer.privacy")}
            </a>
            <span>•</span>
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              {t("footer.terms")}
            </a>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            {t("footer.rights")}
          </p>
        </div>
      </footer>
    </div>
  );
}
