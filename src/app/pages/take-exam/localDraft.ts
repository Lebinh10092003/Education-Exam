// Hang doi cau tra loi cuc bo: luu IndexedDB (du phong LocalStorage) truoc khi gui server,
// dong bo lai khi co mang. Giup thi sinh khong mat bai khi rot mang.
import { apiRequest } from "../../lib/http";
import { clearExamDraft, getExamDraft, saveExamDraft } from "../../lib/snapshotStore";
import type { AnswerPayload, SessionQuestion } from "./types";

const fallbackKey = (sessionId: number) => `eduexam_pending_sync_${sessionId}`;

export const saveToLocalDraft = async (sessionId: number, questionId: number, payload: AnswerPayload) => {
  try {
    const draft = await getExamDraft(sessionId) ?? {
      sessionId,
      answers: {},
      version: 0,
      timestamp: Date.now(),
    };
    draft.answers[String(questionId)] = payload;
    draft.version += 1;
    draft.timestamp = Date.now();
    await saveExamDraft(draft);
  } catch (err) {
    console.error("Failed to save answer to IndexedDB, falling back to LocalStorage", err);
    try {
      const key = fallbackKey(sessionId);
      const dataStr = localStorage.getItem(key);
      const pending = dataStr ? JSON.parse(dataStr) : {};
      pending[questionId] = {
        payload,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(pending));
    } catch (localErr) {
      console.error("Failed to save answer to local storage", localErr);
    }
  }
};

export const removeFromLocalDraft = async (sessionId: number, questionId: number) => {
  try {
    const draft = await getExamDraft(sessionId);
    if (draft && draft.answers[String(questionId)]) {
      delete draft.answers[String(questionId)];
      if (Object.keys(draft.answers).length === 0) {
        await clearExamDraft(sessionId);
      } else {
        draft.version += 1;
        draft.timestamp = Date.now();
        await saveExamDraft(draft);
      }
    }
  } catch (err) {
    console.error("Failed to remove answer from IndexedDB", err);
  }

  try {
    const key = fallbackKey(sessionId);
    const dataStr = localStorage.getItem(key);
    if (dataStr) {
      const pending = JSON.parse(dataStr);
      delete pending[questionId];
      if (Object.keys(pending).length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(pending));
      }
    }
  } catch (err) {
    console.error("Failed to remove answer from local storage", err);
  }
};

export const countPendingSync = async (sessionId: number): Promise<number> => {
  let count = 0;
  try {
    const draft = await getExamDraft(sessionId);
    if (draft && draft.answers) {
      count += Object.keys(draft.answers).length;
    }
  } catch (err) {
    console.error("Failed to count draft answers", err);
  }
  try {
    const dataStr = localStorage.getItem(fallbackKey(sessionId));
    if (dataStr) {
      const pending = JSON.parse(dataStr);
      count += Object.keys(pending).length;
    }
  } catch (err) {
    console.error("Failed to count fallback answers", err);
  }
  return count;
};

const putAnswer = (sessionId: number, questionId: string, payload: AnswerPayload) =>
  apiRequest(`/api/v1/exam-sessions/${sessionId}/answers/${questionId}/`, {
    method: "PUT",
    body: payload,
  });

export const syncLocalDraftQueue = async (sessionId: number, onProgress?: () => void) => {
  try {
    const draft = await getExamDraft(sessionId);
    if (draft && draft.answers) {
      for (const questionId of Object.keys(draft.answers)) {
        try {
          await putAnswer(sessionId, questionId, draft.answers[questionId]);
          await removeFromLocalDraft(sessionId, Number(questionId));
          onProgress?.();
        } catch {
          break;
        }
      }
    }
  } catch (err) {
    console.error("Failed to sync IndexedDB drafts queue", err);
  }

  try {
    const dataStr = localStorage.getItem(fallbackKey(sessionId));
    if (dataStr) {
      const pending = JSON.parse(dataStr);
      for (const questionId of Object.keys(pending)) {
        try {
          await putAnswer(sessionId, questionId, pending[questionId].payload);
          await removeFromLocalDraft(sessionId, Number(questionId));
          onProgress?.();
        } catch {
          break;
        }
      }
    }
  } catch (err) {
    console.error("Failed to sync local storage fallback queue", err);
  }
};

/** Ap cau tra loi con nam cuc bo (chua kip gui) len danh sach cau hoi tu server. */
export const mergeLocalDraftAnswers = async (
  sessionId: number,
  questions: SessionQuestion[],
): Promise<SessionQuestion[]> => {
  const localDraft = await getExamDraft(sessionId);
  const localFallbackStr = localStorage.getItem(fallbackKey(sessionId));
  const localFallback = localFallbackStr ? JSON.parse(localFallbackStr) : null;

  return questions.map((q) => {
    let localAns = localDraft?.answers[String(q.id)];
    if (!localAns && localFallback && localFallback[String(q.id)]) {
      localAns = localFallback[String(q.id)].payload;
    }
    if (localAns) {
      return {
        ...q,
        selected_option_keys: localAns.selected_option_keys ?? q.selected_option_keys,
        answer_text: localAns.answer_text ?? q.answer_text,
        is_answered: true,
        is_marked_for_review: localAns.is_marked_for_review ?? q.is_marked_for_review,
      };
    }
    return q;
  });
};
