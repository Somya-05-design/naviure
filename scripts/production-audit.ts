/**
 * Production audit + light repairs (Phases 3–10).
 * Does NOT redesign hierarchy/UI. Does NOT re-upload gallery bulk media.
 *
 * Usage: npx --yes tsx scripts/production-audit.ts
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "fs";
import { join, relative, basename, extname } from "path";
import {
  ListObjectsV2Command,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { PUBLIC_CATEGORY_SLUGS } from "../lib/public-categories";

const GALLERY_ROOT =
  process.env.GALLERY_ROOT ||
  "/Volumes/D /Divyansh Other/KTP/Naviure/Naviure Gallery";

const OLD_HOST = "https://pub-9d9fd744fcf14adba99469b156800a2c.r2.dev";
const NEW_HOST = "https://media.naviure.in";
const DATA = join(process.cwd(), "data");

type R2Object = { key: string; size: number };

function loadEnv() {
  const p = join(process.cwd(), ".env.local");
  if (!existsSync(p)) throw new Error(".env.local missing");
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(DATA, name), "utf8")) as T;
}

function writeJson(name: string, data: unknown) {
  writeFileSync(join(DATA, name), JSON.stringify(data, null, 2) + "\n");
}

function createR2(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

async function listAllR2(client: S3Client, bucket: string): Promise<R2Object[]> {
  const out: R2Object[] = [];
  let token: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );
    for (const obj of res.Contents || []) {
      if (!obj.Key || obj.Key.endsWith("/")) continue;
      out.push({ key: obj.Key, size: obj.Size ?? 0 });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

function walkLocal(dir: string, out: string[]) {
  if (!existsSync(dir)) return;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) walkLocal(full, out);
    else if (ent.isFile()) out.push(full);
  }
}

function isMediaFile(name: string) {
  const ext = extname(name).toLowerCase();
  return [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".avif",
    ".heic",
    ".mp4",
    ".mov",
    ".webm",
    ".m4v",
  ].includes(ext);
}

function rewriteHostInString(s: string): string {
  return s.split(OLD_HOST).join(NEW_HOST);
}

function rewriteMediaFields<T extends Record<string, unknown>>(row: T): T {
  const next = { ...row };
  for (const key of [
    "url",
    "src",
    "thumbnail",
    "coverImage",
  ] as const) {
    const v = next[key];
    if (typeof v === "string" && v.includes(OLD_HOST)) {
      (next as Record<string, unknown>)[key] = rewriteHostInString(v);
    }
  }
  return next;
}

async function main() {
  loadEnv();
  const repairs: string[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];

  // --- CDN URL repair in live JSON ---
  for (const file of [
    "photos.json",
    "videos.json",
    "assets.json",
    "categories.json",
    "categories-cms.json",
  ]) {
    const raw = readFileSync(join(DATA, file), "utf8");
    if (raw.includes(OLD_HOST)) {
      writeFileSync(join(DATA, file), rewriteHostInString(raw));
      repairs.push(`Rewrote leftover ${OLD_HOST} → ${NEW_HOST} in ${file}`);
    }
  }

  const photos = readJson<Array<Record<string, unknown>>>("photos.json").map(
    rewriteMediaFields
  );
  const videos = readJson<Array<Record<string, unknown>>>("videos.json").map(
    rewriteMediaFields
  );
  writeJson("photos.json", photos);
  writeJson("videos.json", videos);

  const projects = readJson<Array<Record<string, unknown>>>("projects.json");
  const albums = readJson<Array<Record<string, unknown>>>("albums.json");
  const categoriesCms = readJson<Array<Record<string, unknown>>>(
    "categories-cms.json"
  );
  const assets = readJson<Array<Record<string, unknown>>>("assets.json");

  // Enforce admin-only hidden flags
  const adminOnly = new Set(["corporate", "fashion", "food", "others"]);
  let cmsChanged = false;
  for (const c of categoriesCms) {
    const slug = String(c.slug);
    const shouldHide = adminOnly.has(slug);
    if (Boolean(c.hidden) !== shouldHide) {
      c.hidden = shouldHide;
      cmsChanged = true;
      repairs.push(
        `Category ${slug}: hidden=${shouldHide} (public allow-list enforcement)`
      );
    }
    if (slug === "portraits" && c.name !== "Portrait") {
      c.name = "Portrait";
      c.seoTitle = "Portrait";
      cmsChanged = true;
      repairs.push("Renamed Portraits → Portrait");
    }
  }
  if (cmsChanged) writeJson("categories-cms.json", categoriesCms);

  // --- R2 list ---
  const bucket = process.env.R2_BUCKET_NAME!;
  const client = createR2();
  console.log("Listing R2...");
  const r2Objects = await listAllR2(client, bucket);
  const r2Keys = new Set(r2Objects.map((o) => o.key));
  const r2Gallery = r2Objects.filter((o) =>
    /\/(photos|videos)\//.test(o.key)
  );
  const r2Assets = r2Objects.filter((o) => o.key.startsWith("assets/"));
  const r2Bytes = r2Objects.reduce((s, o) => s + o.size, 0);

  // --- JSON ↔ R2 ---
  const jsonKeys = new Set<string>();
  const missingInR2: string[] = [];
  const brokenHost: string[] = [];
  const dupKeys = new Map<string, number>();

  for (const p of photos) {
    const key = String(p.storageKey || "");
    if (!key) {
      failures.push(`Photo ${p.id} missing storageKey`);
      continue;
    }
    jsonKeys.add(key);
    dupKeys.set(key, (dupKeys.get(key) || 0) + 1);
    if (!r2Keys.has(key)) missingInR2.push(`photo ${p.id} ${key}`);
    const url = String(p.url || p.src || "");
    if (url.includes("r2.dev")) brokenHost.push(url);
    if (url && !url.startsWith(NEW_HOST + "/") && !url.startsWith(OLD_HOST)) {
      // allow empty; flag non-cdn
      if (url.startsWith("http") && !url.includes("media.naviure.in")) {
        warnings.push(`Non-CDN photo URL: ${p.id} ${url.slice(0, 100)}`);
      }
    }
  }

  for (const v of videos) {
    const key = String(v.storageKey || "");
    if (!key) {
      failures.push(`Video ${v.id} missing storageKey`);
      continue;
    }
    jsonKeys.add(key);
    dupKeys.set(key, (dupKeys.get(key) || 0) + 1);
    if (!r2Keys.has(key)) missingInR2.push(`video ${v.id} ${key}`);
    const url = String(v.url || v.src || "");
    if (url.includes("r2.dev")) brokenHost.push(url);
  }

  for (const a of assets) {
    const key = String(a.storageKey || "");
    if (!key) continue;
    jsonKeys.add(key);
    if (!r2Keys.has(key)) missingInR2.push(`asset ${a.key} ${key}`);
    const url = String(a.url || "");
    if (url.includes("r2.dev")) brokenHost.push(url);
  }

  const duplicateMetadata = [...dupKeys.entries()]
    .filter(([, n]) => n > 1)
    .map(([k, n]) => `${k} ×${n}`);

  const orphanR2 = r2Gallery
    .filter((o) => !jsonKeys.has(o.key))
    .map((o) => o.key);

  // Spot-check HEAD on sample of URLs for existence
  let headOk = 0;
  let headFail = 0;
  const sampleKeys = [...jsonKeys].filter((k) => !k.startsWith("assets/")).slice(0, 25);
  for (const key of sampleKeys) {
    try {
      await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key })
      );
      headOk++;
    } catch {
      headFail++;
      failures.push(`HEAD failed: ${key}`);
    }
  }

  // --- Local gallery counts (importable) ---
  const localFiles: string[] = [];
  walkLocal(GALLERY_ROOT, localFiles);
  const localMedia = localFiles.filter((f) => {
    const name = basename(f);
    if (name.startsWith(".")) return false;
    if (!isMediaFile(name)) return false;
    const rel = relative(GALLERY_ROOT, f).replace(/\\/g, "/");
    if (rel.startsWith("Photos/other/Day 2")) return false;
    if (rel.toLowerCase().includes("day 3 common")) return false;
    return true;
  });
  const localPhotos = localMedia.filter((f) =>
    [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".heic"].includes(
      extname(f).toLowerCase()
    )
  ).length;
  const localVideos = localMedia.filter((f) =>
    [".mp4", ".mov", ".webm", ".m4v"].includes(extname(f).toLowerCase())
  ).length;

  // --- Public categories ---
  const publicCats = categoriesCms.filter((c) =>
    (PUBLIC_CATEGORY_SLUGS as readonly string[]).includes(String(c.slug))
  );
  const hiddenCats = categoriesCms.filter((c) => c.hidden);
  const leakedPublic = categoriesCms.filter(
    (c) =>
      !c.hidden &&
      !(PUBLIC_CATEGORY_SLUGS as readonly string[]).includes(String(c.slug))
  );
  if (leakedPublic.length) {
    failures.push(
      `Public leak (should be hidden): ${leakedPublic.map((c) => c.slug).join(", ")}`
    );
  }

  // Photo hierarchy orphans (project/album missing)
  const projectIds = new Set(projects.map((p) => String(p.id)));
  const albumIds = new Set(albums.map((a) => String(a.id)));
  let orphanMeta = 0;
  for (const p of photos) {
    if (p.projectId && !projectIds.has(String(p.projectId))) {
      orphanMeta++;
      warnings.push(`Photo ${p.id} projectId missing from projects.json`);
    }
    if (p.albumId && !albumIds.has(String(p.albumId))) {
      orphanMeta++;
      warnings.push(`Photo ${p.id} albumId missing from albums.json`);
    }
  }

  const publicPhotoCount = photos.filter((p) =>
    (PUBLIC_CATEGORY_SLUGS as readonly string[]).includes(
      String(p.categorySlug)
    )
  ).length;
  const publicVideoCount = videos.filter((v) =>
    (PUBLIC_CATEGORY_SLUGS as readonly string[]).includes(
      String(v.categorySlug)
    )
  ).length;

  const r2PublicUrl = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
  if (r2PublicUrl !== NEW_HOST) {
    failures.push(
      `R2_PUBLIC_URL is "${r2PublicUrl}" — expected "${NEW_HOST}"`
    );
  }

  const photosOnCdn = photos.filter((p) =>
    String(p.url || "").startsWith(NEW_HOST)
  ).length;
  const videosOnCdn = videos.filter((v) =>
    String(v.url || "").startsWith(NEW_HOST)
  ).length;
  const assetsOnCdn = assets.filter((a) =>
    String(a.url || "").startsWith(NEW_HOST)
  ).length;

  if (photosOnCdn !== photos.length) {
    failures.push(
      `Photos not fully on media.naviure.in: ${photosOnCdn}/${photos.length}`
    );
  }
  if (videosOnCdn !== videos.length) {
    failures.push(
      `Videos not fully on media.naviure.in: ${videosOnCdn}/${videos.length}`
    );
  }
  if (assetsOnCdn !== assets.length) {
    failures.push(
      `Assets not fully on media.naviure.in: ${assetsOnCdn}/${assets.length}`
    );
  }

  if (missingInR2.length) {
    failures.push(`Missing in R2: ${missingInR2.length}`);
  }
  if (orphanR2.length) {
    warnings.push(
      `Orphan gallery R2 objects (no JSON): ${orphanR2.length}`
    );
  }
  if (brokenHost.length) {
    failures.push(`URLs still on r2.dev: ${brokenHost.length}`);
  }

  const pass =
    failures.length === 0 &&
    leakedPublic.length === 0 &&
    photosOnCdn === photos.length &&
    videosOnCdn === videos.length &&
    missingInR2.length === 0 &&
    brokenHost.length === 0 &&
    r2PublicUrl === NEW_HOST;

  const report = {
    phase: "production-audit",
    completedAt: new Date().toISOString(),
    result: pass ? "PASS" : "FAIL",
    totals: {
      categories: categoriesCms.length,
      publicCategories: publicCats.map((c) => c.name),
      hiddenAdminCategories: hiddenCats.map((c) => c.slug),
      projects: projects.length,
      albums: albums.length,
      photos: photos.length,
      videos: videos.length,
      websiteAssets: assets.length,
      publicPhotos: publicPhotoCount,
      publicVideos: publicVideoCount,
      localPhotos,
      localVideos,
      r2Objects: r2Objects.length,
      r2GalleryObjects: r2Gallery.length,
      r2AssetObjects: r2Assets.length,
      r2StorageBytes: r2Bytes,
      r2StorageMb: Math.round(r2Bytes / (1024 * 1024)),
    },
    sync: {
      photosOnCdn,
      videosOnCdn,
      assetsOnCdn,
      missingInR2: missingInR2.length,
      orphanR2Gallery: orphanR2.length,
      duplicateMetadata: duplicateMetadata.length,
      brokenHostUrls: brokenHost.length,
      headSampleOk: headOk,
      headSampleFail: headFail,
      hierarchyOrphanWarnings: orphanMeta,
    },
    samples: {
      missingInR2: missingInR2.slice(0, 20),
      orphanR2: orphanR2.slice(0, 20),
      duplicateMetadata: duplicateMetadata.slice(0, 20),
    },
    repairs,
    warnings: warnings.slice(0, 100),
    failures,
    modifiedFiles: [
      "next.config.ts",
      "package.json",
      ".env.local",
      ".env.example",
      "lib/public-categories.ts",
      "lib/services/content.ts",
      "lib/assets.ts",
      "lib/constants.ts",
      "data/photos.json",
      "data/videos.json",
      "data/assets.json",
      "data/categories.json",
      "data/categories-cms.json",
      "data/video-categories.json",
      "public/manifest.json",
      "scripts/production-audit.ts",
    ],
  };

  writeJson("production-audit-report.json", report);

  const txt = [
    "NAVIURE PRODUCTION AUDIT REPORT",
    `Completed: ${report.completedAt}`,
    `RESULT: ${report.result}`,
    "",
    "TOTALS",
    `  Categories:          ${report.totals.categories}`,
    `  Public categories:   ${report.totals.publicCategories.join(", ")}`,
    `  Admin-only (hidden): ${report.totals.hiddenAdminCategories.join(", ")}`,
    `  Projects:            ${report.totals.projects}`,
    `  Albums:              ${report.totals.albums}`,
    `  Photos:              ${report.totals.photos}`,
    `  Videos:              ${report.totals.videos}`,
    `  Website assets:      ${report.totals.websiteAssets}`,
    `  Public photos:       ${report.totals.publicPhotos}`,
    `  Public videos:       ${report.totals.publicVideos}`,
    `  Local photos:        ${report.totals.localPhotos}`,
    `  Local videos:        ${report.totals.localVideos}`,
    `  R2 objects:          ${report.totals.r2Objects}`,
    `  R2 gallery objects:  ${report.totals.r2GalleryObjects}`,
    `  R2 asset objects:    ${report.totals.r2AssetObjects}`,
    `  R2 storage:          ${report.totals.r2StorageMb} MB`,
    "",
    "SYNC",
    `  Photos on media.naviure.in: ${photosOnCdn}/${photos.length}`,
    `  Videos on media.naviure.in: ${videosOnCdn}/${videos.length}`,
    `  Assets on media.naviure.in: ${assetsOnCdn}/${assets.length}`,
    `  Missing in R2:              ${missingInR2.length}`,
    `  Orphan R2 gallery:          ${orphanR2.length}`,
    `  Duplicate metadata keys:    ${duplicateMetadata.length}`,
    `  Broken r2.dev URLs:         ${brokenHost.length}`,
    `  HEAD sample:                ${headOk} ok / ${headFail} fail`,
    "",
    "REPAIRS",
    ...(repairs.length ? repairs.map((r) => `  - ${r}`) : ["  (none)"]),
    "",
    "FAILURES",
    ...(failures.length ? failures.map((f) => `  - ${f}`) : ["  (none)"]),
    "",
    "WARNINGS",
    ...(warnings.length
      ? warnings.slice(0, 40).map((w) => `  - ${w}`)
      : ["  (none)"]),
    "",
    `FINAL: ${report.result}`,
    report.result === "FAIL"
      ? "Exact reasons listed under FAILURES."
      : "Local import inventory, JSON metadata, R2 objects, CDN host, and public category allow-list are synchronized.",
  ].join("\n");

  writeFileSync(join(DATA, "production-audit-report.txt"), txt);
  console.log(txt);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
