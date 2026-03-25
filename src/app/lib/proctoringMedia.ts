import { Room, Track } from "livekit-client";

import { apiRequest } from "./http";

export interface MediaTokenPayload {
  provider: string;
  server_url: string;
  room_name: string;
  participant_name: string;
  access_token: string;
  expires_at: string;
}

export interface MediaStatusPayload {
  webcam_publish_status: "idle" | "publishing" | "failed" | "stopped";
  screen_capture_status: "unavailable" | "ready" | "revoked" | "failed";
  webcam_publish_error?: string;
  metadata?: Record<string, unknown>;
}

export interface MediaStatusResponse {
  provider: string;
  room_name: string;
  participant_name: string;
  webcam_publish_status: string;
  screen_capture_status: string;
  webcam_publish_error: string;
  last_publish_at: string | null;
  last_status_at: string | null;
  metadata: Record<string, unknown>;
}

export interface ProctorEventResponse {
  id: number;
  event_type: string;
  severity: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
  case_ids: number[];
}

export interface ProctorEvidenceResponse {
  id: number;
  event: number | null;
  evidence_type: string;
  metadata: Record<string, unknown>;
  captured_at: string;
  file_url: string;
}

export type ConnectedMediaRoom = Room;

const buildLocalMediaServerHint = (serverUrl: string) =>
  `Unable to connect to the local LiveKit media server at ${serverUrl}. Start it with: cd backend; docker compose up -d livekit`;

const normalizeMediaConnectionError = (error: unknown, payload: MediaTokenPayload) => {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown media connection error.");
  const normalized = message.toLowerCase();

  if (
    normalized.includes("could not establish signal connection")
    || normalized.includes("could not establish pc connection")
    || normalized.includes("peer connection")
    || normalized.includes("ice connection")
    || normalized.includes("failed to fetch")
    || normalized.includes("websocket connection")
  ) {
    return new Error(buildLocalMediaServerHint(payload.server_url));
  }

  return error instanceof Error ? error : new Error(message);
};

export async function requestPublishToken(sessionId: number) {
  return apiRequest<MediaTokenPayload>(`/api/v1/proctoring/sessions/${sessionId}/media/publish-token/`, {
    method: "POST",
  });
}

export async function requestViewToken(sessionId: number) {
  return apiRequest<MediaTokenPayload>(`/api/v1/proctoring/sessions/${sessionId}/media/view-token/`, {
    method: "POST",
  });
}

export async function stopViewToken(sessionId: number) {
  return apiRequest<null>(`/api/v1/proctoring/sessions/${sessionId}/media/view-token/`, {
    method: "DELETE",
  });
}

export async function reportMediaStatus(sessionId: number, payload: MediaStatusPayload) {
  return apiRequest<MediaStatusResponse>(`/api/v1/proctoring/sessions/${sessionId}/media/status/`, {
    method: "POST",
    body: payload,
  });
}

export async function recordProctoringEvent(
  sessionId: number,
  payload: {
    event_type: string;
    severity: string;
    metadata: Record<string, unknown>;
  },
) {
  return apiRequest<ProctorEventResponse>(`/api/v1/proctoring/sessions/${sessionId}/events/`, {
    method: "POST",
    body: payload,
  });
}

export async function uploadProctorEvidence(
  sessionId: number,
  eventId: number | null,
  evidenceType: "webcam_snapshot" | "screen_capture",
  file: Blob,
  metadata: Record<string, unknown>,
) {
  const extension = file.type === "image/webp" ? "webp" : file.type === "image/jpeg" ? "jpg" : "png";
  const formData = new FormData();
  if (eventId !== null) {
    formData.set("event_id", String(eventId));
  }
  formData.set("evidence_type", evidenceType);
  formData.set("metadata", JSON.stringify(metadata));
  formData.set(
    "file",
    new File([file], `${evidenceType}.${extension}`, { type: file.type || "application/octet-stream" }),
  );
  return apiRequest<ProctorEvidenceResponse>(`/api/v1/proctoring/sessions/${sessionId}/evidence/`, {
    method: "POST",
    body: formData,
  });
}

export async function connectCandidatePublisher(
  payload: MediaTokenPayload,
  webcamTrack: MediaStreamTrack,
) {
  const room = new Room({ adaptiveStream: false, dynacast: false });
  try {
    await room.connect(payload.server_url, payload.access_token, {
      autoSubscribe: false,
    });
    await room.localParticipant.publishTrack(webcamTrack, {
      source: Track.Source.Camera,
      simulcast: false,
    });
    return room;
  } catch (error) {
    throw normalizeMediaConnectionError(error, payload);
  }
}

export async function connectViewerRoom(payload: MediaTokenPayload) {
  const room = new Room({ adaptiveStream: false, dynacast: false });
  try {
    await room.connect(payload.server_url, payload.access_token, {
      autoSubscribe: true,
    });
    return room;
  } catch (error) {
    throw normalizeMediaConnectionError(error, payload);
  }
}

export async function disconnectRoom(room: ConnectedMediaRoom | null) {
  if (!room) {
    return;
  }
  await room.disconnect();
}
