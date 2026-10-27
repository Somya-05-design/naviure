/**
 * Gallery media URL helpers — original / web / thumb variants on R2.
 *
 * Path convention (does not alter original keys):
 *   original:  {category}/.../photos/{file}.jpg
 *   web:       derivatives/web/{storageKey}.webp     (max ~1600px)
 *   thumb:     derivatives/thumb/{storageKey}.webp   (max ~640px)
 *
 * Until derivatives exist, getGalleryDisplayUrl falls back to the
 * on-demand sharp proxy at /api/media/image.
 */

const MEDIA_HOST = "https://media.naviure.in";

export type GalleryImageVariant = "original" | "web" | "thumb";

export function storageKeyFromMediaUrl(url: string): string | null {
  if (!url) return null;
  try {
    if (url.startsWith("https://media.naviure.in/")) {
      return decodeURIComponent(url.slice("https://media.naviure.in/".length));
    }
    if (url.includes(".r2.dev/")) {
      const idx = url.indexOf(".r2.dev/");
      return decodeURIComponent(url.slice(idx + ".r2.dev/".length));
    }
    const base = (
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
      process.env.R2_PUBLIC_URL ||
      ""
    ).replace(/\/$/, "");
    if (base && url.startsWith(base + "/")) {
      return decodeURIComponent(url.slice(base.length + 1));
    }
  } catch {
    return null;
  }
  return null;
}

export function derivativeStorageKey(
  storageKey: string,
  variant: "web" | "thumb"
): string {
  const clean = storageKey.replace(/^\/+/, "");
  // Keep extension-stripped key so .webp can replace .jpg/.jpeg/.png
  const withoutExt = clean.replace(/\.[^.]+$/, "");
  return `derivatives/${variant}/${withoutExt}.webp`;
}

export function derivativePublicUrl(
  storageKey: string,
  variant: "web" | "thumb"
): string {
  return `${MEDIA_HOST}/${derivativeStorageKey(storageKey, variant)}`;
}

export type VideoThumbExt = "jpg" | "webp";

/**
 * Storage key for a generated video poster/thumbnail.
 *   derivatives/video-thumbs/{storageKey without ext}.jpg   (default — Homebrew FFmpeg)
 *   derivatives/video-thumbs/{storageKey without ext}.webp  (legacy)
 *
 * New posters are always JPEG. WebP keys remain supported for backward
 * compatibility with posters generated before the portable pipeline.
 */
export function videoThumbStorageKey(
  storageKey: string,
  ext: VideoThumbExt = "jpg"
): string {
  const clean = storageKey.replace(/^\/+/, "");
  const withoutExt = clean.replace(/\.[^.]+$/, "");
  return `derivatives/video-thumbs/${withoutExt}.${ext}`;
}

export function videoThumbPublicUrl(
  storageKey: string,
  ext: VideoThumbExt = "jpg"
): string {
  return `${MEDIA_HOST}/${videoThumbStorageKey(storageKey, ext)}`;
}

/**
 * Prefer an existing stored poster URL. Otherwise return the JPEG path
 * (with the legacy WebP path available as a secondary candidate).
 */
export function resolveVideoPosterUrl(
  storageKey: string | null | undefined,
  storedPoster?: string | null
): string | null {
  if (storedPoster) return storedPoster;
  if (!storageKey) return null;
  return videoThumbPublicUrl(storageKey, "jpg");
}

/** Legacy WebP public URL — used only when falling back from a missing JPEG. */
export function videoThumbLegacyWebpUrl(storageKey: string): string {
  return videoThumbPublicUrl(storageKey, "webp");
}

/** Width targets for the on-demand image proxy. */
export const GALLERY_THUMB_WIDTH = 960;
export const GALLERY_WEB_WIDTH = 2048;

/**
 * Display URL for gallery grids (thumbnails).
 * Uses baked R2 WebP derivative (~960px) directly from Cloudflare CDN.
 */
export function getGalleryThumbUrl(
  src: string,
  thumbnail?: string | null
): string {
  if (thumbnail && thumbnail.includes("/derivatives/thumb/")) {
    return thumbnail;
  }
  if (thumbnail && thumbnail.includes("/derivatives/web/")) {
    return thumbnail.replace("/derivatives/web/", "/derivatives/thumb/");
  }
  if (thumbnail) {
    const thumbKey = storageKeyFromMediaUrl(thumbnail);
    if (thumbKey && !thumbKey.startsWith("assets/")) {
      return derivativePublicUrl(thumbKey, "thumb");
    }
    if (thumbnail.startsWith("http://") || thumbnail.startsWith("https://")) {
      return thumbnail;
    }
  }

  const key = storageKeyFromMediaUrl(src);
  if (key) {
    if (key.startsWith("assets/")) {
      return src.startsWith("http") ? src : `${MEDIA_HOST}/${key}`;
    }
    return derivativePublicUrl(key, "thumb");
  }

  return thumbnail || src;
}

/**
 * Optimized URL for mid-size featured views (~2048px web size, not original).
 * Uses baked R2 WebP derivative directly from Cloudflare CDN.
 * Photo lightbox uses getGalleryOriginalUrl — do not swap that to web.
 */
export function getGalleryWebUrl(src: string): string {
  if (src.includes("/derivatives/web/")) return src;
  if (src.includes("/derivatives/thumb/")) {
    return src.replace("/derivatives/thumb/", "/derivatives/web/");
  }

  const key = storageKeyFromMediaUrl(src);
  if (key) {
    if (key.startsWith("assets/")) {
      return src.startsWith("http") ? src : `${MEDIA_HOST}/${key}`;
    }
    return derivativePublicUrl(key, "web");
  }

  return src;
}

/**
 * Smart display URL resolution based on container span / screen footprint.
 * Wide or featured items receive the 2048px Web variant; normal grid items receive 960px.
 */
export function getGalleryDisplayUrl(
  src: string,
  thumbnail?: string | null,
  isFeaturedOrWide: boolean = false
): string {
  if (isFeaturedOrWide) {
    return getGalleryWebUrl(thumbnail || src);
  }
  return getGalleryThumbUrl(src, thumbnail);
}

/** Original CDN URL — photo lightbox, downloads, admin, archives. */
export function getGalleryOriginalUrl(src: string): string {
  return src;
}
