import Swal, { type SweetAlertIcon } from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import i18n from "../i18n";

interface NotifyOptions {
  timer?: number;
  title?: string;
}

interface ConfirmOptions {
  title: string;
  text?: string;
  html?: string;
  icon?: SweetAlertIcon;
  confirmText?: string;
  cancelText?: string;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
  reverseButtons?: boolean;
}

const bindTimerControls = (element: HTMLElement) => {
  element.addEventListener("mouseenter", Swal.stopTimer);
  element.addEventListener("mouseleave", Swal.resumeTimer);
};

const toast = Swal.mixin({
  toast: true,
  position: "center",
  showConfirmButton: false,
  showCloseButton: false,
  timer: 2400,
  timerProgressBar: true,
  didOpen: bindTimerControls,
});

const fireToast = (icon: Exclude<SweetAlertIcon, "question">, message: string, options?: NotifyOptions) =>
  toast.fire({
    icon,
    title: options?.title ?? message,
    text: options?.title ? message : undefined,
    timer: options?.timer ?? (icon === "info" ? 4200 : icon === "warning" ? 3200 : 2400),
  });

export const notify = {
  success: (message: string, options?: NotifyOptions) => fireToast("success", message, options),
  info: (message: string, options?: NotifyOptions) => fireToast("info", message, options),
  warning: (message: string, options?: NotifyOptions) => fireToast("warning", message, options),
  error: (message: string, options?: NotifyOptions) =>
    Swal.fire({
      icon: "error",
      title: options?.title ?? i18n.t("common:status.error", { defaultValue: "Error" }),
      text: message,
      confirmButtonText: options?.timer ? undefined : i18n.t("common:actions.close"),
      showConfirmButton: !options?.timer,
      position: "center",
      heightAuto: false,
      timer: options?.timer,
      timerProgressBar: Boolean(options?.timer),
      didOpen: options?.timer ? bindTimerControls : undefined,
    }),
  confirm: async (options: ConfirmOptions) => {
    const result = await Swal.fire({
      icon: options.icon ?? "warning",
      title: options.title,
      text: options.text,
      html: options.html,
      position: "center",
      showCancelButton: true,
      confirmButtonText: options.confirmText ?? i18n.t("common:actions.confirm"),
      cancelButtonText: options.cancelText ?? i18n.t("common:actions.cancel"),
      confirmButtonColor: options.confirmButtonColor,
      cancelButtonColor: options.cancelButtonColor,
      reverseButtons: options.reverseButtons ?? true,
      focusCancel: true,
      heightAuto: false,
    });

    return result.isConfirmed;
  },
};
