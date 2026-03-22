export const NOTIFICATION_STATE_CHANGED_EVENT = "eduexam:notifications-updated";

export const emitNotificationStateChanged = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(NOTIFICATION_STATE_CHANGED_EVENT));
};
