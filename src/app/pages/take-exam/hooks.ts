import { useEffect, useRef, useState, type MutableRefObject } from "react";

import type { CandidateSession } from "./types";

/**
 * Dong ho lam bai: dem nguoc toi expires_at, sau do dem thoi gian an han (chi duoc nop bai).
 * graceRemaining = null khi con gio lam bai; timeUpRef dung trong handler de chan sua bai sau gio.
 */
export function useExamTimer(session: CandidateSession | null) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [graceRemaining, setGraceRemaining] = useState<number | null>(null);
  const timeUpRef = useRef(false);

  useEffect(() => {
    if (!session || session.status !== "in_progress") {
      return;
    }

    const expiresTime = new Date(session.expires_at).getTime();
    const graceSeconds = session.submission_grace_seconds ?? 300;
    const deadlineTime = session.submission_deadline
      ? new Date(session.submission_deadline).getTime()
      : expiresTime + graceSeconds * 1000;

    const updateTimer = () => {
      const now = new Date().getTime();
      const diffSeconds = Math.max(0, Math.ceil((expiresTime - now) / 1000));
      setTimeRemaining(diffSeconds);
      if (diffSeconds === 0) {
        const graceLeft = Math.max(0, Math.ceil((deadlineTime - now) / 1000));
        timeUpRef.current = true;
        setGraceRemaining(graceLeft);
      } else {
        timeUpRef.current = false;
        setGraceRemaining(null);
      }
    };

    updateTimer();
    const intervalId = window.setInterval(updateTimer, 1000);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.status, session?.expires_at, session?.submission_deadline, session?.submission_grace_seconds]);

  return { timeRemaining, setTimeRemaining, graceRemaining, timeUpRef };
}

type ShortcutHandlers = {
  onPrevious: () => void;
  onNext: () => void;
  onToggleFlag: () => void;
};

/** Phim tat khi lam bai: Alt+←/P cau truoc, Alt+→/N cau sau, Alt+F danh dau. */
export function useExamShortcuts(
  enabled: boolean,
  timeUpRef: MutableRefObject<boolean>,
  handlers: ShortcutHandlers,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (timeUpRef.current || !event.altKey) {
        return;
      }
      const key = event.key;
      if (key === "ArrowLeft" || key === "p" || key === "P") {
        event.preventDefault();
        handlersRef.current.onPrevious();
      } else if (key === "ArrowRight" || key === "n" || key === "N") {
        event.preventDefault();
        handlersRef.current.onNext();
      } else if (key === "f" || key === "F") {
        event.preventDefault();
        handlersRef.current.onToggleFlag();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, timeUpRef]);
}
