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

export const formatExamDateTime = (value: string | null) => {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export const formatExamSchedule = (opensAt: string | null, closesAt: string | null) => {
  if (!opensAt && !closesAt) {
    return "No schedule window";
  }
  if (opensAt && closesAt) {
    return `${formatExamDateTime(opensAt)} -> ${formatExamDateTime(closesAt)}`;
  }
  return opensAt ? `Opens ${formatExamDateTime(opensAt)}` : `Closes ${formatExamDateTime(closesAt)}`;
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

export const getExamAvailabilityLabel = (exam: CandidateAssignedExam, now?: Date) => {
  const availability = getExamAvailabilityState(exam, now);
  switch (availability) {
    case "resume":
      return "In Progress";
    case "available":
      return "Available";
    case "upcoming":
      return "Upcoming";
    case "closed":
      return "Closed";
    case "locked":
      return "Attempts Used";
    default:
      return exam.status;
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

export const getExamPrimaryAction = (exam: CandidateAssignedExam, now?: Date) => {
  const availability = getExamAvailabilityState(exam, now);

  if (availability === "resume") {
    return {
      href: `/candidate/exam/${exam.id}`,
      label: "Continue Exam",
      disabled: false,
    };
  }

  if (availability === "available" || availability === "upcoming" || availability === "closed") {
    return {
      href: `/candidate/exams/${exam.id}/instructions`,
      label: availability === "available" ? "Start Exam" : "View Details",
      disabled: false,
    };
  }

  return {
    href: "",
    label: "Unavailable",
    disabled: true,
  };
};
