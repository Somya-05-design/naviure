/** Client-side playback preferences — no backend required. */

const VOLUME_KEY = "naviure:video-player:volume";
const RATE_KEY = "naviure:video-player:rate";
const POSITION_PREFIX = "naviure:video-player:pos:";
const RECENT_KEY = "naviure:video-player:recent";

function readNumber(key: string, fallback: number, min: number, max: number) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  } catch {
    return fallback;
  }
}

function writeNumber(key: string, value: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* quota / private mode */
  }
}

export function loadPlayerVolume(): number {
  return readNumber(VOLUME_KEY, 1, 0, 1);
}

export function savePlayerVolume(value: number) {
  writeNumber(VOLUME_KEY, value);
}

export function loadPlayerRate(): number {
  return readNumber(RATE_KEY, 1, 0.25, 2);
}

export function savePlayerRate(value: number) {
  writeNumber(RATE_KEY, value);
}

export function loadPlaybackPosition(videoId: string): number {
  return readNumber(`${POSITION_PREFIX}${videoId}`, 0, 0, Number.MAX_SAFE_INTEGER);
}

export function savePlaybackPosition(videoId: string, seconds: number) {
  if (seconds < 2) return;
  writeNumber(`${POSITION_PREFIX}${videoId}`, Math.floor(seconds));
}

export function clearPlaybackPosition(videoId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${POSITION_PREFIX}${videoId}`);
  } catch {
    /* ignore */
  }
}

export function pushRecentlyViewed(videoId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [videoId, ...list.filter((id) => id !== videoId)].slice(0, 24);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
