import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import i18n from "../i18n";
import { apiRequest, AUTH_ERROR_EVENT } from "../lib/http";
import { notify } from "../lib/notify";
import { clearStoredTokens, getStoredTokens, setStoredTokens, type AuthTokens } from "../lib/storage";

export interface AuthProfile {
  id: number;
  username: string;
  email: string;
  full_name: string;
  status: string;
  is_active: boolean;
  phone_number: string;
  school: {
    id: number;
    name: string;
    code: string;
  } | null;
  roles: string[];
  avatar_url: string;
}

interface LoginResponse {
  access: string;
  refresh: string;
}

interface AuthContextValue {
  tokens: AuthTokens | null;
  profile: AuthProfile | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (identifier: string, password: string) => Promise<AuthProfile>;
  logout: () => void;
  refreshProfile: () => Promise<AuthProfile | null>;
  hasAnyRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ADMIN_ROLES = ["administrator", "examiner", "proctor"];
const normalizeAuthErrorMessage = (message?: string) => {
  if (message?.trim() === "User is inactive") {
    return i18n.t("auth:errors.inactiveAccount");
  }
  return message?.trim() || i18n.t("auth:errors.sessionEnded");
};

export const getDefaultRouteForProfile = (profile: AuthProfile | null) => {
  if (!profile) {
    return "/login";
  }

  if (profile.roles.some((role) => ADMIN_ROLES.includes(role))) {
    return "/";
  }

  return "/candidate/practice";
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [tokens, setTokens] = useState<AuthTokens | null>(() => getStoredTokens());
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const logout = useCallback(() => {
    clearStoredTokens();
    setTokens(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const nextProfile = await apiRequest<AuthProfile>("/api/v1/profile/");
      setProfile(nextProfile);
      return nextProfile;
    } catch {
      logout();
      return null;
    }
  }, [logout]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const loginResponse = await apiRequest<LoginResponse>("/api/v1/auth/login/", {
        method: "POST",
        auth: false,
        body: { identifier, email: identifier, password },
      });

      const nextTokens = {
        access: loginResponse.access,
        refresh: loginResponse.refresh,
      };

      setStoredTokens(nextTokens);
      setTokens(nextTokens);

      const nextProfile = await apiRequest<AuthProfile>("/api/v1/profile/");
      setProfile(nextProfile);
      return nextProfile;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const storedTokens = getStoredTokens();
      if (!storedTokens) {
        setIsBootstrapping(false);
        return;
      }

      setTokens(storedTokens);
      const nextProfile = await refreshProfile();
      if (!cancelled) {
        setProfile(nextProfile);
        setIsBootstrapping(false);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [refreshProfile]);

  useEffect(() => {
    const handleAuthError = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      logout();
      void notify.error(normalizeAuthErrorMessage(customEvent.detail?.message), {
        title: i18n.t("auth:errors.sessionEndedTitle"),
        timer: 4000,
      });
    };

    window.addEventListener(AUTH_ERROR_EVENT, handleAuthError as EventListener);
    return () => window.removeEventListener(AUTH_ERROR_EVENT, handleAuthError as EventListener);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      tokens,
      profile,
      isAuthenticated: Boolean(tokens?.access && profile),
      isBootstrapping,
      login,
      logout,
      refreshProfile,
      hasAnyRole: (...roles: string[]) => Boolean(profile?.roles.some((role) => roles.includes(role))),
    }),
    [isBootstrapping, login, logout, profile, refreshProfile, tokens],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { ADMIN_ROLES, AuthContext };
