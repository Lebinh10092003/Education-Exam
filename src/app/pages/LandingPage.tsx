import { useState, useEffect } from "react";
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
  AlertTriangle,
  Play,
  RotateCcw,
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

  // AI Proctoring Simulation states
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simLogs, setSimLogs] = useState<string[]>([]);

  // Simulation timeline loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSimulating) {
      interval = setInterval(() => {
        setSimStep((prev) => {
          const next = (prev + 1) % 5;
          switch (next) {
            case 0:
              setSimLogs(["[AI] Camera check initiated...", "[AI] Scanning face geometry..."]);
              break;
            case 1:
              setSimLogs((prevLogs) => [
                ...prevLogs,
                "[AI] Identity verified: Candidate 1024 matches registration photo (99.4%).",
              ]);
              break;
            case 2:
              setSimLogs((prevLogs) => [
                ...prevLogs,
                "[AI] Monitoring focus: Active. Head angle normal.",
              ]);
              break;
            case 3:
              setSimLogs((prevLogs) => [
                ...prevLogs,
                "[Warning] Tab switch detected! Event logged and sent to proctor portal.",
              ]);
              break;
            case 4:
              setSimLogs((prevLogs) => [
                ...prevLogs,
                "[AI] Resumed normal status. Live webcam feed streaming successfully.",
              ]);
              break;
          }
          return next;
        });
      }, 3000);
    } else {
      setSimStep(0);
      setSimLogs(["[AI] Simulation idle. Click 'Start Simulation' to preview proctoring webcam."]);
    }
    return () => clearInterval(interval);
  }, [isSimulating]);

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
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100 font-sans">
      {/* Grid Background */}
      <div className="absolute inset-0 -z-20 h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]" />

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/70 backdrop-blur-lg dark:border-slate-800/80 dark:bg-slate-900/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
              <span className="text-xl font-extrabold text-white">E</span>
            </div>
            <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-950 to-slate-800 dark:from-white dark:to-slate-200">
              EduExam
            </span>
          </Link>

          {/* Nav menu links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600 dark:text-slate-300">
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

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />

            {/* Light/Dark Toggle */}
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle Theme"
            >
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            {/* Portal Navigate Button */}
            {isAuthenticated && profile ? (
              <Button asChild className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/10">
                <Link to={getDefaultRouteForProfile(profile)}>
                  {profile.roles.includes("candidate")
                    ? t("hero.portalButton")
                    : t("hero.adminPortalButton")}
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button onClick={() => scrollToId("login")} className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/10">
                {t("hero.studentLogin")}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero & Login Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 lg:py-32">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 -z-10 h-96 w-96 rounded-full bg-blue-500/10 blur-[100px] dark:bg-blue-600/10" />
        <div className="absolute top-1/3 right-1/4 -z-10 h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-[120px] dark:bg-purple-600/5" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 text-center lg:text-left space-y-8">
              {/* Feature Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/50 px-4 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/20 dark:text-blue-300">
                <span className="flex h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                <span>✨ Phiên Bản Mới: Tích hợp Giám Sát AI 2.0</span>
              </div>

              {/* Title */}
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-slate-900 dark:text-white leading-[1.1]">
                Nền tảng thi cử{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-400">
                  bảo mật & công bằng
                </span>{" "}
                hàng đầu
              </h1>

              {/* Description */}
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                EduExam cung cấp giải pháp thi trực tuyến toàn diện, an toàn tuyệt đối với công nghệ giám sát webcam, AI phát hiện gian lận và chấm tự động tức thì.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-2">
                <Button
                  size="lg"
                  className="rounded-xl px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 dark:shadow-none hover:scale-[1.03] transition-transform duration-200"
                  onClick={() => scrollToId(isAuthenticated ? "exams" : "login")}
                >
                  {t("hero.ctaStart")}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-xl px-8 border-slate-200 hover:bg-slate-100 bg-white/40 backdrop-blur dark:border-slate-800 dark:hover:bg-slate-800 dark:bg-transparent"
                  onClick={() => scrollToId("exams")}
                >
                  {t("hero.ctaExplore")}
                </Button>
              </div>

              {/* Marketing Visual / Floating Mockups Container */}
              <div className="relative mt-12 w-full max-w-lg mx-auto lg:mx-0">
                {/* Main Illustration */}
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                  <img
                    src="/hero_exam.png"
                    alt="Online Exam Illustration"
                    className="w-full h-auto rounded-xl object-cover"
                  />
                </div>

                {/* Floating Webcam Widget */}
                <div className="absolute -top-6 -right-6 md:-right-10 rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-xl backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/95 flex items-center gap-3 hover:scale-105 transition-transform duration-300">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                    <Video className="h-5 w-5" />
                    <span className="absolute top-1 right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Webcam Giám Sát</p>
                    <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wider">Hoạt động bình thường</p>
                  </div>
                </div>

                {/* Floating Warning Alert */}
                <div className="absolute -bottom-6 -left-6 md:-left-10 rounded-2xl border border-red-200/80 bg-red-50/95 p-3 shadow-xl backdrop-blur-md dark:border-red-900/50 dark:bg-red-950/95 flex items-center gap-2.5 hover:scale-105 transition-transform duration-300">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-red-950 dark:text-red-100">Cảnh Báo Chuyển Tab</p>
                    <p className="text-[10px] text-red-700/80 dark:text-red-400/80">Lần phạm lỗi: 0/3</p>
                  </div>
                </div>

                {/* Floating Timer Widget */}
                <div className="absolute top-1/2 -left-12 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/95 hidden sm:flex items-center gap-2.5 hover:scale-105 transition-transform duration-300">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">45:12</span>
                </div>
              </div>
            </div>

            {/* Right Student Login Card */}
            <div id="login" className="lg:col-span-5 flex justify-center">
              {isAuthenticated && profile ? (
                <Card className="w-full max-w-md border-blue-100 shadow-2xl dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg">
                  <CardHeader className="text-center pb-6">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 shadow-inner">
                      <GraduationCap className="h-9 w-9" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {t("common:greeting", { name: profile.full_name }) || `Xin chào, ${profile.full_name}!`}
                    </CardTitle>
                    <CardDescription className="mt-2 text-slate-500 dark:text-slate-400 text-sm">
                      Bạn đã đăng nhập dưới vai trò <span className="font-bold text-blue-600 dark:text-blue-400">{profile.roles[0]}</span>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button asChild size="lg" className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95 shadow-md shadow-blue-500/10">
                      <Link to={getDefaultRouteForProfile(profile)}>
                        Vào trang Portal của bạn
                        <ChevronRight className="ml-1.5 h-5 w-5" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="w-full max-w-md border-blue-100/80 shadow-2xl dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md relative overflow-hidden group">
                  {/* Decorative glowing gradient border */}
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                  
                  <CardHeader className="text-center pb-6">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                      <span className="text-xl font-bold">E</span>
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {t("hero.studentLogin")}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t("auth:login.title")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-4.5" onSubmit={handleLogin}>
                      <div className="space-y-1.5">
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
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {t("auth:login.passwordLabel")}
                          </Label>
                          <Link
                            to="/forgot-password"
                            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
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
                        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95 shadow-md shadow-blue-500/15"
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
                        <span>Tài Khoản Đăng Nhập Demo</span>
                      </p>
                      <div className="mt-2 space-y-1.5">
                        <div className="flex justify-between border-b border-blue-100/50 pb-1.5 dark:border-blue-900/20">
                          <span>Học sinh: <span className="font-mono font-semibold">candidate@example.com</span></span>
                          <span className="font-mono bg-blue-100/80 px-1 rounded dark:bg-blue-900/40">admin123456</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Quản trị: <span className="font-mono font-semibold">admin@example.com</span></span>
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

      {/* Stats Section */}
      <section className="bg-slate-100/60 py-12 dark:bg-slate-900/40 border-y border-slate-200/50 dark:border-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-sm dark:border-slate-800/80 dark:bg-slate-900 hover:shadow-md transition-shadow">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-2xl font-black tracking-tight md:text-3xl text-slate-900 dark:text-white">500+</p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{t("stats.examsCreated")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-sm dark:border-slate-800/80 dark:bg-slate-900 hover:shadow-md transition-shadow">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-2xl font-black tracking-tight md:text-3xl text-slate-900 dark:text-white">10,000+</p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{t("stats.candidates")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-sm dark:border-slate-800/80 dark:bg-slate-900 hover:shadow-md transition-shadow">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400">
                <Activity className="h-5 w-5" />
              </div>
              <p className="text-2xl font-black tracking-tight md:text-3xl text-slate-900 dark:text-white">99.9%</p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{t("stats.uptime")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-sm dark:border-slate-800/80 dark:bg-slate-900 hover:shadow-md transition-shadow">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                <Award className="h-5 w-5" />
              </div>
              <p className="text-2xl font-black tracking-tight md:text-3xl text-slate-900 dark:text-white">1.2M+</p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{t("stats.testsTaken")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="overview" className="py-20 sm:py-28 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t("features.title")}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
              Công nghệ tiên tiến giúp tối ưu hóa toàn bộ quy trình từ khâu ra đề, tổ chức thi cho đến việc đánh giá.
            </p>
            <div className="h-1.5 w-12 bg-blue-600 mx-auto rounded-full" />
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Proctoring */}
            <div className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 dark:bg-blue-950 dark:text-blue-400">
                <Video className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">
                {t("features.proctoring.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {t("features.proctoring.desc")}
              </p>
            </div>

            {/* Grading */}
            <div className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors duration-300 dark:bg-green-950 dark:text-green-400">
                <CheckCircle className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">
                {t("features.grading.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {t("features.grading.desc")}
              </p>
            </div>

            {/* Question Bank */}
            <div className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300 dark:bg-purple-950 dark:text-purple-400">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">
                {t("features.questionBank.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {t("features.questionBank.desc")}
              </p>
            </div>

            {/* Practice Mode */}
            <div className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors duration-300 dark:bg-orange-950 dark:text-orange-400">
                <Laptop className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">
                {t("features.practice.title")}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {t("features.practice.desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Exams Section */}
      <section id="exams" className="bg-slate-100/50 py-20 dark:bg-slate-900/30 border-y border-slate-200/50 dark:border-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t("exams.title")}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              {t("exams.subtitle")}
            </p>
            <div className="h-1.5 w-12 bg-blue-600 mx-auto rounded-full" />
          </div>

          {/* Tabs Filter */}
          <div className="mt-12 flex flex-wrap justify-center gap-2.5">
            {(["all", "math", "science", "languages", "it"] as const).map((category) => (
              <Button
                key={category}
                variant={activeCategory === category ? "default" : "outline"}
                className={`rounded-full px-6 py-2 text-xs font-bold transition-all ${
                  activeCategory === category 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/10 hover:bg-blue-700" 
                    : "bg-white/50 border-slate-200 text-slate-600 dark:bg-slate-900/50 dark:border-slate-800 dark:text-slate-300 hover:bg-slate-100"
                }`}
                onClick={() => setActiveCategory(category)}
              >
                {t(`exams.tabs.${category}`)}
              </Button>
            ))}
          </div>

          {/* Exams Grid */}
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredExams.map((exam) => (
              <Card
                key={exam.id}
                className="border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden group relative"
              >
                {/* Decorative border matching subject categories */}
                <div className={`absolute top-0 left-0 w-full h-[4px] ${
                  exam.category === 'math' ? 'bg-blue-500' :
                  exam.category === 'languages' ? 'bg-purple-500' :
                  exam.category === 'it' ? 'bg-indigo-500' : 'bg-green-500'
                }`} />

                <CardHeader className="pt-7">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-blue-50/80 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase dark:bg-blue-950/40 dark:text-blue-300">
                      {t(`exams.tabs.${exam.category}`)}
                    </span>
                    {exam.proctored && (
                      <span className="rounded-full bg-red-50/80 px-2.5 py-0.5 text-[10px] font-bold text-red-700 uppercase dark:bg-red-950/40 dark:text-red-300">
                        {t("exams.proctored")}
                      </span>
                    )}
                    {exam.practice && (
                      <span className="rounded-full bg-green-50/80 px-2.5 py-0.5 text-[10px] font-bold text-green-700 uppercase dark:bg-green-950/40 dark:text-green-300">
                        {t("exams.practice")}
                      </span>
                    )}
                  </div>
                  <CardTitle className="mt-4 text-lg font-bold text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {t(exam.titleKey)}
                  </CardTitle>
                  <CardDescription className="pt-2 text-xs flex gap-4 font-semibold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t("exams.duration", { minutes: exam.duration })}</span>
                    <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{t("exams.questions", { count: exam.questions })}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {isAuthenticated && profile ? (
                    <Button asChild className="w-full rounded-xl mt-4 bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold shadow-md">
                      <Link to="/candidate/exams">
                        {t("exams.startBtn")}
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full rounded-xl mt-4 border-slate-200 text-slate-700 hover:bg-blue-600 hover:text-white dark:border-slate-800 dark:text-slate-300 dark:hover:bg-blue-600 dark:hover:text-white transition-all font-semibold"
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

      {/* Safety & Proctoring Simulator Section */}
      <section id="security" className="py-20 sm:py-28 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:items-center">
            {/* Left AI Simulator Widget */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[4px] bg-blue-600" />
                
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <Video className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" />
                    <div>
                      <h4 className="font-bold text-slate-950 dark:text-white text-sm">Bộ Giám Sát AI (Mô Phỏng)</h4>
                      <p className="text-[10px] text-slate-500 font-semibold">Live Webcam Supervision Feed</p>
                    </div>
                  </div>
                  <span className="flex h-2.5 w-2.5 rounded-full bg-green-500 animate-ping" />
                </div>

                {/* Webcam Mock Screen */}
                <div className="relative mt-4 aspect-video w-full rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center overflow-hidden">
                  {isSimulating ? (
                    <>
                      {/* Face scanning grids */}
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_40%,_rgba(0,0,0,0.4)_100%)]" />
                      <div className="absolute top-4 left-4 flex items-center gap-2 rounded-lg bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                        <span>REC: 00:00:15</span>
                      </div>

                      {/* Mock facial recognition wireframe */}
                      <svg className="absolute inset-0 h-full w-full stroke-blue-500/30 fill-none" viewBox="0 0 100 100">
                        <ellipse cx="50" cy="45" rx="20" ry="25" strokeDasharray="3,3" />
                        <line x1="50" y1="20" x2="50" y2="70" strokeDasharray="3,3" />
                        <line x1="30" y1="45" x2="70" y2="45" strokeDasharray="3,3" />
                        <circle cx="43" cy="40" r="1.5" className="fill-blue-400 stroke-none" />
                        <circle cx="57" cy="40" r="1.5" className="fill-blue-400 stroke-none" />
                        {/* Interactive dynamic step overlays */}
                        {simStep === 3 && (
                          <rect x="5" y="5" width="90" height="90" className="stroke-red-500 stroke-2 animate-pulse fill-red-500/10" />
                        )}
                      </svg>

                      {/* Status indicator overlay */}
                      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center gap-2">
                        <span className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold text-white uppercase tracking-wider ${
                          simStep === 3 ? "bg-red-600 animate-bounce" : "bg-blue-600"
                        }`}>
                          {simStep === 0 && "Kích hoạt..."}
                          {simStep === 1 && "Face Check: OK"}
                          {simStep === 2 && "Tập trung: Tốt"}
                          {simStep === 3 && "PHÁT HIỆN CHUYỂN TAB!"}
                          {simStep === 4 && "Kết nối an toàn"}
                        </span>
                        <span className="text-[10px] text-white/80 font-mono bg-black/60 px-2 py-0.5 rounded backdrop-blur">
                          FPS: 30
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-slate-400 font-medium">Camera đang tắt. Click nút để chạy mô phỏng AI giám sát thi trực tuyến.</p>
                      <Button size="sm" onClick={() => setIsSimulating(true)} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold shadow">
                        <Play className="mr-1.5 h-3.5 w-3.5" /> Bắt đầu mô phỏng
                      </Button>
                    </div>
                  )}
                </div>

                {/* Simulation Logs Terminal */}
                <div className="mt-4 rounded-xl bg-slate-950 p-3.5 font-mono text-[10px] text-slate-300 space-y-1 h-32 overflow-y-auto border border-slate-800 shadow-inner">
                  {simLogs.map((log, idx) => (
                    <div key={idx} className={log.includes("[Warning]") ? "text-red-400 font-bold" : "text-green-400"}>
                      {log}
                    </div>
                  ))}
                </div>

                {isSimulating && (
                  <div className="mt-4 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setIsSimulating(false)} className="text-xs text-slate-500 hover:text-slate-800">
                      <RotateCcw className="mr-1 h-3 w-3" /> Tắt mô phỏng
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Proctoring Copy */}
            <div className="lg:col-span-7 space-y-6">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                {t("security.title")}
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                {t("security.subtitle")}
              </p>
              <div className="h-1.5 w-12 bg-blue-600 rounded-full" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                    <Video className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{t("security.camera.title")}</h3>
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{t("security.camera.desc")}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{t("security.fullscreen.title")}</h3>
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{t("security.fullscreen.desc")}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                    <Clipboard className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{t("security.clipboard.title")}</h3>
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{t("security.clipboard.desc")}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{t("security.liveSupervision.title")}</h3>
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{t("security.liveSupervision.desc")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faqs" className="bg-slate-100/60 py-20 dark:bg-slate-900/40 border-t border-slate-200/50 dark:border-slate-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t("faqs.title")}
            </h2>
            <div className="h-1.5 w-12 bg-blue-600 mx-auto rounded-full" />
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
                    className="flex w-full items-center justify-between text-left font-bold text-slate-900 dark:text-white"
                  >
                    <span className="flex items-center gap-2.5">
                      <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                      {t(qKey)}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-3.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 pt-3.5 dark:border-slate-800 pl-7">
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
          <div className="flex justify-center items-center gap-2.5 group">
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
