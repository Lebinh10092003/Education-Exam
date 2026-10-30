import { apiRequest } from "./http";
import type { CompetitionStatus } from "./competitionStatus";

export type PublicCompetition = {
  id: number;
  name: string;
  code: string;
  description: string;
  cycle: string;
  exam_date: string;
  registration_deadline: string | null;
  info_url: string;
  status: CompetitionStatus;
  accepts_registration: boolean;
};

export type AdminCompetition = Omit<PublicCompetition, "accepts_registration"> & {
  registration_open: boolean;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  accepts_registration: boolean;
  registration_count: number;
  created_at: string;
  updated_at: string;
};

export type RegistrationStatus = "new" | "contacted" | "confirmed" | "rejected";

export type CompetitionRegistration = {
  id: number;
  full_name: string;
  date_of_birth: string;
  grade: string;
  school: string;
  class_name: string;
  cccd: string;
  address: string;
  ward: string;
  city: string;
  email: string;
  guardian_phone: string;
  competitions: Array<{ id: number; code: string; name: string; cycle: string }>;
  status: RegistrationStatus;
  admin_note: string;
  handled_by_name: string;
  handled_at: string | null;
  created_at: string;
};

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  confirmed: "Đã xác nhận",
  rejected: "Từ chối",
};

/** Cuoc thi cong khai (khong can dang nhap). all=true: ca cuoc thi khong "noi bat" (dung cho form dang ky). */
export const fetchPublicCompetitions = (options: { all?: boolean } = {}) =>
  apiRequest<PublicCompetition[]>("/api/v1/public/competitions/", {
    auth: false,
    query: options.all ? { all: "1" } : undefined,
  });

/** "2026-05-31" -> "31/05/2026" (khong lech mui gio vi khong qua Date). */
export const formatIsoDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

/** So ngay tu hom nay (gio may nguoi dung) den ngay ISO; am neu da qua. */
export const daysUntil = (value: string | null | undefined, today: Date = new Date()) => {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const target = Date.UTC(year, month - 1, day);
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / 86_400_000);
};

/** Cuoc thi dang mo dang ky co han gan nhat (dung cho loi nhac o banner). */
export const pickNextOpenCompetition = (items: PublicCompetition[]) =>
  items
    .filter((item) => item.accepts_registration)
    .sort((a, b) =>
      (a.registration_deadline ?? a.exam_date).localeCompare(b.registration_deadline ?? b.exam_date),
    )[0] ?? null;
