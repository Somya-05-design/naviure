import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getStorage } from "@/lib/storage";
import {
  derivativePublicUrl,
  derivativeStorageKey,
  storageKeyFromMediaUrl,
} from "@/lib/media-urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WIDTH = 2560;
const DEFAULT_WIDTH = 960;
const DEFAULT_QUALITY = 85;
const CACHE_CONTROL =
  "public, max-age=31536000, immutable, stale-while-revalidate=86400";

function clampWidth(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_WIDTH;
  return Math.min(Math.round(n), MAX_WIDTH);
}

function clampQuality(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_QUALITY;
  return Math.min(Math.max(Math.round(n), 40), 95);
}

function variantForWidth(w: number): "thumb" | "web" {
  return w <= 640 ? "thumb" : "web";
}

async function fetchBufferFromR2(key: string): Promise<Buffer | null> {
  try {
    const storage = getStorage();
    return await storage.get(key);
  } catch {
    return null;
  }
}

async function fetchBufferFromUrl(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "image/*" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * On-demand gallery image optimizer.
 *
 * Prefer baked R2 derivatives when present; otherwise resize the original
 * via sharp (fetched through the R2 S3 API — no Cloudflare Image Resizing required).
 *
 * Query:
 *   ?key=wedding/.../photo.jpg&w=640&q=75
 *   ?url=https://media.naviure.in/...&w=1600
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const keyParam = searchParams.get("key");
  const urlParam = searchParams.get("url");
  const width = clampWidth(searchParams.get("w"));
  const quality = clampQuality(searchParams.get("q"));
  const variant = variantForWidth(width);

  let storageKey = keyParam?.trim() || null;
  if (!storageKey && urlParam) {
    storageKey = storageKeyFromMediaUrl(urlParam);
  }

  if (!storageKey && !urlParam) {
    return NextResponse.json(
      { error: "Missing key or url parameter" },
      { status: 400 }
    );
  }

  // 1) Prefer pre-generated derivative on R2
  if (storageKey) {
    const derivKey = derivativeStorageKey(storageKey, variant);
    const baked = await fetchBufferFromR2(derivKey);
    if (baked && baked.length > 0) {
      return new NextResponse(new Uint8Array(baked), {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": CACHE_CONTROL,
          "X-Naviure-Media": "derivative",
          "X-Naviure-Key": derivKey,
        },
      });
    }

    // Also try public CDN HEAD path via fetch (in case SDK miss)
    const publicDeriv = derivativePublicUrl(storageKey, variant);
    const cdnDeriv = await fetchBufferFromUrl(publicDeriv);
    if (cdnDeriv && cdnDeriv.length > 0) {
      return new NextResponse(new Uint8Array(cdnDeriv), {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": CACHE_CONTROL,
          "X-Naviure-Media": "derivative-cdn",
        },
      });
    }
  }

  // 2) Load original and resize
  let original: Buffer | null = null;
  if (storageKey) {
    original = await fetchBufferFromR2(storageKey);
  }
  if (!original && urlParam) {
    original = await fetchBufferFromUrl(urlParam);
  }
  if (!original && storageKey) {
    original = await fetchBufferFromUrl(
      `https://media.naviure.in/${storageKey}`
    );
  }

  if (!original || original.length === 0) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  try {
    const optimized = await sharp(original)
      .rotate()
      .resize({
        width,
        height: width,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toBuffer();

    return new NextResponse(new Uint8Array(optimized), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": CACHE_CONTROL,
        "X-Naviure-Media": "resized",
        "X-Naviure-Width": String(width),
      },
    });
  } catch (error) {
    console.error("[api/media/image] sharp failed", error);
    // Last resort: stream original bytes (still better than broken UI)
    return new NextResponse(new Uint8Array(original), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600",
        "X-Naviure-Media": "original-fallback",
      },
    });
  }
}
