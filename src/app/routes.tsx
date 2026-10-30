import { createElement, lazy, type ComponentType } from "react";
import { createBrowserRouter, Navigate, useParams, useRouteError } from "react-router";
import { TakeExam } from "./pages/TakeExam";
import { PracticeExam } from "./pages/PracticeExam";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import {
  ProtectedAdminLayout,
  ProtectedCandidateLayout,
  PublicLoginPage,
} from "./components/auth/ProtectedRoute";

const lazyRoute = <
  TModule extends Record<string, ComponentType<any>>,
  TExportName extends keyof TModule,
>(
  importer: () => Promise<TModule>,
  exportName: TExportName,
): ComponentType => {
  const LazyComponent = lazy(async () => {
    const module = await importer();
    return { default: module[exportName] };
  });

  return function LazyRouteComponent() {
    return createElement(LazyComponent);
  };
};

const DashboardRoute = lazyRoute(() => import("./pages/Dashboard"), "Dashboard");
const LandingPageRoute = lazyRoute(() => import("./pages/LandingPage"), "LandingPage");
const RegistrationPageRoute = lazyRoute(() => import("./pages/RegistrationPage"), "RegistrationPage");
const UserManagementRoute = lazyRoute(() => import("./pages/UserManagement"), "UserManagement");
const GroupManagementRoute = lazyRoute(() => import("./pages/GroupManagement"), "GroupManagement");
const GroupMembersRoute = lazyRoute(() => import("./pages/GroupMembersPage"), "GroupMembersPage");
const SubjectManagementRoute = lazyRoute(() => import("./pages/SubjectManagement"), "SubjectManagement");
const CompetitionsManagementRoute = lazyRoute(() => import("./pages/CompetitionsManagement"), "CompetitionsManagement");
const QuestionBankRoute = lazyRoute(() => import("./pages/QuestionBank"), "QuestionBank");
const ExamManagementRoute = lazyRoute(() => import("./pages/ExamManagement"), "ExamManagement");
const ExamMonitoringHubRoute = lazyRoute(() => import("./pages/ExamMonitoringHub"), "ExamMonitoringHub");
const ExamCreationWizardRoute = lazyRoute(() => import("./pages/ExamCreationWizard"), "ExamCreationWizard");
const ExamAssignmentRoute = lazyRoute(() => import("./pages/ExamAssignment"), "ExamAssignment");
const ExamDetailRoute = lazyRoute(() => import("./pages/ExamDetail"), "ExamDetail");
const ManualGradingRoute = lazyRoute(() => import("./pages/ManualGrading"), "ManualGrading");
const RolesPermissionsRoute = lazyRoute(() => import("./pages/RolesPermissions"), "RolesPermissions");
const NotificationCenterRoute = lazyRoute(() => import("./pages/NotificationCenter"), "NotificationCenter");
const AuditCenterRoute = lazyRoute(() => import("./pages/AuditCenter"), "AuditCenter");
const CandidateDashboardRoute = lazyRoute(() => import("./pages/CandidateDashboard"), "CandidateDashboard");
const MyExamsRoute = lazyRoute(() => import("./pages/MyExams"), "MyExams");
const ExamInstructionsRoute = lazyRoute(() => import("./pages/ExamInstructions"), "ExamInstructions");
const CandidateResultsRoute = lazyRoute(() => import("./pages/CandidateResults"), "CandidateResults");
const ResultDetailRoute = lazyRoute(() => import("./pages/ResultDetail"), "ResultDetail");
const CandidateMaterialsRoute = lazyRoute(() => import("./pages/CandidateMaterials"), "CandidateMaterials");
const StudentNotificationsRoute = lazyRoute(() => import("./pages/StudentNotifications"), "StudentNotifications");
const StudentProfileRoute = lazyRoute(() => import("./pages/StudentProfile"), "StudentProfile");
const StudentHelpRoute = lazyRoute(() => import("./pages/StudentHelp"), "StudentHelp");
const PracticeSessionRoute = lazyRoute(() => import("./pages/PracticeSession"), "PracticeSession");
const PracticeReviewRoute = lazyRoute(() => import("./pages/PracticeReview"), "PracticeReview");
const MaterialsLibraryRoute = lazyRoute(() => import("./pages/MaterialsLibrary"), "MaterialsLibrary");
const ResultsReportsRoute = lazyRoute(() => import("./pages/ResultsReports"), "ResultsReports");
const AdminResultReviewRoute = lazyRoute(() => import("./pages/AdminResultReview"), "AdminResultReview");
const DisciplinaryManagementRoute = lazyRoute(
  () => import("./pages/DisciplinaryManagement"),
  "DisciplinaryManagement",
);
const DisciplinaryExamSheetRoute = lazyRoute(
  () => import("./pages/DisciplinaryExamSheet"),
  "DisciplinaryExamSheet",
);
const ProfileRoute = lazyRoute(() => import("./pages/Profile"), "Profile");

export function ExamMonitorRedirectRoute() {
  const { id } = useParams();

  if (!id) {
    return createElement(Navigate, { replace: true, to: "/exams" });
  }

  return createElement(Navigate, { replace: true, to: `/exams/${id}?tab=monitoring` });
}

export function GlobalErrorBoundary() {
  const error = useRouteError();
  
  if (error instanceof Error && error.message.includes("Failed to fetch dynamically imported module")) {
    // If it's a chunk load error, automatically reload the page (only once)
    const hasReloaded = sessionStorage.getItem("chunk_reload");
    if (!hasReloaded) {
      sessionStorage.setItem("chunk_reload", "true");
      window.location.reload();
      return <div>Loading new version...</div>;
    }
  }

  // Clear the flag on successful load or other errors
  sessionStorage.removeItem("chunk_reload");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold text-red-800">Đã xảy ra lỗi</h1>
        <p className="mb-6 text-red-600">
          {error instanceof Error ? error.message : "Đã có lỗi không xác định xảy ra."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-red-600 px-6 py-2 text-white hover:bg-red-700 transition-colors"
        >
          Tải lại trang
        </button>
      </div>
    </div>
  );
}

export const routeConfig = [
  {
    path: "/login",
    Component: PublicLoginPage,
    errorElement: createElement(GlobalErrorBoundary),
  },
  {
    path: "/forgot-password",
    Component: ForgotPassword,
    errorElement: createElement(GlobalErrorBoundary),
  },
  {
    path: "/reset-password",
    Component: ResetPassword,
    errorElement: createElement(GlobalErrorBoundary),
  },
  {
    path: "/",
    Component: LandingPageRoute,
    errorElement: createElement(GlobalErrorBoundary),
  },
  {
    path: "/register",
    Component: RegistrationPageRoute,
    errorElement: createElement(GlobalErrorBoundary),
  },
  {
    path: "/",
    Component: ProtectedAdminLayout,
    errorElement: createElement(GlobalErrorBoundary),
    children: [
      { path: "dashboard", Component: DashboardRoute },
      { path: "users", Component: UserManagementRoute },
      { path: "groups", Component: GroupManagementRoute },
      { path: "groups/:id/members", Component: GroupMembersRoute },
      { path: "subjects", Component: SubjectManagementRoute },
      { path: "competitions", Component: CompetitionsManagementRoute },
      { path: "question-bank", Component: QuestionBankRoute },
      { path: "exams", Component: ExamManagementRoute },
      { path: "exams/create", Component: ExamCreationWizardRoute },
      { path: "exams/monitoring", Component: ExamMonitoringHubRoute },
      { path: "exams/:id", Component: ExamDetailRoute },
      { path: "exams/:id/edit", Component: ExamCreationWizardRoute },
      { path: "exams/:id/assign", Component: ExamAssignmentRoute },
      { path: "exams/:id/monitor", Component: ExamMonitorRedirectRoute },
      { path: "manual-grading", Component: ManualGradingRoute },
      { path: "materials", Component: MaterialsLibraryRoute },
      { path: "results", Component: ResultsReportsRoute },
      { path: "results/:id/review", Component: AdminResultReviewRoute },
      { path: "discipline", Component: DisciplinaryManagementRoute },
      { path: "discipline/exams/:id", Component: DisciplinaryExamSheetRoute },
      { path: "roles-permissions", Component: RolesPermissionsRoute },
      { path: "notifications", Component: NotificationCenterRoute },
      { path: "audit", Component: AuditCenterRoute },
      { path: "profile", Component: ProfileRoute },
    ],
  },
  {
    path: "/candidate",
    Component: ProtectedCandidateLayout,
    errorElement: createElement(GlobalErrorBoundary),
    children: [
      { index: true, Component: CandidateDashboardRoute },
      { path: "dashboard", Component: CandidateDashboardRoute },
      { path: "exams", Component: MyExamsRoute },
      { path: "exams/:id/instructions", Component: ExamInstructionsRoute },
      { path: "exam/:id", Component: TakeExam },
      { path: "practice", Component: PracticeExam },
      { path: "practice/sessions/:id", Component: PracticeSessionRoute },
      { path: "practice/sessions/:id/review", Component: PracticeReviewRoute },
      { path: "results", Component: CandidateResultsRoute },
      { path: "results/:id", Component: ResultDetailRoute },
      { path: "materials", Component: CandidateMaterialsRoute },
      { path: "notifications", Component: StudentNotificationsRoute },
      { path: "profile", Component: StudentProfileRoute },
      { path: "help", Component: StudentHelpRoute },
    ],
  },
];

export const router = createBrowserRouter(routeConfig);
