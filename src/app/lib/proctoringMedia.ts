import { Room, Track } from "livekit-client";

import { apiRequest } from "./http";
import { getStoredTokens } from "./storage";

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
  const fileName = `${evidenceType}.${extension}`;
  const contentType = file.type || "application/octet-stream";

  // 1. Xin Presigned URL tu backend
  const presignedRes = await apiRequest<{ upload_url: string; object_key: string }>(
    `/api/v1/proctoring/sessions/${sessionId}/evidence/presigned-url/`,
    {
      method: "POST",
      body: {
        evidence_type: evidenceType,
        file_name: fileName,
        content_type: contentType,
      },
    }
  );

  const { upload_url, object_key } = presignedRes;

  // 2. Put file trực tiếp lên R2/S3 (hoặc mock upload endpoint)
  const isMock = upload_url.includes("mock-upload");
  const headers: Record<string, string> = {
    "Content-Type": contentType,
  };
  if (isMock) {
    const tokens = getStoredTokens();
    if (tokens?.access) {
      headers["Authorization"] = `Bearer ${tokens.access}`;
    }
  }

  const uploadRes = await fetch(upload_url, {
    method: "PUT",
    headers,
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`Evidence upload failed with status ${uploadRes.status}`);
  }

  // 3. Confirm tải lên thành công để backend tạo bản ghi DB
  return apiRequest<ProctorEvidenceResponse>(
    `/api/v1/proctoring/sessions/${sessionId}/evidence/confirm/`,
    {
      method: "POST",
      body: {
        event_id: eventId,
        evidence_type: evidenceType,
        object_key: object_key,
        metadata: metadata,
      },
    }
  );
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
