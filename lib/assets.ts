/**
 * Website asset registry.
 *
 * Critical UI brand assets (logo, favicon, hero, footer, photographer)
 * resolve to LOCAL public paths for reliability and fast first paint.
 * Large media (intro videos, gallery) resolve to Cloudflare R2.
 *
 * Uses a static JSON import (not Node `fs`) so this module is safe in
 * both Server and Client Components.
 */

import assetsJson from "@/data/assets.json";

export type WebsiteAsset = {
  id: string;
  key: string;
  name: string;
  type: "image" | "video" | "icon" | "other";
  kind: string;
  storageKey: string;
  url: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  etag: string | null;
  checksum: string | null;
  localPath?: string | null;
};

/**
 * Tiny application assets that MUST stay local.
 * Do not fall back to Cloudflare for these — they belong in the repo.
 */
const LOCAL_BRAND_PATHS: Record<string, string> = {
  "logo-white": "/images/logo-white.png",
  "logo-black": "/images/logo-black.png",
  favicon: "/favicon.ico",
  "apple-touch-icon": "/images/logo-white.png",
  "hero-cinematic": "/images/hero-cinematic.jpg",
  "footer-wedding": "/images/footer-wedding.jpg",
  photographer: "/images/photographer.jpg",
  "instagram-qr": "/images/instagram-qr.jpg",
};

/** Optional local paths for large videos (preferred when present). */
const LOCAL_VIDEO_FALLBACKS: Record<string, string> = {
  intro: "/videos/intro.mp4",
  "logo-reveal-intro": "/videos/logo-reveal-intro.mp4",
  "logo-reveal-transition": "/videos/logo-reveal-transition.mp4",
  "logo-reveal": "/videos/logo-reveal.mp4",
};

/** Map historical public paths → asset keys */
const LEGACY_PATH_TO_KEY: Record<string, string> = {
  "/images/logo-white.png": "logo-white",
  "/images/logo-black.png": "logo-black",
  "/images/hero-cinematic.jpg": "hero-cinematic",
  "/images/footer-wedding.jpg": "footer-wedding",
  "/images/photographer.jpg": "photographer",
  "/images/instagram-qr.jpg": "instagram-qr",
  "/videos/intro.mp4": "intro",
  "/videos/logo-reveal-intro.mp4": "logo-reveal-intro",
  "/videos/logo-reveal-transition.mp4": "logo-reveal-transition",
  "/videos/logo-reveal.mp4": "logo-reveal",
  "/favicon.ico": "favicon",
  "/apple-touch-icon.png": "apple-touch-icon",
};

function normalizeAsset(
  a: Partial<WebsiteAsset> & { url: string; storageKey: string; kind?: string }
): WebsiteAsset {
  const filename = a.storageKey.split("/").pop() || "asset";
  const key =
    a.key ||
    filename.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const mime = a.mimeType || "";
  const type: WebsiteAsset["type"] = mime.startsWith("video/")
    ? "video"
    : mime.includes("icon") || a.kind === "icons" || a.kind === "favicons"
      ? "icon"
      : mime.startsWith("image/")
        ? "image"
        : "other";
  return {
    id: a.id || key,
    key,
    name: a.name || key,
    type: a.type || type,
    kind: a.kind || "misc",
    storageKey: a.storageKey,
    url: a.url,
    mimeType: mime || "application/octet-stream",
    fileSize: a.fileSize || 0,
    uploadedAt: a.uploadedAt || "",
    etag: a.etag ?? null,
    checksum: a.checksum ?? null,
    localPath: a.localPath ?? null,
  };
}

const ASSETS: WebsiteAsset[] = (
  assetsJson as Array<Partial<WebsiteAsset> & { url: string; storageKey: string }>
).map((a) => normalizeAsset(a));

const BY_KEY = new Map(ASSETS.map((a) => [a.key, a]));
const BY_STORAGE_KEY = new Map(ASSETS.map((a) => [a.storageKey, a]));

/** No-op kept for script compatibility after rewriting assets.json. */
export function invalidateAssetCache() {
  // Registry is a static import; restart/rebuild picks up JSON changes.
}

export function listWebsiteAssets(): WebsiteAsset[] {
  return [...ASSETS];
}

export function getAsset(key: string): WebsiteAsset | null {
  return BY_KEY.get(key) ?? null;
}

export function isLocalBrandAsset(key: string): boolean {
  return key in LOCAL_BRAND_PATHS;
}

export function getLocalBrandPath(key: string): string | null {
  return LOCAL_BRAND_PATHS[key] ?? null;
}

/**
 * Resolve a stable asset key.
 * Brand UI assets → local public path.
 * Everything else → Cloudflare R2 URL.
 */
export function getAssetUrl(key: string): string {
  const local = LOCAL_BRAND_PATHS[key];
  if (local) return local;

  const asset = getAsset(key);
  if (!asset?.url) {
    throw new Error(
      `Website asset "${key}" not found in data/assets.json. Upload it to Cloudflare R2 first.`
    );
  }
  return asset.url;
}

export function getAssetUrlOrNull(key: string): string | null {
  if (LOCAL_BRAND_PATHS[key]) return LOCAL_BRAND_PATHS[key];
  return getAsset(key)?.url ?? null;
}

/**
 * Intro / background videos: prefer Cloudflare R2 (large files).
 * Returns R2 URL; callers may try a local path first via getLocalVideoFallback.
 */
export function getVideoAssetUrl(key: string): string {
  const asset = getAsset(key);
  if (asset?.url) return asset.url;
  const local = LOCAL_VIDEO_FALLBACKS[key];
  if (local) return local;
  throw new Error(`Video asset "${key}" not found.`);
}

export function getLocalVideoFallback(key: string): string | null {
  return LOCAL_VIDEO_FALLBACKS[key] ?? null;
}

/**
 * Resolve any media reference to a usable URL.
 * Accepts: asset key, @asset:key, legacy /images|/videos|/favicon paths,
 * storageKey, or full https URL.
 */
export function resolveMediaRef(ref: string | null | undefined): string {
  if (!ref || !ref.trim()) return "";
  const value = ref.trim();

  if (
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  if (value.startsWith("@asset:")) {
    return getAssetUrl(value.slice("@asset:".length));
  }

  if (value.startsWith("assets/")) {
    const hit = BY_STORAGE_KEY.get(value);
    if (hit) return hit.url;
    const base =
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;
    if (base) return `${base.replace(/\/$/, "")}/${value}`;
  }

  // Already a local public path for brand assets — keep it local.
  if (
    value.startsWith("/images/") ||
    value === "/favicon.ico" ||
    value.startsWith("/apple-touch")
  ) {
    return value;
  }

  const legacyKey =
    LEGACY_PATH_TO_KEY[value] || LEGACY_PATH_TO_KEY[value.replace(/^\.\//, "/")];
  if (legacyKey) {
    return getAssetUrl(legacyKey);
  }

  const direct = getAssetUrlOrNull(value);
  if (direct) return direct;

  if (value.startsWith("/videos/")) {
    const key = LEGACY_PATH_TO_KEY[value];
    if (key) return getVideoAssetUrl(key);
  }

  return value;
}

export function isR2Url(url: string): boolean {
  if (!url) return false;
  if (url.includes("media.naviure.in/")) return true;
  if (url.includes(".r2.dev/")) return true;
  const base =
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;
  if (base && url.startsWith(base.replace(/\/$/, ""))) return true;
  return false;
}

/** True when URL already uses the production media CDN hostname. */
export function isProductionMediaUrl(url: string): boolean {
  return Boolean(url && url.startsWith("https://media.naviure.in/"));
}
