export type PermissionLocale = "vi" | "en";

interface PermissionLocalizationEntry {
  display: string;
  description: string;
}

interface LocalizablePermission {
  module?: string | null;
  action?: string | null;
  code?: string | null;
  description?: string | null;
}

const MODULE_LOCALIZATIONS: Record<
  string,
  Record<PermissionLocale, PermissionLocalizationEntry>
> = {
  audit: {
    en: { display: "Audit", description: "audit" },
    vi: { display: "Audit", description: "audit" },
  },
  exams: {
    en: { display: "Exams", description: "exams" },
    vi: { display: "Kỳ thi", description: "kỳ thi" },
  },
  grading: {
    en: { display: "Grading", description: "grading" },
    vi: { display: "Chấm điểm", description: "chấm điểm" },
  },
  groups: {
    en: { display: "Groups", description: "groups" },
    vi: { display: "Nhóm", description: "nhóm" },
  },
  materials: {
    en: { display: "Materials", description: "materials" },
    vi: { display: "Tài liệu", description: "tài liệu" },
  },
  notifications: {
    en: { display: "Notifications", description: "notifications" },
    vi: { display: "Thông báo", description: "thông báo" },
  },
  permissions: {
    en: { display: "Permissions", description: "permissions" },
    vi: { display: "Quyền", description: "quyền" },
  },
  proctoring: {
    en: { display: "Proctoring", description: "proctoring" },
    vi: { display: "Giám sát", description: "giám sát" },
  },
  questions: {
    en: { display: "Questions", description: "questions" },
    vi: { display: "Câu hỏi", description: "câu hỏi" },
  },
  results: {
    en: { display: "Results", description: "results" },
    vi: { display: "Kết quả", description: "kết quả" },
  },
  roles: {
    en: { display: "Roles", description: "roles" },
    vi: { display: "Vai trò", description: "vai trò" },
  },
  schools: {
    en: { display: "Schools", description: "schools" },
    vi: { display: "Trường", description: "trường" },
  },
  subjects: {
    en: { display: "Subjects", description: "subjects" },
    vi: { display: "Môn học", description: "môn học" },
  },
  users: {
    en: { display: "Users", description: "users" },
    vi: { display: "Người dùng", description: "người dùng" },
  },
  other: {
    en: { display: "Other", description: "other" },
    vi: { display: "Khác", description: "khác" },
  },
};

const ACTION_DESCRIPTION_TEMPLATES: Record<
  PermissionLocale,
  Partial<Record<string, (moduleDescription: string) => string>>
> = {
  en: {
    view: (moduleDescription) => `View access for ${moduleDescription}.`,
    manage: (moduleDescription) => `Manage access for ${moduleDescription}.`,
  },
  vi: {
    view: (moduleDescription) => `Quyền xem ${moduleDescription}.`,
    manage: (moduleDescription) => `Quyền quản lý ${moduleDescription}.`,
  },
};

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const humanizeModuleKey = (moduleKey: string) => moduleKey.replaceAll("_", " ").trim();

const normalizeModuleKey = (module?: string | null) => {
  const trimmed = module?.trim().toLowerCase();
  return trimmed || "other";
};

const normalizeActionKey = (action?: string | null) => {
  const trimmed = action?.trim().toLowerCase();
  return trimmed || "";
};

export const normalizePermissionLocale = (locale?: string | null): PermissionLocale =>
  locale?.toLowerCase().startsWith("en") ? "en" : "vi";

export function getPermissionModuleLabel(module: string | null | undefined, locale: string): string {
  const normalizedLocale = normalizePermissionLocale(locale);
  const moduleKey = normalizeModuleKey(module);
  const localizedModule = MODULE_LOCALIZATIONS[moduleKey]?.[normalizedLocale];
  if (localizedModule) {
    return localizedModule.display;
  }

  const humanized = humanizeModuleKey(moduleKey);
  return humanized ? toTitleCase(humanized) : MODULE_LOCALIZATIONS.other[normalizedLocale].display;
}

function getPermissionModuleDescription(module: string | null | undefined, locale: string): string {
  const normalizedLocale = normalizePermissionLocale(locale);
  const moduleKey = normalizeModuleKey(module);
  const localizedModule = MODULE_LOCALIZATIONS[moduleKey]?.[normalizedLocale];
  if (localizedModule) {
    return localizedModule.description;
  }

  const humanized = humanizeModuleKey(moduleKey);
  return humanized || MODULE_LOCALIZATIONS.other[normalizedLocale].description;
}

function inferPermissionAction(permission: LocalizablePermission): string {
  const directAction = normalizeActionKey(permission.action);
  if (directAction) {
    return directAction;
  }

  const codeAction = permission.code?.split(".").at(-1)?.trim().toLowerCase();
  if (codeAction) {
    return codeAction;
  }

  const descriptionAction = permission.description?.match(/^([A-Za-z]+) access for /)?.[1]?.toLowerCase();
  return descriptionAction ?? "";
}

export function getPermissionDescription(permission: LocalizablePermission, locale: string): string {
  const normalizedLocale = normalizePermissionLocale(locale);
  const actionKey = inferPermissionAction(permission);
  const formatter = ACTION_DESCRIPTION_TEMPLATES[normalizedLocale][actionKey];
  if (formatter) {
    return formatter(getPermissionModuleDescription(permission.module, normalizedLocale));
  }

  const fallbackDescription = permission.description?.trim();
  if (fallbackDescription) {
    return fallbackDescription;
  }

  const localizedModuleDescription = getPermissionModuleDescription(permission.module, normalizedLocale);
  return normalizedLocale === "vi"
    ? `Quyền ${localizedModuleDescription}.`
    : `Access for ${localizedModuleDescription}.`;
}
