import { NextRequest, NextResponse } from "next/server";
import {
  derivativePublicUrl,
  storageKeyFromMediaUrl,
} from "@/lib/media-urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function variantForWidth(raw: string | null): "thumb" | "web" {
  const w = Number(raw);
  return Number.isFinite(w) && w <= 640 ? "thumb" : "web";
}

/**
 * Image redirect fallback.
 * Directs traffic directly to Cloudflare CDN derivatives to prevent
 * serverless memory exhaustion, cold starts, and native module crashes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const keyParam = searchParams.get("key");
  const urlParam = searchParams.get("url");
  const variant = variantForWidth(searchParams.get("w"));

  let storageKey = keyParam?.trim() || null;
  if (!storageKey && urlParam) {
    storageKey = storageKeyFromMediaUrl(urlParam);
  }

  if (storageKey) {
    const cleanKey = storageKey.replace(/^\/+/, "");
    if (cleanKey.startsWith("assets/")) {
      return NextResponse.redirect(`https://media.naviure.in/${cleanKey}`, {
        status: 307,
      });
    }
    const publicDeriv = derivativePublicUrl(storageKey, variant);
    return NextResponse.redirect(publicDeriv, { status: 307 });
  }

  if (urlParam) {
    return NextResponse.redirect(urlParam, { status: 307 });
  }

  return NextResponse.json(
    { error: "Missing key or url parameter" },
    { status: 400 }
  );
}
