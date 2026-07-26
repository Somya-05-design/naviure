"use client";

import Image, { type ImageProps } from "next/image";
import { isR2Url } from "@/lib/assets";

/**
 * Production media wrapper.
 *
 * Cloudflare R2 / media.naviure.in assets bypass the Next.js image optimizer:
 * - Local/dev often fails optimizer fetches (TLS / self-signed proxy chains).
 * - Gallery originals are multi‑MB DSLR files — resizing via /_next/image
 *   forces a full download server-side and times out.
 *
 * Browser loads CDN URLs directly (lazy + async decode by default).
 */
type MediaImageProps = Omit<ImageProps, "src"> & {
  src: string;
};

function shouldBypassOptimizer(src: string): boolean {
  if (!src) return false;
  // Already optimized by our sharp proxy — do not re-process.
  if (src.startsWith("/api/media/image")) return true;
  if (isR2Url(src)) return true;
  if (src.startsWith("https://media.naviure.in/")) return true;
  if (src.includes(".r2.dev/")) return true;
  return false;
}

export default function MediaImage({
  src,
  alt,
  loading,
  decoding = "async",
  unoptimized,
  ...rest
}: MediaImageProps) {
  const bypass = shouldBypassOptimizer(src);
  const isPriority = Boolean(rest.priority);

  return (
    <Image
      {...rest}
      src={src}
      alt={alt}
      unoptimized={unoptimized ?? bypass}
      decoding={decoding}
      loading={loading ?? (isPriority ? "eager" : "lazy")}
    />
  );
}
