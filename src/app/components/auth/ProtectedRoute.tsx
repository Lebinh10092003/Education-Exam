import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";

import { AdminLayout } from "../layouts/AdminLayout";
import { CandidateLayout } from "../layouts/CandidateLayout";
import { Login } from "../../pages/Login";
import { ADMIN_ROLES, getDefaultRouteForProfile } from "../../auth/AuthContext";
import { useAuth } from "../../auth/useAuth";

const FullscreenMessage = ({ messageKey }: { messageKey: string }) => {
  const { t } = useTranslation("auth");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center">
        <p className="text-sm text-gray-500">{t(messageKey)}</p>
      </div>
    </div>
  );
};

export const ProtectedAdminLayout = () => {
  const { isAuthenticated, isBootstrapping, profile } = useAuth();

  if (isBootstrapping) {
    return <FullscreenMessage messageKey="protected.loadingWorkspace" />;
  }

  if (!isAuthenticated || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (!profile.roles.some((role) => ADMIN_ROLES.includes(role))) {
    return <Navigate to={getDefaultRouteForProfile(profile)} replace />;
  }

  return <AdminLayout />;
};

export const ProtectedCandidateLayout = () => {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <FullscreenMessage messageKey="protected.loadingExamSession" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <CandidateLayout />;
};

export const PublicLoginPage = () => {
  const { isAuthenticated, isBootstrapping, profile } = useAuth();

  if (isBootstrapping) {
    return <FullscreenMessage messageKey="protected.checkingSession" />;
  }

  if (isAuthenticated && profile) {
    return <Navigate to={getDefaultRouteForProfile(profile)} replace />;
  }

  return <Login />;
};
