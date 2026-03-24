export interface CandidateAssignedExam {
  id: number;
  name: string;
  description: string;
  status: string;
  duration_minutes: number;
  passing_score: string;
  max_attempts: number;
  question_count: number;
  enable_proctoring: boolean;
  attempts_used: number;
  attempts_remaining: number;
  active_session_id: number | null;
  subject: {
    id: number;
    name: string;
    code: string;
    color: string;
  };
  schedule: {
    opens_at: string | null;
    closes_at: string | null;
  };
}

export type CandidateExamAvailability =
  | "available"
  | "upcoming"
  | "resume"
  | "closed"
  | "locked";

const isVietnameseLocale = (locale: string) => locale.toLowerCase().startsWith("vi");

const getCandidateExamCopy = (locale: string) =>
  isVietnameseLocale(locale)
    ? {
        notScheduled: "Chưa lên lịch",
        noScheduleWindow: "Chưa có khung thời gian",
        opens: "Mở từ",
        closes: "Đóng lúc",
        availability: {
          resume: "Đang làm",
          available: "Khả dụng",
          upcoming: "Sắp diễn ra",
          closed: "Đã đóng",
          locked: "Đã dùng hết lượt",
        },
        actions: {
          continueExam: "Tiếp tục bài thi",
          startExam: "Bắt đầu bài thi",
          viewDetails: "Xem chi tiết",
          unavailable: "Không khả dụng",
        },
      }
    : {
        notScheduled: "Not scheduled",
        noScheduleWindow: "No schedule window",
        opens: "Opens",
        closes: "Closes",
        availability: {
          resume: "In Progress",
          available: "Available",
          upcoming: "Upcoming",
          closed: "Closed",
          locked: "Attempts Used",
        },
        actions: {
          continueExam: "Continue Exam",
          startExam: "Start Exam",
          viewDetails: "View Details",
          unavailable: "Unavailable",
        },
      };

const normalizeExamLocale = (locale: string) => (isVietnameseLocale(locale) ? "vi-VN" : "en-GB");

export const formatExamDateTime = (value: string | null, locale = "en") => {
  const copy = getCandidateExamCopy(locale);
  if (!value) {
    return copy.notScheduled;
  }

  return new Intl.DateTimeFormat(normalizeExamLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export const formatExamSchedule = (opensAt: string | null, closesAt: string | null, locale = "en") => {
  const copy = getCandidateExamCopy(locale);
  if (!opensAt && !closesAt) {
    return copy.noScheduleWindow;
  }
  if (opensAt && closesAt) {
    return `${formatExamDateTime(opensAt, locale)} -> ${formatExamDateTime(closesAt, locale)}`;
  }
  return opensAt
    ? `${copy.opens} ${formatExamDateTime(opensAt, locale)}`
    : `${copy.closes} ${formatExamDateTime(closesAt, locale)}`;
};

export const getExamAvailabilityState = (
  exam: CandidateAssignedExam,
  now: Date = new Date(),
): CandidateExamAvailability => {
  if (exam.active_session_id) {
    return "resume";
  }
  if (exam.attempts_remaining <= 0) {
    return "locked";
  }
  if (exam.schedule.closes_at && new Date(exam.schedule.closes_at) < now) {
    return "closed";
  }
  if (exam.schedule.opens_at && new Date(exam.schedule.opens_at) > now) {
    return "upcoming";
  }
  return "available";
};

export const canLaunchExam = (exam: CandidateAssignedExam, now?: Date) => {
  const availability = getExamAvailabilityState(exam, now);
  return availability === "available" || availability === "resume";
};

export const getExamAvailabilityLabel = (
  exam: CandidateAssignedExam,
  options: { locale?: string; now?: Date } = {},
) => {
  const availability = getExamAvailabilityState(exam, options.now);
  return getExamAvailabilityLabelForState(availability, options.locale ?? "en", exam.status);
};

export const getExamAvailabilityLabelForState = (
  availability: CandidateExamAvailability,
  locale = "en",
  fallbackStatus?: string,
) => {
  const copy = getCandidateExamCopy(locale);
  switch (availability) {
    case "resume":
      return copy.availability.resume;
    case "available":
      return copy.availability.available;
    case "upcoming":
      return copy.availability.upcoming;
    case "closed":
      return copy.availability.closed;
    case "locked":
      return copy.availability.locked;
    default:
      return fallbackStatus ?? availability;
  }
};

export const getExamAvailabilityTone = (exam: CandidateAssignedExam, now?: Date) => {
  const availability = getExamAvailabilityState(exam, now);
  switch (availability) {
    case "resume":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "available":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "upcoming":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "closed":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "locked":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

export const getExamPrimaryAction = (
  exam: CandidateAssignedExam,
  options: { locale?: string; now?: Date } = {},
) => {
  const availability = getExamAvailabilityState(exam, options.now);
  const copy = getCandidateExamCopy(options.locale ?? "en");

  if (availability === "resume") {
    return {
      href: `/candidate/exam/${exam.id}`,
      label: copy.actions.continueExam,
      disabled: false,
    };
  }

  if (availability === "available" || availability === "upcoming" || availability === "closed") {
    return {
      href: `/candidate/exams/${exam.id}/instructions`,
      label: availability === "available" ? copy.actions.startExam : copy.actions.viewDetails,
      disabled: false,
    };
  }

  return {
    href: "",
    label: copy.actions.unavailable,
    disabled: true,
  };
};
