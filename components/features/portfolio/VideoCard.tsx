"use client";

import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Play } from "lucide-react";
import VideoThumb from "@/components/features/portfolio/VideoThumb";
import { cn, formatCategoryName, prefersReducedMotion } from "@/lib/utils";
import { isValidDurationLabel } from "@/lib/video-meta";
import type { GalleryVideo } from "@/types";

interface VideoCardProps {
  video: GalleryVideo;
  onPlay: (video: GalleryVideo) => void;
  /** When true, the card auto-previews (GIF-like) even without hover. */
  active?: boolean;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export default function VideoCard({
  video,
  onPlay,
  active = false,
}: VideoCardProps) {
  const [duration, setDuration] = useState(
    isValidDurationLabel(video.duration) ? video.duration : ""
  );
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleId = useRef(0);

  const categoryLabel = formatCategoryName(video.category || "");

  const handleActivate = (
    e: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>
  ) => {
    if ("clientX" in e && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      const id = ++rippleId.current;
      setRipples((prev) => [
        ...prev,
        { id, x: e.clientX - rect.left, y: e.clientY - rect.top },
      ]);
      window.setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 650);
    }
    onPlay(video);
  };

  return (
    <div
      className={cn(
        "group relative aspect-video cursor-pointer overflow-hidden rounded-2xl",
        "ring-1 ring-inset ring-white/[0.12]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_16px_44px_rgba(0,0,0,0.38)]",
        "transition-[transform,box-shadow,ring-color] duration-500 ease-out",
        "hover:-translate-y-1",
        "hover:ring-white/[0.2]",
        "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_24px_56px_rgba(0,0,0,0.48),0_0_40px_rgba(15,61,46,0.18)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#081A12]",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      )}
      onClick={handleActivate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate(e);
        }
      }}
      aria-label={`Play ${video.title}`}
      data-video-id={video.id}
    >
      <VideoThumb
        video={video}
        active={active}
        onDuration={setDuration}
        className={cn(
          "transition-transform duration-700 ease-out will-change-transform",
          "group-hover:scale-[1.03]",
          "motion-reduce:group-hover:scale-100"
        )}
      />

      {/* Soft glass wash over text band */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/80 via-black/40 to-transparent backdrop-blur-[2px]"
        aria-hidden
      />

      {/* Text */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-5 md:p-6">
        <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.32em] text-gold/70">
          {categoryLabel}
        </span>
        <h3 className="font-display text-lg font-medium leading-snug text-soft-white md:text-xl">
          {video.title}
        </h3>
        {duration && (
          <span className="mt-1.5 block text-xs tracking-wide text-soft-white/40">
            {duration}
          </span>
        )}
      </div>

      {/* Frosted glass play control */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 flex items-center justify-center",
          "transition-opacity duration-500 ease-out",
          "group-hover:opacity-0",
          active && "opacity-0"
        )}
      >
        <div
          className={cn(
            "relative flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full",
            "bg-white/[0.1] text-soft-white",
            "ring-1 ring-white/35",
            "backdrop-blur-xl",
            "shadow-[0_12px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]",
            "transition-[transform,box-shadow,background-color] duration-500 ease-out",
            "group-hover:scale-[1.08]",
            "group-hover:bg-white/[0.14]",
            "group-hover:shadow-[0_16px_48px_rgba(0,0,0,0.5),0_0_28px_rgba(200,169,106,0.22),inset_0_1px_0_rgba(255,255,255,0.3)]",
            "motion-reduce:group-hover:scale-100"
          )}
        >
          <Play
            size={26}
            className="ml-0.5 transition-transform duration-500 group-hover:scale-90"
            fill="currentColor"
            strokeWidth={1.25}
          />
        </div>
      </div>

      {/* Click ripple */}
      {!prefersReducedMotion() &&
        ripples.map((r) => (
          <span
            key={r.id}
            className="pointer-events-none absolute z-20 h-4 w-4 rounded-full bg-white/30 animate-[video-card-ripple_0.65s_ease-out_forwards]"
            style={{ left: r.x, top: r.y }}
            aria-hidden
          />
        ))}
    </div>
  );
}
