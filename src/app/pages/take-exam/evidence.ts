// Anh bang chung vi pham: chup va luu cuc bo (IndexedDB) khi vi pham, chi tai len sau khi nop bai.
import { captureTrackSnapshot, type ProctoringCaptureResources } from "../../lib/proctoringCapture";
import { uploadProctorEvidence, type ProctorEventResponse } from "../../lib/proctoringMedia";
import {
  compressSnapshotForUpload,
  deleteSnapshot,
  getTopViolationSnapshots,
  saveSnapshotLocally,
} from "../../lib/snapshotStore";

const SNAPSHOT_OPTIONS = { maxWidth: 1280, mimeType: "image/jpeg", quality: 0.85 } as const;
const MAX_UPLOADS = 5;

type Severity = "critical" | "warning" | "info";
type Enqueue = <T>(task: () => Promise<T>) => Promise<T>;

/**
 * Chup anh vi pham va LUU VAO LOCAL (IndexedDB) - khong upload ngay.
 * Viec upload duoc thuc hien sau khi nop bai (chi cac snapshot nang nhat).
 */
export const captureViolationEvidence = async (
  sessionId: number,
  captureResources: ProctoringCaptureResources,
  event: ProctorEventResponse,
  message: string,
  severity: Severity,
) => {
  const capturedAt = new Date().toISOString();

  // Chup webcam -> luu local (JPEG chat luong cao, chua nen)
  try {
    const webcamBlob = await captureTrackSnapshot(captureResources.webcamTrack, SNAPSHOT_OPTIONS);
    await saveSnapshotLocally({
      sessionId,
      eventId: event.id,
      evidenceType: "webcam_snapshot",
      severity,
      blob: webcamBlob,
      message,
      capturedAt,
    });
  } catch {
    // Neu khong chup duoc webcam, bo qua (khong de loi nay chan nop bai)
  }

  // Chup man hinh -> luu local
  if (captureResources.screenTrack && captureResources.screenTrack.readyState !== "ended") {
    try {
      const screenBlob = await captureTrackSnapshot(captureResources.screenTrack, SNAPSHOT_OPTIONS);
      await saveSnapshotLocally({
        sessionId,
        eventId: event.id,
        evidenceType: "screen_capture",
        severity,
        blob: screenBlob,
        message,
        capturedAt,
      });
    } catch {
      // Neu khong chup duoc man hinh, bo qua
    }
  }
};

/**
 * Upload cac snapshot vi pham nang nhat len server sau khi nop bai.
 * Moi snapshot duoc nen tu JPEG 0.85 -> WebP 0.6 de giam tai duong truyen;
 * chi xoa ban local khi upload thanh cong de co the tai lai lan sau.
 */
export const uploadPendingSnapshots = async (sessionId: number, enqueue: Enqueue) => {
  let snapshots;
  try {
    snapshots = await getTopViolationSnapshots(sessionId, MAX_UPLOADS);
  } catch {
    // Neu IndexedDB loi, bo qua upload (khong chan nop bai)
    return;
  }

  for (const entry of snapshots) {
    try {
      const compressed = await compressSnapshotForUpload(entry.blob, entry.evidenceType);
      await enqueue(() =>
        uploadProctorEvidence(
          entry.sessionId,
          entry.eventId,
          entry.evidenceType,
          compressed,
          { message: entry.message, compressed: true, original_size: entry.blob.size },
        ),
      );
      if (entry.id !== undefined) {
        await deleteSnapshot(entry.id);
      }
    } catch {
      // Upload that bai (vd. R2 loi): giu snapshot trong IndexedDB de tai lai sau.
    }
  }
};
