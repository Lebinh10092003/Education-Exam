import { createElement, lazy, type ComponentType } from "react";
import { createBrowserRouter } from "react-router";
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
const UserManagementRoute = lazyRoute(() => import("./pages/UserManagement"), "UserManagement");
const GroupManagementRoute = lazyRoute(() => import("./pages/GroupManagement"), "GroupManagement");
const SubjectManagementRoute = lazyRoute(() => import("./pages/SubjectManagement"), "SubjectManagement");
const QuestionBankRoute = lazyRoute(() => import("./pages/QuestionBank"), "QuestionBank");
const ExamManagementRoute = lazyRoute(() => import("./pages/ExamManagement"), "ExamManagement");
const ExamCreationWizardRoute = lazyRoute(() => import("./pages/ExamCreationWizard"), "ExamCreationWizard");
const ExamAssignmentRoute = lazyRoute(() => import("./pages/ExamAssignment"), "ExamAssignment");
const LiveMonitoringRoute = lazyRoute(() => import("./pages/LiveMonitoring"), "LiveMonitoring");
const ExamDetailRoute = lazyRoute(() => import("./pages/ExamDetail"), "ExamDetail");
const ManualGradingRoute = lazyRoute(() => import("./pages/ManualGrading"), "ManualGrading");
const RolesPermissionsRoute = lazyRoute(() => import("./pages/RolesPermissions"), "RolesPermissions");
const NotificationCenterRoute = lazyRoute(() => import("./pages/NotificationCenter"), "NotificationCenter");
const AuditCenterRoute = lazyRoute(() => import("./pages/AuditCenter"), "AuditCenter");
const ExamPeriodsRoute = lazyRoute(() => import("./pages/ExamPeriods"), "ExamPeriods");
const ExamRoomsRoute = lazyRoute(() => import("./pages/ExamRooms"), "ExamRooms");
const CandidateDashboardRoute = lazyRoute(() => import("./pages/CandidateDashboard"), "CandidateDashboard");
const CandidateResultsRoute = lazyRoute(() => import("./pages/CandidateResults"), "CandidateResults");
const CandidateMaterialsRoute = lazyRoute(() => import("./pages/CandidateMaterials"), "CandidateMaterials");
const MaterialsLibraryRoute = lazyRoute(() => import("./pages/MaterialsLibrary"), "MaterialsLibrary");
const ResultsReportsRoute = lazyRoute(() => import("./pages/ResultsReports"), "ResultsReports");
const ProfileRoute = lazyRoute(() => import("./pages/Profile"), "Profile");

export const routeConfig = [
  {
    path: "/login",
    Component: PublicLoginPage,
  },
  {
    path: "/forgot-password",
    Component: ForgotPassword,
  },
  {
    path: "/reset-password",
    Component: ResetPassword,
  },
  {
    path: "/",
    Component: ProtectedAdminLayout,
    children: [
      { index: true, Component: DashboardRoute },
      { path: "users", Component: UserManagementRoute },
      { path: "groups", Component: GroupManagementRoute },
      { path: "subjects", Component: SubjectManagementRoute },
      { path: "question-bank", Component: QuestionBankRoute },
      { path: "exams", Component: ExamManagementRoute },
      { path: "exams/create", Component: ExamCreationWizardRoute },
      { path: "exams/:id", Component: ExamDetailRoute },
      { path: "exams/:id/edit", Component: ExamCreationWizardRoute },
      { path: "exams/:id/assign", Component: ExamAssignmentRoute },
      { path: "exams/:id/monitor", Component: LiveMonitoringRoute },
      { path: "exam-periods", Component: ExamPeriodsRoute },
      { path: "exam-rooms", Component: ExamRoomsRoute },
      { path: "manual-grading", Component: ManualGradingRoute },
      { path: "materials", Component: MaterialsLibraryRoute },
      { path: "results", Component: ResultsReportsRoute },
      { path: "roles-permissions", Component: RolesPermissionsRoute },
      { path: "notifications", Component: NotificationCenterRoute },
      { path: "audit", Component: AuditCenterRoute },
      { path: "profile", Component: ProfileRoute },
    ],
  },
  {
    path: "/candidate",
    Component: ProtectedCandidateLayout,
    children: [
      { index: true, Component: CandidateDashboardRoute },
      { path: "dashboard", Component: CandidateDashboardRoute },
      { path: "exam/:id", Component: TakeExam },
      { path: "practice", Component: PracticeExam },
      { path: "results", Component: CandidateResultsRoute },
      { path: "materials", Component: CandidateMaterialsRoute },
    ],
  },
];

export const router = createBrowserRouter(routeConfig);
