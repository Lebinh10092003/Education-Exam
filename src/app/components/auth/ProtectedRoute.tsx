import { Navigate } from "react-router";

import { AdminLayout } from "../layouts/AdminLayout";
import { CandidateLayout } from "../layouts/CandidateLayout";
import { Login } from "../../pages/Login";
import { ADMIN_ROLES, getDefaultRouteForProfile } from "../../auth/AuthContext";
import { useAuth } from "../../auth/useAuth";

const FullscreenMessage = ({ message }: { message: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
    <div className="text-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  </div>
);

export const ProtectedAdminLayout = () => {
  const { isAuthenticated, isBootstrapping, profile } = useAuth();

  if (isBootstrapping) {
    return <FullscreenMessage message="Loading workspace..." />;
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
    return <FullscreenMessage message="Loading exam session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <CandidateLayout />;
};

export const PublicLoginPage = () => {
  const { isAuthenticated, isBootstrapping, profile } = useAuth();

  if (isBootstrapping) {
    return <FullscreenMessage message="Checking session..." />;
  }

  if (isAuthenticated && profile) {
    return <Navigate to={getDefaultRouteForProfile(profile)} replace />;
  }

  return <Login />;
};
