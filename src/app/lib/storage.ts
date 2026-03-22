export interface AuthTokens {
  access: string;
  refresh: string;
}

const AUTH_TOKENS_STORAGE_KEY = "eduexam.auth.tokens";
export const LOCALE_STORAGE_KEY = "eduexam.locale";
export const DEFAULT_LOCALE = "vi";

export type AppLocale = "vi" | "en";

const isSupportedLocale = (value: unknown): value is AppLocale => value === "vi" || value === "en";

export const getStoredTokens = (): AuthTokens | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(AUTH_TOKENS_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as AuthTokens;
    if (!parsedValue.access || !parsedValue.refresh) {
      return null;
    }
    return parsedValue;
  } catch {
    return null;
  }
};

export const setStoredTokens = (tokens: AuthTokens) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_TOKENS_STORAGE_KEY, JSON.stringify(tokens));
};

export const clearStoredTokens = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKENS_STORAGE_KEY);
};

export const getStoredLocale = (): AppLocale => {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  const rawValue = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (!rawValue || !isSupportedLocale(rawValue)) {
    return DEFAULT_LOCALE;
  }

  return rawValue;
};

export const setStoredLocale = (locale: AppLocale) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
};
