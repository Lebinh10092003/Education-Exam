/**
 * snapshotStore.ts
 *
 * Quan ly viec luu snapshot vi pham vao IndexedDB truoc khi upload len server.
 * Luong: Chup anh -> Luu local (JPEG 0.85) -> Khi nop bai: lay top-3 -> Nen WebP 0.6 -> Upload -> Xoa local
 *
 * Uu diem:
 * - Giam tai server: khong upload ngay lap tuc
 * - Chi giu lai 3 bang chung quan trong nhat (severity cao nhat)
 * - Nen anh truoc khi upload giam ~60-70% dung luong
 * - Ban goc chat luong cao van giu trong IndexedDB (co the xuat ra neu can)
 */

const DB_NAME = "eduexam-snapshots";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";

/** Diem uu tien cua tung muc severity (cao hon = quan trong hon) */
const SEVERITY_SCORE: Record<string, number> = {
  critical: 100,
  warning: 50,
  info: 10,
};

export interface SnapshotEntry {
  /** ID tu dong tang (IndexedDB) */
  id?: number;
  sessionId: number;
  eventId: number | null;
  /** Loai anh: webcam hoac man hinh */
  evidenceType: "webcam_snapshot" | "screen_capture";
  /** Muc do nghiem trong cua vi pham lien quan */
  severity: "critical" | "warning" | "info";
  /** Blob JPEG goc chat luong cao */
  blob: Blob;
  /** Thong tin kem theo */
  message: string;
  capturedAt: string;
}

// ────────────────────────────────────────────────────────────
// Mo ket noi IndexedDB
// ────────────────────────────────────────────────────────────

let _dbPromise: Promise<IDBDatabase> | null = null;

function openSnapshotDb(): Promise<IDBDatabase> {
  if (_dbPromise) {
    return _dbPromise;
  }

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        // Index de query theo sessionId nhanh
        store.createIndex("sessionId", "sessionId", { unique: false });
        store.createIndex("sessionId_severity", ["sessionId", "severity"], {
          unique: false,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      _dbPromise = null;
      reject(request.error);
    };
  });

  return _dbPromise;
}

// ────────────────────────────────────────────────────────────
// Luu snapshot vao IndexedDB
// ────────────────────────────────────────────────────────────

/**
 * Luu mot snapshot vao local IndexedDB.
 * Goi ngay sau khi chup anh, TRUOC khi upload len server.
 */
export async function saveSnapshotLocally(entry: Omit<SnapshotEntry, "id">): Promise<number> {
  const db = await openSnapshotDb();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(entry);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

// ────────────────────────────────────────────────────────────
// Lay top-N snapshot theo severity de upload
// ────────────────────────────────────────────────────────────

/**
 * Lay top `maxCount` snapshot cua mot session, sap xep theo severity giam dan.
 * Moi cap (eventId + evidenceType) chi lay 1 snapshot de tranh trung lap.
 */
export async function getTopViolationSnapshots(
  sessionId: number,
  maxCount = 3,
): Promise<SnapshotEntry[]> {
  const db = await openSnapshotDb();

  const allEntries = await new Promise<SnapshotEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("sessionId");
    const req = index.getAll(IDBKeyRange.only(sessionId));
    req.onsuccess = () => resolve(req.result as SnapshotEntry[]);
    req.onerror = () => reject(req.error);
  });

  // Sap xep: critical > warning > info, trong moi muc theo thoi gian
  allEntries.sort((a, b) => {
    const scoreDiff = (SEVERITY_SCORE[b.severity] ?? 0) - (SEVERITY_SCORE[a.severity] ?? 0);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    // Cung severity -> uu tien ban ghi moi nhat
    return b.capturedAt.localeCompare(a.capturedAt);
  });

  // De-duplicate theo eventId (giu 1 webcam + 1 screen toi da cho moi event)
  const seen = new Set<string>();
  const deduped: SnapshotEntry[] = [];
  for (const entry of allEntries) {
    const key = `${entry.eventId ?? "null"}_${entry.evidenceType}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(entry);
    }
    if (deduped.length >= maxCount) {
      break;
    }
  }

  return deduped;
}

// ────────────────────────────────────────────────────────────
// Don dep sau khi upload
// ────────────────────────────────────────────────────────────

/** Xoa toan bo snapshot cua mot session sau khi da upload thanh cong */
export async function clearSessionSnapshots(sessionId: number): Promise<void> {
  const db = await openSnapshotDb();

  const ids = await new Promise<number[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("sessionId");
    const req = index.getAllKeys(IDBKeyRange.only(sessionId));
    req.onsuccess = () => resolve(req.result as number[]);
    req.onerror = () => reject(req.error);
  });

  if (ids.length === 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    let pending = ids.length;
    const done = () => {
      pending--;
      if (pending === 0) {
        resolve();
      }
    };
    for (const id of ids) {
      const req = store.delete(id);
      req.onsuccess = done;
      req.onerror = () => reject(req.error);
    }
  });
}

// ────────────────────────────────────────────────────────────
// Nen anh truoc khi upload
// ────────────────────────────────────────────────────────────

/**
 * Nen mot Blob anh sang WebP de giam dung luong upload.
 * - Ban goc JPEG 0.85 giu trong IndexedDB (xem duoc, chat luong cao)
 * - Ban nen WebP 0.60 duoc upload len server (nhe hon ~60-70%)
 *
 * Neu trinh duyet khong ho tro WebP, fallback sang JPEG 0.70.
 */
export async function compressSnapshotForUpload(blob: Blob): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback: tra ve blob goc neu khong ve duoc canvas
        resolve(blob);
        return;
      }
      ctx.drawImage(img, 0, 0);

      // Thu WebP truoc, neu khong ho tro thi dung JPEG chat luong thap hon
      canvas.toBlob(
        (webpBlob) => {
          if (webpBlob && webpBlob.size > 0) {
            resolve(webpBlob);
          } else {
            // Fallback: JPEG quality 0.70
            canvas.toBlob(
              (jpegBlob) => {
                resolve(jpegBlob ?? blob);
              },
              "image/jpeg",
              0.7,
            );
          }
        },
        "image/webp",
        0.6,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load snapshot image for compression."));
    };

    img.src = url;
  });
}

// ────────────────────────────────────────────────────────────
// Helper: dem so luong snapshot cua 1 session (de UI hien thi)
// ────────────────────────────────────────────────────────────

export async function countSessionSnapshots(sessionId: number): Promise<number> {
  const db = await openSnapshotDb();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("sessionId");
    const req = index.count(IDBKeyRange.only(sessionId));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
