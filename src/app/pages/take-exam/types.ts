import type { RefObject } from "react";

export interface SessionQuestion {
  id: number;
  sort_order: number;
  points: string;
  question_text: string;
  question_type: string;
  difficulty: string;
  options: Array<{
    key: string;
    text: string;
    sort_order: number;
  }>;
  selected_option_keys: string[];
  answer_text: string;
  is_answered: boolean;
  is_marked_for_review: boolean;
}

export interface CandidateSession {
  id: number;
  exam_id: number;
  exam_name: string;
  subject: {
    id: number;
    name: string;
    code: string;
    color: string;
  };
  status: string;
  attempt_number: number;
  started_at: string;
  expires_at: string;
  submission_deadline?: string;
  submission_grace_seconds?: number;
  is_late?: boolean;
  submitted_at: string | null;
  show_results_immediately: boolean;
  enable_proctoring: boolean;
  remaining_seconds: number;
  objective_score: string;
  max_score: string;
  manual_grading_required: boolean;
  answered_count: number;
  marked_count: number;
  total_questions: number;
  questions: SessionQuestion[];
}

export interface SessionAnswerResponse {
  session_question: number;
  selected_option_keys: string[];
  answer_text: string;
  is_answered: boolean;
  is_marked_for_review: boolean;
  updated_at: string;
}

export interface AutosaveResponse {
  id: number | null;
  answered_count: number;
  marked_count: number;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface SubmissionSummary {
  id: number;
  status: string;
  submitted_at: string;
  objective_score: string;
  max_score: string;
  manual_grading_required: boolean;
  is_late?: boolean;
}

export type AnswerPayload = Partial<{
  selected_option_keys: string[];
  answer_text: string;
  is_marked_for_review: boolean;
}>;

export type ConnectionStatus = "stable" | "offline" | "unstable";

export type ViolationNotice = {
  severity: "warning" | "critical";
  message: string;
  occurredAt: string;
};

export type NavigatorConnectionInfo = {
  effectiveType?: string;
  rtt?: number;
};

export type PreviewVideoRef = RefObject<HTMLVideoElement | null>;
