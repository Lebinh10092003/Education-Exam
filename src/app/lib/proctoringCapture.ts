export interface ProctoringCaptureResources {
  webcamStream: MediaStream;
  screenStream: MediaStream;
  webcamTrack: MediaStreamTrack;
  microphoneTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack;
  dispose: () => void;
}

/** Gom luong camera + man hinh thanh tai nguyen giam sat; tu tat het neu thieu track. */
export function buildProctoringResources(webcamStream: MediaStream, screenStream: MediaStream): ProctoringCaptureResources {
  const webcamTrack = webcamStream.getVideoTracks()[0];
  const microphoneTrack = webcamStream.getAudioTracks()[0] ?? null;
  const screenTrack = screenStream.getVideoTracks()[0];
  const stopAll = () => {
    webcamStream.getTracks().forEach((track) => track.stop());
    screenStream.getTracks().forEach((track) => track.stop());
  };

  if (!webcamTrack) {
    stopAll();
    throw new Error("Webcam access is required.");
  }
  if (!microphoneTrack) {
    stopAll();
    throw new Error("Microphone access is required.");
  }
  if (!screenTrack) {
    stopAll();
    throw new Error("Screen sharing is required.");
  }

  return {
    webcamStream,
    screenStream,
    webcamTrack,
    microphoneTrack,
    screenTrack,
    dispose: stopAll,
  };
}

export const requestWebcamStream = () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Webcam access is not supported in this browser.");
  }
  return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
};

export const requestScreenStream = () => {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen sharing is not supported in this browser.");
  }
  return navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: "monitor",
    },
    audio: false,
    selfBrowserSurface: "exclude",
    systemAudio: "exclude",
  } as any);
};

export async function requestProctoringStreams(): Promise<ProctoringCaptureResources> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Webcam access is not supported in this browser.");
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen sharing is not supported in this browser.");
  }
  const webcamStream = await requestWebcamStream();
  let screenStream: MediaStream;
  try {
    screenStream = await requestScreenStream();
  } catch (error) {
    webcamStream.getTracks().forEach((track) => track.stop());
    throw error;
  }
  return buildProctoringResources(webcamStream, screenStream);
}

/*
 * Ban giao quyen tu buoc "Kiem tra he thong" sang trang lam bai: camera + man hinh da cap
 * duoc giu nguyen (khong tat) de thi sinh khong phai cap quyen lan 2.
 * Tu giai phong neu khong ai nhan sau STASH_TTL_MS.
 */
const STASH_TTL_MS = 10 * 60 * 1000;
let stashed: { examId: string; resources: ProctoringCaptureResources; timer: ReturnType<typeof setTimeout> } | null = null;

const isLive = (track: MediaStreamTrack | null | undefined) => Boolean(track) && track!.readyState === "live";

export function releaseStashedProctoringStreams() {
  if (!stashed) return;
  clearTimeout(stashed.timer);
  stashed.resources.dispose();
  stashed = null;
}

export function stashProctoringStreams(examId: string | number, resources: ProctoringCaptureResources) {
  releaseStashedProctoringStreams();
  stashed = {
    examId: String(examId),
    resources,
    timer: setTimeout(releaseStashedProctoringStreams, STASH_TTL_MS),
  };
}

/** Con quyen hop le cho bai thi nay (cac track van dang chay)? */
export function hasStashedProctoringStreams(examId: string | number) {
  if (!stashed || stashed.examId !== String(examId)) return false;
  const { webcamTrack, microphoneTrack, screenTrack } = stashed.resources;
  return isLive(webcamTrack) && isLive(microphoneTrack) && isLive(screenTrack);
}

/** Nhan quyen da cap (trang lam bai chiu trach nhiem tat). Tra null neu khong con dung duoc. */
export function claimStashedProctoringStreams(examId: string | number): ProctoringCaptureResources | null {
  if (!hasStashedProctoringStreams(examId)) {
    releaseStashedProctoringStreams();
    return null;
  }
  const resources = stashed!.resources;
  clearTimeout(stashed!.timer);
  stashed = null;
  return resources;
}

interface CaptureTrackSnapshotOptions {
  maxWidth?: number;
  mimeType?: "image/jpeg" | "image/webp" | "image/png";
  quality?: number;
}

export async function captureTrackSnapshot(
  track: MediaStreamTrack,
  options: CaptureTrackSnapshotOptions = {},
): Promise<Blob> {
  const stream = new MediaStream([track]);
  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;

  try {
    await video.play();
    await new Promise<void>((resolve) => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        resolve();
        return;
      }
      video.onloadeddata = () => resolve();
    });

    const canvas = document.createElement("canvas");
    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const maxWidth = Math.max(320, options.maxWidth ?? 1280);
    const scale = sourceWidth > maxWidth ? maxWidth / sourceWidth : 1;
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to initialize snapshot canvas.");
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const mimeType = options.mimeType ?? "image/jpeg";
    const quality = options.quality ?? 0.82;
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mimeType, quality);
    });
    if (!blob) {
      throw new Error("Unable to capture snapshot.");
    }
    return blob;
  } finally {
    video.pause();
    video.srcObject = null;
  }
}
