export interface CandidateResultRecord {
  id: number;
  workflow_status: string;
  publish_state: string;
  score: string;
  original_score: string;
  total_marks: string;
  percentage: string;
  original_percentage: string;
  penalty_percent_applied: string;
  certificate_level: string;
  result_status: string;
  passed: boolean | null;
  completed_date: string | null;
  published_at: string | null;
  time_taken_minutes: number;
  exam: {
    id: number;
    name: string;
    subject_name: string;
  };
  candidate: {
    id: number;
    email: string;
    full_name: string;
  };
}

export const toResultNumber = (value: string | number) => Number(value || 0);

export const formatResultNumber = (value: string | number) =>
  toResultNumber(value).toFixed(2).replace(/\.00$/, "");

export const formatResultDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not available";

export const getPerformanceBand = (percentage: string | number) => {
  const score = toResultNumber(percentage);
  if (score >= 90) {
    return "Excellent";
  }
  if (score >= 75) {
    return "Strong";
  }
  if (score >= 60) {
    return "Pass";
  }
  return "Needs Work";
};

export const getPerformanceMessage = (result: CandidateResultRecord) => {
  if (result.passed === true) {
    return "You met the published passing criteria for this exam.";
  }
  if (result.passed === false) {
    return "This published result is below the current passing threshold.";
  }
  return "This result is available, but the final pass status is still pending.";
};
