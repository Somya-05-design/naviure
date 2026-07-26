"use client";

import { useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pin, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GalleryVideo } from "@/types";
import type { GalleryLayoutItem } from "@/types/cms";

interface SortableVideoTileProps {
  item: GalleryLayoutItem;
  video?: GalleryVideo;
  selected: boolean;
  onSelect: () => void;
}

export default function SortableVideoTile({
  item,
  video,
  selected,
  onSelect,
}: SortableVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    gridColumn: `${item.x} / span ${item.colSpan}`,
    gridRow: `${item.y} / span ${item.rowSpan}`,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : selected ? 20 : 1,
  };

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !selected) {
      el?.pause();
      return;
    }
    el.currentTime = 0;
    el.play().catch(() => {});
    return () => {
      el.pause();
    };
  }, [selected]);

  return (
    <div
      id={`video-tile-${item.id}`}
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-[#0A1410]",
        selected
          ? "border-gold/60 ring-2 ring-gold/30"
          : "border-white/[0.1] hover:border-white/25",
        item.hidden && "opacity-40",
        isDragging && "opacity-80 shadow-2xl"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {video ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={video.thumbnail}
            alt={video.title}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-300",
              selected ? "opacity-0" : "opacity-100"
            )}
            draggable={false}
          />
          <video
            ref={videoRef}
            src={video.src}
            muted
            loop
            playsInline
            preload="metadata"
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
              selected ? "opacity-100" : "opacity-0"
            )}
          />
        </>
      ) : (
        <div className="flex h-full min-h-[72px] items-center justify-center text-xs text-soft-white/30">
          Missing video
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
        <span className="rounded-full bg-black/50 p-3 text-soft-white">
          <Play size={18} fill="currentColor" />
        </span>
      </div>

      <div className="absolute left-2 top-2 flex flex-wrap items-center gap-1">
        {item.cover && (
          <span className="rounded-md bg-gold px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[#081A12]">
            Cover
          </span>
        )}
        {item.pinned && (
          <span className="rounded-md bg-black/50 p-1 text-gold">
            <Pin size={12} />
          </span>
        )}
        {item.hidden && (
          <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-soft-white/70">
            Hidden
          </span>
        )}
      </div>

      <button
        type="button"
        className="absolute right-2 top-2 rounded-md bg-black/50 p-1 text-soft-white/70 opacity-0 transition-opacity hover:text-soft-white group-hover:opacity-100"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} />
      </button>

      <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-[10px] text-soft-white/80">
          {video?.title || item.title || "Video"}
        </p>
        {video?.duration && (
          <p className="text-[9px] text-soft-white/45">{video.duration}</p>
        )}
      </div>
    </div>
  );
}
