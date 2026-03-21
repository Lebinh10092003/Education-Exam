import { createBrowserRouter } from "react-router";
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
import { ForgotPassword } from "./pages/ForgotPassword";
import { Profile } from "./pages/Profile";
import {
  ProtectedAdminLayout,
  ProtectedCandidateLayout,
  PublicLoginPage,
} from "./components/auth/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: PublicLoginPage,
  },
  {
    path: "/forgot-password",
    Component: ForgotPassword,
  },
  {
    path: "/",
    Component: ProtectedAdminLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "users", Component: UserManagement },
      { path: "groups", Component: GroupManagement },
      { path: "subjects", Component: SubjectManagement },
      { path: "question-bank", Component: QuestionBank },
      { path: "exams", Component: ExamManagement },
      { path: "exams/create", Component: ExamCreationWizard },
      { path: "exams/:id/edit", Component: ExamCreationWizard },
      { path: "exams/:id/assign", Component: ExamAssignment },
      { path: "exams/:id/monitor", Component: LiveMonitoring },
      { path: "materials", Component: MaterialsLibrary },
      { path: "results", Component: ResultsReports },
      { path: "profile", Component: Profile },
    ],
  },
  {
    path: "/candidate",
    Component: ProtectedCandidateLayout,
    children: [
      { path: "exam/:id", Component: TakeExam },
      { path: "practice", Component: PracticeExam },
    ],
  },
]);
