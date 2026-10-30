export type CompetitionStatus = "upcoming" | "ongoing" | "ended";

/** Doc ngay dang DD/MM/YYYY (theo gio may nguoi xem). Sai dinh dang -> null. */
export const parseVietnameseDate = (value: string): Date | null => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Trang thai ky thi theo ngay hien tai: truoc ngay thi -> sap dien ra, dung ngay -> dang dien ra, sau -> da ket thuc. */
export const getCompetitionStatus = (examDate: string, now: Date = new Date()): CompetitionStatus => {
  const date = parseVietnameseDate(examDate);
  if (!date) {
    return "upcoming";
  }
  const exam = startOfDay(date);
  const today = startOfDay(now);
  if (today < exam) {
    return "upcoming";
  }
  return today === exam ? "ongoing" : "ended";
};

const STATUS_ORDER: Record<CompetitionStatus, number> = { ongoing: 0, upcoming: 1, ended: 2 };

/** Dang dien ra len dau, roi sap dien ra (gan nhat truoc), cuoi cung la da ket thuc (moi nhat truoc). */
export const sortCompetitionsByStatus = <T extends { date: string }>(items: T[], now: Date = new Date()) =>
  [...items]
    .map((item) => ({ item, status: getCompetitionStatus(item.date, now), time: parseVietnameseDate(item.date)?.getTime() ?? 0 }))
    .sort((a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.status === "ended" ? b.time - a.time : a.time - b.time),
    )
    .map(({ item, status }) => ({ ...item, status }));

export const COMPETITION_STATUS_STYLES: Record<CompetitionStatus, string> = {
  upcoming: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  ongoing: "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  ended: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
