export interface MaterialPreviewSource {
  file_url: string;
  file_name: string;
  mime_type: string;
}

export type MaterialPreviewKind = "pdf" | "image" | "video" | "audio" | "text" | "docx" | "unsupported";

const IMAGE_EXTENSIONS = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const VIDEO_EXTENSIONS = new Set(["m4v", "mov", "mp4", "ogv", "webm"]);
const AUDIO_EXTENSIONS = new Set(["aac", "mp3", "oga", "ogg", "wav"]);
const TEXT_EXTENSIONS = new Set(["csv", "html", "htm", "json", "log", "md", "markdown", "txt", "xml", "yaml", "yml"]);
const DOCX_EXTENSIONS = new Set(["docx"]);

const TEXT_MIME_TYPES = new Set([
  "application/csv",
  "application/json",
  "application/ld+json",
  "application/rtf",
  "application/xml",
  "application/x-yaml",
  "text/csv",
  "text/html",
  "text/markdown",
  "text/plain",
  "text/xml",
]);

const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const PDF_MIME_TYPE = "application/pdf";

const normalizeMimeType = (value: string) => value.split(";")[0]?.trim().toLowerCase() ?? "";

const getExtension = (fileName: string) => fileName.split(".").at(-1)?.trim().toLowerCase() ?? "";

export const resolveMaterialFileUrl = (fileUrl: string) => {
  if (!fileUrl) {
    return "";
  }

  if (/^https?:\/\//i.test(fileUrl)) {
    return fileUrl;
  }

  return fileUrl.startsWith("/") ? fileUrl : `/${fileUrl.replace(/^\/+/, "")}`;
};

export const getMaterialPreviewKind = (material: MaterialPreviewSource): MaterialPreviewKind => {
  const mimeType = normalizeMimeType(material.mime_type);
  const extension = getExtension(material.file_name);

  if (mimeType === PDF_MIME_TYPE || extension === "pdf") {
    return "pdf";
  }

  if (mimeType.startsWith("image/") || IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  if (mimeType.startsWith("video/") || VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }

  if (mimeType.startsWith("audio/") || AUDIO_EXTENSIONS.has(extension)) {
    return "audio";
  }

  if (DOCX_MIME_TYPES.has(mimeType) || DOCX_EXTENSIONS.has(extension)) {
    return "docx";
  }

  if (mimeType.startsWith("text/") || TEXT_MIME_TYPES.has(mimeType) || TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }

  return "unsupported";
};

export const canPreviewMaterial = (material: MaterialPreviewSource) => getMaterialPreviewKind(material) !== "unsupported";
