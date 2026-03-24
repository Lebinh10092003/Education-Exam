import type { CSSProperties } from "react";

const HEX_COLOR_PATTERN = /^#([0-9A-F]{3}|[0-9A-F]{6})$/i;
const SUBJECT_CODE_MAX_LENGTH = 16;

export const DEFAULT_SUBJECT_COLOR = "#2563EB";

export const LEGACY_SUBJECT_COLOR_MAP: Record<string, string> = {
  "bg-blue-600": "#2563EB",
  "bg-emerald-600": "#059669",
  "bg-amber-500": "#F59E0B",
  "bg-rose-600": "#E11D48",
  "bg-indigo-600": "#4F46E5",
  "bg-slate-700": "#334155",
};

const removeDiacritics = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^ -~]/g, "");

const expandHexColor = (value: string) => {
  const normalizedValue = value.trim().toUpperCase();

  if (!HEX_COLOR_PATTERN.test(normalizedValue)) {
    return null;
  }

  const hexBody = normalizedValue.slice(1);
  if (hexBody.length === 6) {
    return `#${hexBody}`;
  }

  return `#${hexBody
    .split("")
    .map((character) => `${character}${character}`)
    .join("")}`;
};

export const normalizeSubjectCodeInput = (value: string) =>
  removeDiacritics(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, SUBJECT_CODE_MAX_LENGTH);

const getSubjectCodeBase = (name: string) => {
  const words = removeDiacritics(name).toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  if (words.length === 0) {
    return "";
  }

  if (words.length === 1) {
    return words[0].slice(0, 3);
  }

  return words
    .map((word) => word[0])
    .join("")
    .slice(0, SUBJECT_CODE_MAX_LENGTH);
};

export const generateSubjectCode = (
  name: string,
  existingCodes: Iterable<string> = [],
  reservedCode = "",
) => {
  const baseCode = normalizeSubjectCodeInput(getSubjectCodeBase(name));
  if (!baseCode) {
    return "";
  }

  const normalizedReservedCode = normalizeSubjectCodeInput(reservedCode);
  const normalizedExistingCodes = new Set(
    Array.from(existingCodes)
      .map((code) => normalizeSubjectCodeInput(code))
      .filter(Boolean),
  );

  if (!normalizedExistingCodes.has(baseCode) || baseCode === normalizedReservedCode) {
    return baseCode;
  }

  let suffix = 2;
  while (suffix < 1000) {
    const nextCode = `${baseCode}${suffix}`.slice(0, SUBJECT_CODE_MAX_LENGTH);
    if (!normalizedExistingCodes.has(nextCode) || nextCode === normalizedReservedCode) {
      return nextCode;
    }
    suffix += 1;
  }

  return baseCode;
};

export const normalizeSubjectColorValue = (color: string) =>
  expandHexColor(color) ?? LEGACY_SUBJECT_COLOR_MAP[color] ?? DEFAULT_SUBJECT_COLOR;

const getContrastColor = (hexColor: string) => {
  const normalizedHex = normalizeSubjectColorValue(hexColor).slice(1);
  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance >= 160 ? "#0F172A" : "#FFFFFF";
};

export type SubjectColorPresentation = {
  containerClassName?: string;
  containerStyle?: CSSProperties;
  iconStyle?: CSSProperties;
};

export const getSubjectColorPresentation = (color: string): SubjectColorPresentation => {
  if (!color.startsWith("#")) {
    return {
      containerClassName: color,
      iconStyle: { color: "#FFFFFF" },
    };
  }

  const normalizedColor = normalizeSubjectColorValue(color);
  return {
    containerStyle: { backgroundColor: normalizedColor },
    iconStyle: { color: getContrastColor(normalizedColor) },
  };
};
