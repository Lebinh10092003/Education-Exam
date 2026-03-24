import { AlertCircle, FileText, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getMaterialPreviewKind,
  resolveMaterialFileUrl,
  type MaterialPreviewKind,
  type MaterialPreviewSource,
} from "../../lib/materialPreview";

interface MaterialPreviewPanelProps extends MaterialPreviewSource {
  title?: string;
}

type PreviewState =
  | { status: "idle"; kind: MaterialPreviewKind }
  | { status: "loading"; kind: MaterialPreviewKind }
  | { status: "ready"; kind: MaterialPreviewKind; html?: string; text?: string }
  | { status: "error"; kind: MaterialPreviewKind; message: string };

const MAX_TEXT_PREVIEW_CHARACTERS = 120_000;

export function MaterialPreviewPanel({
  file_url,
  file_name,
  mime_type,
  title,
}: MaterialPreviewPanelProps) {
  const { t } = useTranslation(["common"]);
  const previewUrl = useMemo(() => resolveMaterialFileUrl(file_url), [file_url]);
  const previewKind = useMemo(
    () => getMaterialPreviewKind({ file_url, file_name, mime_type }),
    [file_name, file_url, mime_type],
  );
  const [previewState, setPreviewState] = useState<PreviewState>({ status: "idle", kind: previewKind });

  useEffect(() => {
    let isCancelled = false;

    const loadPreview = async () => {
      if (!previewUrl || previewKind === "unsupported") {
        setPreviewState({ status: "ready", kind: previewKind });
        return;
      }

      if (previewKind === "pdf" || previewKind === "image" || previewKind === "video" || previewKind === "audio") {
        setPreviewState({ status: "ready", kind: previewKind });
        return;
      }

      setPreviewState({ status: "loading", kind: previewKind });

      try {
        const response = await fetch(previewUrl);
        if (!response.ok) {
          throw new Error(
            t("common:materials.previewError", {
              defaultValue: "Unable to load this file for preview.",
            }),
          );
        }

        if (previewKind === "text") {
          const text = (await response.text()).slice(0, MAX_TEXT_PREVIEW_CHARACTERS);
          if (!isCancelled) {
            setPreviewState({ status: "ready", kind: previewKind, text });
          }
          return;
        }

        if (previewKind === "docx") {
          const arrayBuffer = await response.arrayBuffer();
          const mammoth = await import("mammoth");
          const result = await mammoth.default.convertToHtml({ arrayBuffer });
          if (!isCancelled) {
            setPreviewState({
              status: "ready",
              kind: previewKind,
              html: result.value || `<p>${t("common:materials.emptyPreview", { defaultValue: "This document is empty." })}</p>`,
            });
          }
          return;
        }

        if (!isCancelled) {
          setPreviewState({ status: "ready", kind: previewKind });
        }
      } catch (error) {
        if (!isCancelled) {
          setPreviewState({
            status: "error",
            kind: previewKind,
            message:
              error instanceof Error
                ? error.message
                : t("common:materials.previewError", {
                    defaultValue: "Unable to load this file for preview.",
                  }),
          });
        }
      }
    };

    void loadPreview();

    return () => {
      isCancelled = true;
    };
  }, [previewKind, previewUrl, t]);

  if (previewState.status === "loading") {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-slate-500" />
        <p className="mt-3 text-sm text-slate-600">
          {t("common:materials.loadingPreview", { defaultValue: "Loading preview..." })}
        </p>
      </div>
    );
  }

  if (previewState.status === "error") {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="mt-3 text-sm font-medium text-red-700">
          {t("common:materials.previewUnavailable", {
            defaultValue: "This file cannot be previewed right now.",
          })}
        </p>
        <p className="mt-2 max-w-xl text-sm text-red-600">{previewState.message}</p>
      </div>
    );
  }

  if (previewKind === "unsupported" || !previewUrl) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
        <FileText className="h-8 w-8 text-slate-500" />
        <p className="mt-3 text-sm font-medium text-slate-700">
          {t("common:materials.previewUnavailable", {
            defaultValue: "Inline preview is not available for this file type.",
          })}
        </p>
        <p className="mt-2 max-w-xl text-sm text-slate-500">
          {t("common:materials.previewFallback", {
            defaultValue: "Use Open in New Tab or Download to access the full document.",
          })}
        </p>
      </div>
    );
  }

  if (previewKind === "pdf") {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <iframe
          className="min-h-[520px] w-full bg-white"
          src={previewUrl}
          title={title || file_name}
        />
      </div>
    );
  }

  if (previewKind === "image") {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950/5">
        <img alt={title || file_name} className="max-h-[620px] w-full object-contain" src={previewUrl} />
      </div>
    );
  }

  if (previewKind === "video") {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
        <video className="max-h-[620px] w-full" controls src={previewUrl}>
          {t("common:materials.videoUnsupported", {
            defaultValue: "Your browser does not support inline video playback.",
          })}
        </video>
      </div>
    );
  }

  if (previewKind === "audio") {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10">
        <audio className="w-full max-w-xl" controls src={previewUrl}>
          {t("common:materials.audioUnsupported", {
            defaultValue: "Your browser does not support inline audio playback.",
          })}
        </audio>
      </div>
    );
  }

  if (previewKind === "text") {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
        <pre className="max-h-[620px] overflow-auto p-5 text-sm whitespace-pre-wrap break-words text-slate-100">
          {previewState.status === "ready" ? previewState.text : ""}
        </pre>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div
        className="max-h-[620px] overflow-auto px-6 py-5 text-sm text-slate-700 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-2 [&_ul]:ml-5 [&_ul]:list-disc"
        dangerouslySetInnerHTML={{ __html: previewState.status === "ready" ? previewState.html ?? "" : "" }}
      />
    </div>
  );
}
