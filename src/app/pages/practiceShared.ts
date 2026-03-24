export interface PracticeSubjectRecord {
  id: number;
  name: string;
  code: string;
  color: string;
}

export interface PracticeCatalogCounts {
  easy: number;
  medium: number;
  hard: number;
  total: number;
}

export interface PracticeCatalogItem {
  subject: PracticeSubjectRecord;
  counts: PracticeCatalogCounts;
}

export interface PracticeCatalogResponse {
  results: PracticeCatalogItem[];
}

export interface PracticeQuestionOption {
  key: string;
  text: string;
  sort_order: number;
}

export interface PracticeSessionQuestion {
  id: number;
  sort_order: number;
  difficulty: string;
  question_type: string;
  question_text: string;
  options: PracticeQuestionOption[];
  selected_option_keys: string[];
  is_answered: boolean;
  is_marked_for_review: boolean;
}

export interface PracticeSessionRecord {
  id: number;
  subject: PracticeSubjectRecord;
  status: string;
  duration_minutes: number;
  question_count: number;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  remaining_seconds: number;
  correct_count: number;
  total_count: number;
  score_percentage: string;
  answered_count: number;
  marked_count: number;
  total_questions: number;
  questions: PracticeSessionQuestion[];
}

export interface PracticeHistoryItem {
  id: number;
  subject: PracticeSubjectRecord;
  status: string;
  duration_minutes: number;
  question_count: number;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  remaining_seconds: number;
  correct_count: number;
  total_count: number;
  score_percentage: string;
  answered_count: number;
  marked_count: number;
  total_questions: number;
}

export interface PracticeAnswerResponse {
  id: number;
  selected_option_keys: string[];
  is_answered: boolean;
  is_marked_for_review: boolean;
  updated_at: string;
}

export interface PracticeAutosaveResponse {
  id: number;
  answered_count: number;
  marked_count: number;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface PracticeSubmitResponse {
  id: number;
  status: string;
  submitted_at: string | null;
  correct_count: number;
  total_count: number;
  score_percentage: string;
}

export interface PracticeReviewQuestion extends PracticeSessionQuestion {
  correct_option_keys: string[];
  is_correct: boolean | null;
  explanation_text: string;
}

export interface PracticeReviewRecord {
  id: number;
  subject: PracticeSubjectRecord;
  status: string;
  started_at: string;
  submitted_at: string | null;
  duration_minutes: number;
  summary: {
    correct_count: number;
    incorrect_count: number;
    total_count: number;
    score_percentage: string;
  };
  questions: PracticeReviewQuestion[];
}

const normalizePracticeLocale = (locale: string) => (locale.toLowerCase().startsWith("vi") ? "vi-VN" : "en-GB");

export const formatPracticeDateTime = (value: string | null, locale = "en") => {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat(normalizePracticeLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export const formatPracticePercent = (value: string | number) => `${Number(value).toFixed(0)}%`;

export const formatPracticeTimer = (seconds: number) => {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const sumDifficultyCounts = (counts: Record<string, number>) =>
  Object.values(counts).reduce((sum, value) => sum + value, 0);

export const getSelectedOptionLabel = (
  options: PracticeQuestionOption[],
  selectedKeys: string[],
  emptyLabel: string,
) => {
  if (!selectedKeys.length) {
    return emptyLabel;
  }
  return selectedKeys
    .map((selectedKey) => {
      const option = options.find((item) => item.key === selectedKey);
      return option ? `${option.key}. ${option.text}` : selectedKey;
    })
    .join(", ");
};

