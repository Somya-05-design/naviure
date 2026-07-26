"use client";

import { useEffect, useRef, useState } from "react";
import MediaImage from "@/components/ui/MediaImage";
import { cn, prefersReducedMotion } from "@/lib/utils";
import {
  acquirePreview,
  formatDuration,
  POSTER_FRAME_TIME,
  releasePreview,
} from "@/lib/video-meta";
import type { GalleryVideo } from "@/types";

const HOVER_DELAY_MS = 250;

/** Soft cinematic grade — center stays sharp; edges handled by masked overlay. */
const MEDIA_GRADE =
  "contrast-[1.06] saturate-[1.04] brightness-[0.97]";

const EDGE_MASK =
  "radial-gradient(ellipse 58% 55% at 50% 42%, transparent 38%, rgba(0,0,0,0.55) 72%, black 100%)";

interface VideoThumbProps {
  video: GalleryVideo;
  /** Force preview playback even without hover (auto-rotating showcase). */
  active?: boolean;
  /** Extra classes applied to the media layers (e.g. hover scale). */
  className?: string;
  /** `sizes` hint for the poster image, when an admin poster exists. */
  sizes?: string;
  /** Called once real duration is known (from stored value or metadata). */
  onDuration?: (label: string) => void;
}

/**
 * Premium video card backdrop.
 *
 * Renders a real poster (admin poster image, or a frozen frame from the video
 * itself — never a solid black rectangle) behind a lazily-mounted, muted,
 * looping hover preview. Only one preview plays at a time across the page, and
 * off-screen previews are fully unloaded to avoid memory leaks.
 *
 * Hover preview logic (IO, single-preview coordinator, delay) is unchanged;
 * this layer only adds cinematic grading, depth, and smoother fades.
 */
export default function VideoThumb({
  video,
  active = false,
  className,
  sizes = "(max-width: 768px) 100vw, 50vw",
  onDuration,
}: VideoThumbProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState("");
  const [posterState, setPosterState] = useState({
    key: video.poster || "",
    src: video.poster || "",
  });

  const hasPosterImage = Boolean(video.poster);
  // Render-phase reset: swap back to the stored poster when the video changes,
  // so the WebP→JPEG onError fallback below stays scoped to the current card.
  if (posterState.key !== (video.poster || "")) {
    setPosterState({ key: video.poster || "", src: video.poster || "" });
  }
  const posterSrc = posterState.src;
  const posterReady = Boolean(posterSrc) && loadedSrc === posterSrc;
  const previewing = inView && (hovered || active);
  const showPreview = Boolean(previewing && ready && hasPosterImage);
  const reduceMotion =
    typeof window !== "undefined" ? prefersReducedMotion() : false;

  // Lazily mount / unmount the video source based on viewport visibility.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        // Off-screen: the <video> unmounts (freeing memory); reset readiness.
        if (!entry.isIntersecting) setReady(false);
      },
      { rootMargin: "300px 0px", threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Drive playback and enforce the single-preview rule.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !inView) return;

    if (previewing && ready && !prefersReducedMotion()) {
      const stop = () => {
        el.pause();
        try {
          el.currentTime = POSTER_FRAME_TIME;
        } catch {
          /* seeking before metadata — ignore */
        }
      };
      acquirePreview(stop);
      el.play().catch(() => {});
      return () => releasePreview(stop);
    }

    el.pause();
    try {
      el.currentTime = POSTER_FRAME_TIME;
    } catch {
      /* ignore */
    }
  }, [previewing, ready, inView]);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  const handleEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(true), HOVER_DELAY_MS);
  };

  const handleLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHovered(false);
  };

  const handleMetadata = () => {
    const el = videoRef.current;
    if (!el) return;
    const label = formatDuration(el.duration);
    if (label) onDuration?.(label);
    if (!previewing) {
      try {
        el.currentTime = POSTER_FRAME_TIME;
      } catch {
        /* ignore */
      }
    }
    setReady(true);
  };

  const handlePosterError = () => {
    if (/\.webp(\?|$)/i.test(posterSrc)) {
      setPosterState((s) => ({
        ...s,
        src: posterSrc.replace(/\.webp(\?|$)/i, ".jpg$1"),
      }));
    }
  };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#0d2419] via-[#0a1c14] to-[#081A12]"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      aria-hidden
    >
      {/* Shimmer placeholder — reserved aspect via absolute fill, no CLS */}
      {hasPosterImage && !posterReady && (
        <div
          className={cn(
            "absolute inset-0 animate-pulse",
            "bg-gradient-to-br from-[#0D2218] via-[#0a1812] to-[#06140e]",
            "after:absolute after:inset-0 after:animate-[video-card-shimmer_1.6s_ease-in-out_infinite]",
            "after:bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.06)_50%,transparent_60%)]",
            "after:bg-[length:200%_100%]"
          )}
        />
      )}

      {/* Optional depth layer — same poster URL (cached), never the focus */}
      {hasPosterImage && posterSrc && (
        <MediaImage
          src={posterSrc}
          alt=""
          fill
          sizes={sizes}
          className={cn(
            "object-cover scale-110 blur-[10px] opacity-[0.1]",
            "transition-opacity duration-700 ease-out",
            showPreview ? "opacity-0" : "opacity-[0.1]",
            !posterReady && "opacity-0"
          )}
          aria-hidden
        />
      )}

      {/* Sharp subject — primary visual */}
      {hasPosterImage && posterSrc && (
        <MediaImage
          src={posterSrc}
          alt=""
          fill
          sizes={sizes}
          className={cn(
            "object-cover transition-[opacity,transform] duration-700 ease-out",
            MEDIA_GRADE,
            posterReady ? "opacity-100" : "opacity-0",
            showPreview && "opacity-0",
            className
          )}
          onLoad={() => setLoadedSrc(posterSrc)}
          onError={handlePosterError}
        />
      )}

      {/* Soft edge blur only — center stays crystal clear via radial mask */}
      {hasPosterImage && posterSrc && posterReady && !reduceMotion && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out",
            showPreview ? "opacity-0" : "opacity-100"
          )}
          style={{
            maskImage: EDGE_MASK,
            WebkitMaskImage: EDGE_MASK,
          }}
        >
          <MediaImage
            src={posterSrc}
            alt=""
            fill
            sizes={sizes}
            className="object-cover blur-[3px] opacity-80"
            aria-hidden
          />
        </div>
      )}

      {inView && (
        <video
          ref={videoRef}
          src={`${video.src}#t=${POSTER_FRAME_TIME}`}
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedMetadata={handleMetadata}
          onLoadedData={() => setReady(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            "transition-opacity duration-700 ease-out",
            MEDIA_GRADE,
            hasPosterImage
              ? showPreview
                ? "opacity-100"
                : "opacity-0"
              : "opacity-100",
            className
          )}
        />
      )}

      {/* Cinematic overlays — vignette + readability gradients (not full blur) */}
      <div
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-transparent opacity-80"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/75 via-black/35 to-transparent"
        aria-hidden
      />
    </div>
  );
}
