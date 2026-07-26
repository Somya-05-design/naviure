/**
 * Backfill video metadata + poster thumbnails and upload them to R2.
 *
 * For every video record that is missing a duration / poster, this script:
 *   1. Downloads the original from R2 (via the storage adapter).
 *   2. Probes duration + dimensions with ffprobe.
 *   3. Extracts a mid / ~1s frame with ffmpeg and encodes it as JPEG
 *      (mjpeg — available on standard Homebrew FFmpeg; no WebP required).
 *   4. Uploads the poster to derivatives/video-thumbs/{key}.jpg on R2.
 *   5. Writes duration, width, height, orientation, poster + thumbnail back
 *      into data/videos.json.
 *
 * Originals are NEVER modified or deleted. Progress is checkpointed so the
 * script is safely resumable.
 *
 * Requirements: ffmpeg + ffprobe available on PATH (Homebrew default is fine).
 *
 * Usage:
 *   npx tsx scripts/generate-video-derivatives.ts
 *   npx tsx scripts/generate-video-derivatives.ts --limit=20
 *   npx tsx scripts/generate-video-derivatives.ts --category=wedding
 *   npx tsx scripts/generate-video-derivatives.ts --force
 */

import { execFile } from "child_process";
import { existsSync, readFileSync } from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { listVideos, saveVideos } from "../lib/db/videos";
import type { VideoRecord } from "../lib/db/schema";
import { computeChecksum, getStorage } from "../lib/storage";
import { formatDuration } from "../lib/video-meta";
import { videoThumbPublicUrl, videoThumbStorageKey } from "../lib/media-urls";

const run = promisify(execFile);

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const ROOT = process.cwd();
const PROGRESS_PATH = path.join(ROOT, "data", "video-derivative-progress.json");

type Progress = {
  done: Record<string, { poster: string; at: string }>;
  failed: Array<{ id: string; error: string }>;
};

function parseArgs() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const catArg = process.argv.find((a) => a.startsWith("--category="));
  return {
    limit: limitArg ? Number(limitArg.split("=")[1]) : Infinity,
    category: catArg ? catArg.split("=")[1] : null,
    force: process.argv.includes("--force"),
  };
}

async function loadProgress(): Promise<Progress> {
  try {
    return JSON.parse(await fs.readFile(PROGRESS_PATH, "utf8"));
  } catch {
    return { done: {}, failed: [] };
  }
}

async function saveProgress(p: Progress) {
  await fs.mkdir(path.dirname(PROGRESS_PATH), { recursive: true });
  await fs.writeFile(PROGRESS_PATH, JSON.stringify(p, null, 2));
}

async function ensureFfmpeg() {
  try {
    await run("ffmpeg", ["-version"]);
    await run("ffprobe", ["-version"]);
  } catch {
    throw new Error(
      "ffmpeg / ffprobe not found on PATH. Install ffmpeg (e.g. `brew install ffmpeg` " +
        "or `apt-get install ffmpeg`) and re-run this script."
    );
  }
}

async function probe(file: string): Promise<{
  duration: number | null;
  width: number | null;
  height: number | null;
}> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const data = JSON.parse(stdout);
  const stream = (data.streams || []).find(
    (s: { codec_type?: string }) => s.codec_type === "video"
  );
  const duration =
    Number(data.format?.duration) || Number(stream?.duration) || null;
  return {
    duration: duration && Number.isFinite(duration) ? duration : null,
    width: stream?.width ?? null,
    height: stream?.height ?? null,
  };
}

async function extractPoster(
  file: string,
  outFile: string,
  duration: number | null
) {
  const seek = duration && duration > 2 ? Math.min(duration / 2, duration - 0.5) : 1;
  // JPEG via mjpeg — portable across Homebrew FFmpeg (no libwebp required).
  // -q:v 2 ≈ high quality; -update 1 writes a single image on FFmpeg 8+.
  await run("ffmpeg", [
    "-ss",
    seek.toFixed(2),
    "-i",
    file,
    "-frames:v",
    "1",
    "-vf",
    "scale='min(1280,iw)':-2",
    "-c:v",
    "mjpeg",
    "-q:v",
    "2",
    "-update",
    "1",
    "-y",
    outFile,
  ]);
}

function deriveOrientation(
  w: number | null,
  h: number | null
): VideoRecord["orientation"] {
  if (!w || !h) return null;
  if (w > h) return "landscape";
  if (h > w) return "portrait";
  return "square";
}

async function main() {
  const { limit, category, force } = parseArgs();
  await ensureFfmpeg();

  const storage = getStorage();
  const progress = await loadProgress();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "naviure-vid-"));

  let videos = await listVideos({ sort: "oldest" });
  if (category) videos = videos.filter((v) => v.categorySlug === category);

  const pending = videos
    .filter((v) => {
      if (!v.storageKey) return false;
      if (force) return true;
      const hasMeta = Boolean(v.duration) && Boolean(v.poster);
      return !hasMeta && !progress.done[v.id];
    })
    .slice(0, limit);

  console.log(
    `Video derivatives: ${pending.length} pending / ${videos.length} total` +
      (category ? ` (category=${category})` : "")
  );

  const updates = new Map<
    string,
    Partial<VideoRecord>
  >();
  let processed = 0;

  for (const video of pending) {
    const key = video.storageKey!;
    const localInput = path.join(tmpDir, `in-${video.id}${path.extname(key) || ".mp4"}`);
    const localPoster = path.join(tmpDir, `poster-${video.id}.jpg`);

    try {
      const buffer = await storage.get(key);
      if (!buffer) throw new Error(`R2 miss: ${key}`);
      await fs.writeFile(localInput, buffer);

      const meta = await probe(localInput);
      await extractPoster(localInput, localPoster, meta.duration);

      const posterBuf = await fs.readFile(localPoster);
      const posterKey = videoThumbStorageKey(key, "jpg");
      await storage.upload(posterBuf, posterKey, "image/jpeg");
      const posterUrl = videoThumbPublicUrl(key, "jpg");

      const durationLabel = formatDuration(meta.duration);
      updates.set(video.id, {
        duration: durationLabel || video.duration,
        width: meta.width,
        height: meta.height,
        orientation: deriveOrientation(meta.width, meta.height),
        resolution:
          meta.width && meta.height ? `${meta.width}x${meta.height}` : video.resolution,
        poster: posterUrl,
        thumbnail: posterUrl,
        checksum: video.checksum ?? computeChecksum(buffer),
      });

      progress.done[video.id] = { poster: posterUrl, at: new Date().toISOString() };
      processed++;
      console.log(
        `  ✓ ${video.title} — ${durationLabel || "?"} ${meta.width}x${meta.height}`
      );

      if (processed % 5 === 0) await saveProgress(progress);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      progress.failed.push({ id: video.id, error: message });
      console.error(`  ✗ ${video.title}: ${message}`);
    } finally {
      await fs.rm(localInput, { force: true });
      await fs.rm(localPoster, { force: true });
    }
  }

  await saveProgress(progress);

  if (updates.size > 0) {
    const all = await listVideos();
    const merged = all.map((v) =>
      updates.has(v.id)
        ? { ...v, ...updates.get(v.id)!, updatedAt: new Date().toISOString() }
        : v
    );
    await saveVideos(merged);
  }

  await fs.rm(tmpDir, { recursive: true, force: true });

  console.log(
    JSON.stringify(
      {
        processed,
        updated: updates.size,
        doneTotal: Object.keys(progress.done).length,
        failed: progress.failed.length,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
