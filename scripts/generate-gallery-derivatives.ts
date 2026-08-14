/**
 * Generate web + thumb derivatives for gallery photos and upload to R2.
 *
 * Convention:
 *   derivatives/thumb/{storageKey without ext}.webp  (~640px)
 *   derivatives/web/{storageKey without ext}.webp    (~1600px)
 *
 * Originals are NEVER deleted.
 *
 * Usage:
 *   npx tsx scripts/generate-gallery-derivatives.ts
 *   npx tsx scripts/generate-gallery-derivatives.ts --limit=50
 *   npx tsx scripts/generate-gallery-derivatives.ts --category=wedding
 */

import { existsSync, readFileSync } from "fs";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { listPhotos, savePhotos } from "../lib/db/photos";
import type { PhotoRecord } from "../lib/db/schema";
import { computeChecksum, getStorage } from "../lib/storage";
import {
  derivativePublicUrl,
  derivativeStorageKey,
} from "../lib/media-urls";

/** Orientation-aware original pixel dimensions (accounts for EXIF rotation). */
async function readDimensions(original: Buffer): Promise<{
  width: number | null;
  height: number | null;
}> {
  try {
    const meta = await sharp(original).metadata();
    let w = meta.width ?? null;
    let h = meta.height ?? null;
    if (meta.orientation && meta.orientation >= 5 && w && h) {
      [w, h] = [h, w];
    }
    return { width: w, height: h };
  } catch {
    return { width: null, height: null };
  }
}

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
const PROGRESS_PATH = path.join(ROOT, "data", "derivative-progress.json");

type Progress = {
  done: Record<
    string,
    {
      thumb: string;
      web: string;
      at: string;
      width?: number | null;
      height?: number | null;
      checksum?: string | null;
    }
  >;
  failed: Array<{ id: string; error: string }>;
};

function parseArgs() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const catArg = process.argv.find((a) => a.startsWith("--category="));
  return {
    limit: limitArg ? Number(limitArg.split("=")[1]) : Infinity,
    category: catArg ? catArg.split("=")[1] : null,
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

async function main() {
  const { limit, category } = parseArgs();
  const storage = getStorage();
  const progress = await loadProgress();

  let photos = await listPhotos({ sort: "oldest" });
  if (category) {
    photos = photos.filter((p) => p.categorySlug === category);
  }

  const pending = photos.filter((p) => !progress.done[p.id]).slice(0, limit);
  console.log(
    `Derivatives: ${pending.length} pending / ${photos.length} total` +
      (category ? ` (category=${category})` : "")
  );

  let processed = 0;
  for (const photo of pending) {
    const key = photo.storageKey;
    if (!key) {
      progress.failed.push({ id: photo.id, error: "missing storageKey" });
      continue;
    }

    try {
      const original = await storage.get(key);
      if (!original) throw new Error(`R2 miss: ${key}`);

      const thumbBuf = await sharp(original)
        .rotate()
        .resize({
          width: 960,
          height: 960,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85, effort: 4 })
        .toBuffer();

      const webBuf = await sharp(original)
        .rotate()
        .resize({
          width: 2048,
          height: 2048,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 88, effort: 4 })
        .toBuffer();

      const thumbKey = derivativeStorageKey(key, "thumb");
      const webKey = derivativeStorageKey(key, "web");

      await storage.upload(thumbBuf, thumbKey, "image/webp");
      await storage.upload(webBuf, webKey, "image/webp");

      const thumbUrl = derivativePublicUrl(key, "thumb");
      const webUrl = derivativePublicUrl(key, "web");

      const dims = await readDimensions(original);
      const checksum = photo.checksum ?? computeChecksum(original);

      progress.done[photo.id] = {
        thumb: thumbUrl,
        web: webUrl,
        at: new Date().toISOString(),
        width: dims.width,
        height: dims.height,
        checksum,
      };

      photo.thumbnail = thumbUrl;
      if (dims.width) photo.width = dims.width;
      if (dims.height) photo.height = dims.height;
      if (!photo.checksum) photo.checksum = checksum;
      photo.updatedAt = new Date().toISOString();

      processed++;
      if (processed % 10 === 0) {
        await saveProgress(progress);
        console.log(`  … ${processed}/${pending.length}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      progress.failed.push({ id: photo.id, error: message });
      console.error(`FAIL ${photo.id}: ${message}`);
    }
  }

  await saveProgress(progress);

  const all = await listPhotos();
  const byId = new Map(all.map((p) => [p.id, p]));
  for (const [id, urls] of Object.entries(progress.done)) {
    const row = byId.get(id);
    if (row) {
      row.thumbnail = urls.thumb;
      if (urls.width) row.width = urls.width;
      if (urls.height) row.height = urls.height;
      if (urls.checksum && !row.checksum) row.checksum = urls.checksum;
      row.updatedAt = urls.at;
    }
  }
  await savePhotos([...byId.values()] as PhotoRecord[]);

  console.log(
    JSON.stringify(
      {
        processed,
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
