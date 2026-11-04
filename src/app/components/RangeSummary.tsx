import { useTranslation } from "react-i18next";

import { translateLegacyUiText } from "../i18n/legacyUiFallback";

interface RangeSummaryProps {
  start: number;
  end: number;
  total: number;
  /** Don vi tieng Anh (vd. "users", "event(s)"); duoc dich qua tu dien cua bridge. */
  unit: string;
}

// Dong "Showing x-y of n ..." duoi bang: render theo ngon ngu hien tai va giu so in dam.
// Truoc day chuoi bi tach thanh nhieu node <strong> nen bridge dich khong khop duoc.
export function RangeSummary({ start, end, total, unit }: RangeSummaryProps) {
  const { i18n } = useTranslation();
  const isVietnamese = (i18n.resolvedLanguage ?? i18n.language ?? "vi").startsWith("vi");
  const range = <strong className="font-semibold text-slate-900 dark:text-slate-100">{`${start}-${end}`}</strong>;
  const count = <strong className="font-semibold text-slate-900 dark:text-slate-100">{total}</strong>;

  if (isVietnamese) {
    // Lay don vi tieng Viet tu chinh mau dich "Showing ..." cua bridge.
    const translatedUnit = translateLegacyUiText("vi", `Showing 1-1 of 1 ${unit}`).replace(/^Hiển thị 1-1 trên tổng số 1 /, "");
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400" data-legacy-i18n-ignore="true">
        Hiển thị {range} trên tổng số {count} {translatedUnit}
      </p>
    );
  }

  return (
    <p className="text-sm text-slate-600 dark:text-slate-400" data-legacy-i18n-ignore="true">
      Showing {range} of {count} {unit}
    </p>
  );
}
