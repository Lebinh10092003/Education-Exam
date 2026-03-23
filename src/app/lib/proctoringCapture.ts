export interface ProctoringCaptureResources {
  webcamStream: MediaStream;
  screenStream: MediaStream;
  webcamTrack: MediaStreamTrack;
  microphoneTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack;
  dispose: () => void;
}

export async function requestProctoringStreams(): Promise<ProctoringCaptureResources> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Webcam access is not supported in this browser.");
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen sharing is not supported in this browser.");
  }

  const webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const webcamTrack = webcamStream.getVideoTracks()[0];
  const microphoneTrack = webcamStream.getAudioTracks()[0] ?? null;
  const screenTrack = screenStream.getVideoTracks()[0];

  if (!webcamTrack) {
    webcamStream.getTracks().forEach((track) => track.stop());
    screenStream.getTracks().forEach((track) => track.stop());
    throw new Error("Webcam access is required.");
  }
  if (!microphoneTrack) {
    webcamStream.getTracks().forEach((track) => track.stop());
    screenStream.getTracks().forEach((track) => track.stop());
    throw new Error("Microphone access is required.");
  }
  if (!screenTrack) {
    webcamStream.getTracks().forEach((track) => track.stop());
    screenStream.getTracks().forEach((track) => track.stop());
    throw new Error("Screen sharing is required.");
  }

  return {
    webcamStream,
    screenStream,
    webcamTrack,
    microphoneTrack,
    screenTrack,
    dispose: () => {
      webcamStream.getTracks().forEach((track) => track.stop());
      screenStream.getTracks().forEach((track) => track.stop());
    },
  };
}

export async function captureTrackSnapshot(track: MediaStreamTrack): Promise<Blob> {
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
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to initialize snapshot canvas.");
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
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
