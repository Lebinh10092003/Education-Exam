import { createBrowserRouter } from "react-router";
import { AdminLayout } from "./components/layouts/AdminLayout";
import { CandidateLayout } from "./components/layouts/CandidateLayout";
import { Dashboard } from "./pages/Dashboard";
import { UserManagement } from "./pages/UserManagement";
import { GroupManagement } from "./pages/GroupManagement";
import { SubjectManagement } from "./pages/SubjectManagement";
import { QuestionBank } from "./pages/QuestionBank";
import { ExamManagement } from "./pages/ExamManagement";
import { ExamCreationWizard } from "./pages/ExamCreationWizard";
import { ExamAssignment } from "./pages/ExamAssignment";
import { LiveMonitoring } from "./pages/LiveMonitoring";
import { TakeExam } from "./pages/TakeExam";
import { PracticeExam } from "./pages/PracticeExam";
import { MaterialsLibrary } from "./pages/MaterialsLibrary";
import { ResultsReports } from "./pages/ResultsReports";
import { Login } from "./pages/Login";
import { ForgotPassword } from "./pages/ForgotPassword";
import { Profile } from "./pages/Profile";
import { ImportJobs } from "./pages/ImportJobs";
import { ManualGrading } from "./pages/ManualGrading";
import { RolesPermissions } from "./pages/RolesPermissions";
import { NotificationCenter } from "./pages/NotificationCenter";
import { AuditCenter } from "./pages/AuditCenter";
import { ExamPeriods } from "./pages/ExamPeriods";
import { ExamRooms } from "./pages/ExamRooms";
import { ExamDetail } from "./pages/ExamDetail";
import { CandidateDashboard } from "./pages/CandidateDashboard";
import { CandidateResults } from "./pages/CandidateResults";
import { CandidateMaterials } from "./pages/CandidateMaterials";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/forgot-password",
    Component: ForgotPassword,
  },
  {
    path: "/",
    Component: AdminLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "users", Component: UserManagement },
      { path: "groups", Component: GroupManagement },
      { path: "subjects", Component: SubjectManagement },
      { path: "question-bank", Component: QuestionBank },
      { path: "exams", Component: ExamManagement },
      { path: "exams/create", Component: ExamCreationWizard },
      { path: "exams/:id", Component: ExamDetail },
      { path: "exams/:id/assign", Component: ExamAssignment },
      { path: "exams/:id/monitor", Component: LiveMonitoring },
      { path: "exam-periods", Component: ExamPeriods },
      { path: "exam-rooms", Component: ExamRooms },
      { path: "materials", Component: MaterialsLibrary },
      { path: "results", Component: ResultsReports },
      { path: "import-jobs", Component: ImportJobs },
      { path: "manual-grading", Component: ManualGrading },
      { path: "roles-permissions", Component: RolesPermissions },
      { path: "notifications", Component: NotificationCenter },
      { path: "audit", Component: AuditCenter },
      { path: "profile", Component: Profile },
    ],
  },
  {
    path: "/candidate",
    Component: CandidateLayout,
    children: [
      { index: true, Component: CandidateDashboard },
      { path: "dashboard", Component: CandidateDashboard },
      { path: "exam/:id", Component: TakeExam },
      { path: "practice", Component: PracticeExam },
      { path: "results", Component: CandidateResults },
      { path: "materials", Component: CandidateMaterials },
    ],
  },
]);