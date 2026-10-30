// Ban sao bai lam de thi sinh tu luu khi nop bai that bai (gui giam thi doi chieu).
import type { CandidateSession } from "./types";

export const buildBackupJson = (session: CandidateSession, examId: number) => {
  const backupData = {
    session_id: session.id,
    exam_id: session.exam_id ?? examId,
    exam_name: session.exam_name,
    attempt_number: session.attempt_number,
    timestamp: new Date().toISOString(),
    answers: session.questions.map((q) => ({
      question_id: q.id,
      sort_order: q.sort_order,
      question_type: q.question_type,
      selected_option_keys: q.selected_option_keys,
      answer_text: q.answer_text,
    })),
    tamper_proof_checksum: "",
  };

  const rawText = JSON.stringify(backupData.answers) + `_session_${session.id}_time_${backupData.timestamp}`;
  let hash = 0;
  for (let i = 0; i < rawText.length; i++) {
    hash = (hash << 5) - hash + rawText.charCodeAt(i);
    hash |= 0;
  }
  backupData.tamper_proof_checksum = Math.abs(hash).toString(16).toUpperCase();
  return backupData;
};

export const backupFileName = (session: CandidateSession) => {
  const sanitizedName = session.exam_name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  return `${sanitizedName}_backup_session_${session.id}.json`;
};

export const buildBackupText = (session: CandidateSession, examId: number) => {
  const answersSummary = session.questions
    .map((q) => {
      const ans = q.question_type === "essay" ? q.answer_text : q.selected_option_keys.join(", ");
      return `Q${q.sort_order}: ${ans || "[No answer]"}`;
    })
    .join("\n");

  return `--- EDUEXAM BACKUP ---
Exam ID: ${session.exam_id ?? examId}
Exam Name: ${session.exam_name}
Session ID: ${session.id}
Timestamp: ${new Date().toISOString()}
Answers:
${answersSummary}
---------------------`;
};

export const downloadJsonFile = (data: unknown, fileName: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
