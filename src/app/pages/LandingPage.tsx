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

export function LandingPage() {
  const { t, i18n } = useTranslation(["landing", "auth", "common"]);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { login, isAuthenticated, profile } = useAuth();
  const { isSubmitting, run } = useMutationState();

  // States
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [faqOpen, setFaqOpen] = useState<Record<number, boolean>>({});
  const [identifier, setIdentifier] = useState("candidate@example.com"); // default to student for convenience
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
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-md shadow-blue-200 dark:shadow-none">
              <span className="text-xl font-black text-white">E</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              EduExam
            </span>
          </Link>

          {/* Nav menu links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <button
              onClick={() => scrollToId("overview")}
              className="transition-colors hover:text-blue-600 dark:hover:text-blue-400"
            >
              {t("features.title")}
            </button>
            <button
              onClick={() => scrollToId("exams")}
              className="transition-colors hover:text-blue-600 dark:hover:text-blue-400"
            >
              {t("exams.title")}
            </button>
            <button
              onClick={() => scrollToId("security")}
              className="transition-colors hover:text-blue-600 dark:hover:text-blue-400"
            >
              {t("security.title")}
            </button>
            <button
              onClick={() => scrollToId("faqs")}
              className="transition-colors hover:text-blue-600 dark:hover:text-blue-400"
            >
              {t("faqs.title")}
            </button>
          </nav>

          {/* Action buttons */}
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
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            {/* Portal Navigate Button */}
            {isAuthenticated && profile ? (
              <Button asChild className="rounded-xl">
                <Link to={getDefaultRouteForProfile(profile)}>
                  {profile.roles.includes("candidate")
                    ? t("hero.portalButton")
                    : t("hero.adminPortalButton")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button onClick={() => scrollToId("login")} className="rounded-xl">
                {t("hero.studentLogin")}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero & Login Section */}
      <section className="relative overflow-hidden py-12 sm:py-20 lg:py-28">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-600/10" />
        <div className="absolute top-1/3 right-10 -z-10 h-96 w-96 rounded-full bg-purple-400/20 blur-3xl dark:bg-purple-600/10" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 text-center lg:text-left space-y-6">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                <Star className="h-3 w-3 fill-current" />
                <span>Next-Gen Examination System</span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-slate-900 dark:text-white leading-tight">
                {t("hero.title")}
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto lg:mx-0">
                {t("hero.subtitle")}
              </p>

              {/* Marketing Badges */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-2">
                <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>AI webcam check</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Auto-saved answers</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Instant grading report</span>
                </div>
              </div>

              {/* Hero CTA */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-4">
                <Button size="lg" className="rounded-xl px-8" onClick={() => scrollToId(isAuthenticated ? "exams" : "login")}>
                  {t("hero.ctaStart")}
                </Button>
                <Button size="lg" variant="outline" className="rounded-xl px-8 border-slate-300 dark:border-slate-800" onClick={() => scrollToId("exams")}>
                  {t("hero.ctaExplore")}
                </Button>
              </div>

              {/* Marketing Image */}
              <div className="mt-8 flex justify-center lg:justify-start">
                <img
                  src="/hero_exam.png"
                  alt="Online Exam Illustration"
                  className="w-full max-w-md rounded-2xl shadow-2xl shadow-blue-500/10 dark:shadow-none transition-transform hover:scale-[1.02] duration-300"
                />
              </div>
            </div>

            {/* Right Student Login Card */}
            <div id="login" className="lg:col-span-5 flex justify-center">
              {isAuthenticated && profile ? (
                <Card className="w-full max-w-md border-blue-100 shadow-xl dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
                  <CardHeader className="text-center pb-6">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                      <GraduationCap className="h-8 w-8" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
                      {t("common:greeting", { name: profile.full_name }) || `Hi, ${profile.full_name}!`}
                    </CardTitle>
                    <CardDescription className="mt-2 text-slate-500 dark:text-slate-400">
                      You are logged in as <span className="font-semibold text-blue-600 dark:text-blue-400">{profile.roles[0]}</span>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button asChild size="lg" className="w-full rounded-xl">
                      <Link to={getDefaultRouteForProfile(profile)}>
                        Go to Portal
                        <ChevronRight className="ml-1 h-5 w-5" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="w-full max-w-md border-blue-100 shadow-xl dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
                  <CardHeader className="text-center pb-6">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none">
                      <span className="text-xl font-bold">E</span>
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
                      {t("hero.studentLogin")}
                    </CardTitle>
                    <CardDescription>
                      {t("auth:login.title")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-4" onSubmit={handleLogin}>
                      <div className="space-y-1.5">
                        <Label htmlFor="identifier">{t("auth:login.identifierLabel")}</Label>
                        <Input
                          id="identifier"
                          type="text"
                          placeholder={t("auth:login.identifierPlaceholder")}
                          className="rounded-xl mt-1"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="password">{t("auth:login.passwordLabel")}</Label>
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
                          className="rounded-xl mt-1"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      <Button
                        size="lg"
                        className="w-full rounded-xl mt-2"
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

                    {/* Account hints */}
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-900 dark:border-blue-950 dark:bg-blue-950/20 dark:text-blue-200">
                      <p className="font-semibold">{t("auth:login.demoCredentials")}</p>
                      <div className="mt-1 flex justify-between">
                        <span>Student: <span className="font-mono font-medium">candidate@example.com</span></span>
                        <span>Pass: <span className="font-mono font-medium">admin123456</span></span>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <span>Admin: <span className="font-mono font-medium">admin@example.com</span></span>
                        <span>Pass: <span className="font-mono font-medium">admin123456</span></span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-slate-100/50 py-12 dark:bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 text-center shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold tracking-tight md:text-3xl text-slate-900 dark:text-white">500+</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("stats.examsCreated")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 text-center shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold tracking-tight md:text-3xl text-slate-900 dark:text-white">10,000+</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("stats.candidates")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 text-center shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400">
                <Activity className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold tracking-tight md:text-3xl text-slate-900 dark:text-white">99.9%</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("stats.uptime")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 text-center shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
                <Award className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold tracking-tight md:text-3xl text-slate-900 dark:text-white">1.2M+</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("stats.testsTaken")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="overview" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("features.title")}
            </h2>
            <div className="h-1 w-12 bg-blue-600 mx-auto rounded-full" />
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Proctoring */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 dark:bg-blue-950 dark:text-blue-400">
                <Video className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">
                {t("features.proctoring.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {t("features.proctoring.desc")}
              </p>
            </div>

            {/* Grading */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors duration-300 dark:bg-green-950 dark:text-green-400">
                <CheckCircle className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">
                {t("features.grading.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {t("features.grading.desc")}
              </p>
            </div>

            {/* Question Bank */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300 dark:bg-purple-950 dark:text-purple-400">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">
                {t("features.questionBank.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {t("features.questionBank.desc")}
              </p>
            </div>

            {/* Practice Mode */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors duration-300 dark:bg-orange-950 dark:text-orange-400">
                <Laptop className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">
                {t("features.practice.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {t("features.practice.desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Exams Section */}
      <section id="exams" className="bg-slate-100/40 py-20 dark:bg-slate-900/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("exams.title")}
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              {t("exams.subtitle")}
            </p>
            <div className="h-1 w-12 bg-blue-600 mx-auto rounded-full" />
          </div>

          {/* Tabs Filter */}
          <div className="mt-12 flex flex-wrap justify-center gap-2">
            {(["all", "math", "science", "languages", "it"] as const).map((category) => (
              <Button
                key={category}
                variant={activeCategory === category ? "default" : "outline"}
                className="rounded-full px-5 py-1.5 text-xs font-semibold"
                onClick={() => setActiveCategory(category)}
              >
                {t(`exams.tabs.${category}`)}
              </Button>
            ))}
          </div>

          {/* Exams Grid */}
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredExams.map((exam) => (
              <Card
                key={exam.id}
                className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between"
              >
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase dark:bg-blue-950/40 dark:text-blue-300">
                      {t(`exams.tabs.${exam.category}`)}
                    </span>
                    {exam.proctored && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 uppercase dark:bg-red-950/40 dark:text-red-300">
                        {t("exams.proctored")}
                      </span>
                    )}
                    {exam.practice && (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 uppercase dark:bg-green-950/40 dark:text-green-300">
                        {t("exams.practice")}
                      </span>
                    )}
                  </div>
                  <CardTitle className="mt-3 text-lg font-bold text-slate-900 dark:text-white leading-snug">
                    {t(exam.titleKey)}
                  </CardTitle>
                  <CardDescription className="pt-2 text-xs flex gap-4 text-slate-500 dark:text-slate-400">
                    <span>{t("exams.duration", { minutes: exam.duration })}</span>
                    <span>•</span>
                    <span>{t("exams.questions", { count: exam.questions })}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {isAuthenticated && profile ? (
                    <Button asChild className="w-full rounded-xl mt-4">
                      <Link to="/candidate/exams">
                        {t("exams.startBtn")}
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full rounded-xl mt-4 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
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

      {/* Safety & Proctoring Section */}
      <section id="security" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Graphics */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-950 dark:text-white">EduExam Security Guard</h4>
                    <p className="text-xs text-slate-500">Real-time status check active</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 dark:text-slate-400">Identity Verified</span>
                    <span className="font-bold text-green-600">Passed</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: "100%" }} />
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 dark:text-slate-400">Browser Focus</span>
                    <span className="font-bold text-green-600">Locked</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: "100%" }} />
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 dark:text-slate-400">Webcam Feed</span>
                    <span className="font-bold text-blue-600">Proctor connected</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-center gap-4">
                <Video className="h-10 w-10 text-blue-600 animate-pulse" />
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">AI Proctor Monitoring</p>
                  <p className="text-xs text-slate-500">Facial tracking detects multiple faces or empty desk</p>
                </div>
              </div>
            </div>

            {/* Right Copy */}
            <div className="lg:col-span-7 space-y-6">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t("security.title")}
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                {t("security.subtitle")}
              </p>
              <div className="h-1 w-12 bg-blue-600 rounded-full" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                <div className="flex gap-3">
                  <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <Video className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{t("security.camera.title")}</h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t("security.camera.desc")}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{t("security.fullscreen.title")}</h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t("security.fullscreen.desc")}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <Clipboard className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{t("security.clipboard.title")}</h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t("security.clipboard.desc")}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <Eye className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{t("security.liveSupervision.title")}</h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t("security.liveSupervision.desc")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faqs" className="bg-slate-100/50 py-20 dark:bg-slate-900/30">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("faqs.title")}
            </h2>
            <div className="h-1 w-12 bg-blue-600 mx-auto rounded-full" />
          </div>

          <div className="space-y-4">
            {[1, 2, 3].map((num) => {
              const qKey = `faqs.q${num}`;
              const aKey = `faqs.a${num}`;
              const isOpen = faqOpen[num] || false;

              return (
                <div
                  key={num}
                  className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(num)}
                    className="flex w-full items-center justify-between text-left font-bold text-slate-900 dark:text-white"
                  >
                    <span>{t(qKey)}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-slate-500 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 pt-3 dark:border-slate-800">
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
          <div className="flex justify-center items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <span className="font-bold text-white text-sm">E</span>
            </div>
            <span className="font-bold text-lg text-slate-950 dark:text-white">EduExam</span>
          </div>

          {/* Footer links */}
          <div className="flex justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <a href="#" className="hover:underline">
              {t("footer.contact")}
            </a>
            <span>•</span>
            <a href="#" className="hover:underline">
              {t("footer.privacy")}
            </a>
            <span>•</span>
            <a href="#" className="hover:underline">
              {t("footer.terms")}
            </a>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            {t("footer.rights")}
          </p>
        </div>
      </footer>
    </div>
  );
}
