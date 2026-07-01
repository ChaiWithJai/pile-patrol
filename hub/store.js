// The dispose seam. "Keep" writes the captured image + a sidecar JSON into a
// dated folder under the data root. That root is meant to live inside the user's
// 3-tier backup rotation (Mac → T7 → Drive), so a filed item is genuinely safe
// to discard the moment it lands. Pure path logic is separated from IO so it can
// be tested without touching a real backup folder.

import { promises as fs } from "node:fs";
import path from "node:path";

const EXT_BY_MIME = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

const EXT_BY_AUDIO = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav" };

// Parse a data URL into { buffer, ext }. Throws on anything that isn't an image.
export function parseDataUrl(dataUrl) {
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl ?? ""));
  if (!m) throw new Error("capture is not a base64 image data URL");
  return { buffer: Buffer.from(m[2], "base64"), ext: EXT_BY_MIME[m[1]] ?? "png", mime: m[1] };
}

// Parse an audio data URL (voice note). Returns null for empty/invalid input.
export function parseAudioUrl(dataUrl) {
  const m = /^data:(audio\/[a-z0-9]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl ?? ""));
  if (!m) return null;
  return { buffer: Buffer.from(m[2], "base64"), ext: EXT_BY_AUDIO[m[1]] ?? "webm" };
}

// Deterministic, sortable, collision-resistant destination for a kept item.
// e.g.  <root>/paper/admin/2026/2026-07-01/2026-07-01T14-03-09_ab12cd.png
export function itemPath(root, { mode, category, capturedAt, id, ext }) {
  const d = new Date(capturedAt);
  const iso = d.toISOString();               // 2026-07-01T14:03:09.123Z
  const day = iso.slice(0, 10);              // 2026-07-01
  const year = iso.slice(0, 4);
  const stamp = iso.slice(0, 19).replace(/:/g, "-"); // 2026-07-01T14-03-09
  const safeId = String(id).replace(/[^A-Za-z0-9]/g, "").slice(0, 6) || "item";
  const dir = path.join(root, mode, category, year, day);
  const base = `${stamp}_${safeId}`;
  return { dir, imageFile: path.join(dir, `${base}.${ext}`), sidecarFile: path.join(dir, `${base}.json`), base };
}

// Write the kept item to disk. Returns a backupRef the UI can show/undo.
export async function writeKeep(root, item) {
  const { buffer, ext } = parseDataUrl(item.dataUrl);
  const { dir, imageFile, sidecarFile, base } = itemPath(root, {
    mode: item.mode,
    category: item.category,
    capturedAt: item.capturedAt,
    id: item.id,
    ext,
  });
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(imageFile, buffer);

  // The voice note travels with the item, so the archived paper carries the
  // spoken context that filed it.
  let audioFile = null;
  const audio = parseAudioUrl(item.audioDataUrl);
  if (audio) {
    audioFile = path.join(dir, `${base}.${audio.ext}`);
    await fs.writeFile(audioFile, audio.buffer);
  }

  const sidecar = {
    id: item.id,
    mode: item.mode,
    category: item.category,
    label: item.label ?? "",
    transcript: item.transcript ?? "",
    reason: item.reason ?? "",
    capturedAt: item.capturedAt,
    filedAt: new Date(item.filedAt ?? item.capturedAt).toISOString(),
    image: path.basename(imageFile),
    audio: audioFile ? path.basename(audioFile) : null,
  };
  await fs.writeFile(sidecarFile, JSON.stringify(sidecar, null, 2));
  return { backupRef: base, imageFile, sidecarFile, audioFile, dir };
}

// Undo a keep: remove the image, sidecar, and any voice note. Best-effort.
export async function deleteFiles(files) {
  for (const f of files) {
    if (f) await fs.rm(f, { force: true }).catch(() => {});
  }
}
