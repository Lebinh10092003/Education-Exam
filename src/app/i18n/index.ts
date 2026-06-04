import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, getStoredLocale } from "../lib/storage";
import enAuth from "./resources/en/auth";
import enCommon from "./resources/en/common";
import enLanding from "./resources/en/landing";
import enNavigation from "./resources/en/navigation";
import enPractice from "./resources/en/practice";
import enProfile from "./resources/en/profile";
import viAuth from "./resources/vi/auth";
import viCommon from "./resources/vi/common";
import viLanding from "./resources/vi/landing";
import viNavigation from "./resources/vi/navigation";
import viPractice from "./resources/vi/practice";
import viProfile from "./resources/vi/profile";

const resources = {
  vi: {
    auth: viAuth,
    common: viCommon,
    landing: viLanding,
    navigation: viNavigation,
    practice: viPractice,
    profile: viProfile,
  },
  en: {
    auth: enAuth,
    common: enCommon,
    landing: enLanding,
    navigation: enNavigation,
    practice: enPractice,
    profile: enProfile,
  },
} as const;

if (!i18n.isInitialized) {
  void i18n.use(LanguageDetector).use(initReactI18next).init({
    resources,
    fallbackLng: DEFAULT_LOCALE,
    lng: getStoredLocale(),
    supportedLngs: ["vi", "en"],
    defaultNS: "common",
    ns: ["common", "auth", "landing", "navigation", "practice", "profile"],
    detection: {
      order: ["localStorage"],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
