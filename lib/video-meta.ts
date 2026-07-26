/**
 * Client + shared helpers for video duration and hover-preview coordination.
 *
 * - `formatDuration` turns seconds into a padded `mm:ss` / `h:mm:ss` label.
 * - Duration is read lazily from a card's own (visibility-gated) video element,
 *   so no metadata is fetched for off-screen cards.
 * - The preview coordinator guarantees only one hover preview plays at a time.
 */

/** Frame offset (seconds) used to freeze a real poster frame from the video. */
export const POSTER_FRAME_TIME = 0.1;

/** Format a duration in seconds to a human label. Returns "" for invalid input. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** True when a stored duration value is real (not empty / "0:00"). */
export function isValidDurationLabel(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !/^0+:0+$/.test(trimmed.replace(/^0+(\d)/, "$1"));
}

// ---------------------------------------------------------------------------
// Single-preview coordinator — only one card previews at a time.
// ---------------------------------------------------------------------------

let activeStop: (() => void) | null = null;

/** Claim the single preview slot, stopping any previously playing preview. */
export function acquirePreview(stop: () => void) {
  if (activeStop && activeStop !== stop) activeStop();
  activeStop = stop;
}

/** Release the preview slot if this card currently owns it. */
export function releasePreview(stop: () => void) {
  if (activeStop === stop) activeStop = null;
}
