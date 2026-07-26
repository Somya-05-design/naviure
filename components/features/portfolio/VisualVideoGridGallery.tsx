"use client";

import { memo, useMemo, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreviewViewport } from "@/hooks/usePreviewViewport";
import VideoThumb from "@/components/features/portfolio/VideoThumb";
import { isValidDurationLabel } from "@/lib/video-meta";
import {
  EDITOR_GRID_COLUMNS,
  getCanvasHeight,
  getGridGap,
  getRowHeight,
} from "@/lib/gallery-builder/engine";
import { resolveLayoutForViewport, resolveLayoutItems } from "@/lib/gallery-layout-render";
import type { GalleryVideo } from "@/types";
import type { GalleryHoverStyle, GalleryLayout, GalleryLayoutItem } from "@/types/cms";

interface GridVideoTileProps {
  video: GalleryVideo;
  hover?: GalleryHoverStyle;
}

function GridVideoTile({ video, hover }: GridVideoTileProps) {
  const [duration, setDuration] = useState(
    isValidDurationLabel(video.duration) ? video.duration : ""
  );
  const zoom = Boolean(hover?.enabled && hover.zoom);

  return (
    <>
      <VideoThumb
        video={video}
        onDuration={setDuration}
        className={cn(
          "transition-transform duration-700 ease-out will-change-transform",
          zoom && "group-hover:scale-[1.03]",
          "motion-reduce:group-hover:scale-100"
        )}
        sizes="(max-width: 768px) 100vw, 33vw"
      />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/80 via-black/40 to-transparent backdrop-blur-[2px]"
        aria-hidden
      />

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 flex items-center justify-center",
          "transition-opacity duration-500 ease-out",
          "group-hover:opacity-0"
        )}
      >
        <span
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full",
            "bg-white/[0.1] text-soft-white ring-1 ring-white/35",
            "backdrop-blur-xl",
            "shadow-[0_12px_36px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.22)]",
            "transition-[transform,box-shadow] duration-500",
            "group-hover:scale-[1.08]",
            "motion-reduce:group-hover:scale-100"
          )}
        >
          <Play
            size={22}
            fill="currentColor"
            className="ml-0.5 transition-transform duration-500 group-hover:scale-90"
            strokeWidth={1.25}
          />
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4">
        <p className="truncate font-display text-sm font-medium leading-snug text-soft-white">
          {video.title}
        </p>
        {duration && (
          <p className="mt-1 text-[10px] tracking-wide text-soft-white/40">
            {duration}
          </p>
        )}
      </div>
    </>
  );
}

interface VisualVideoGridGalleryProps {
  videos: GalleryVideo[];
  layoutItems: GalleryLayoutItem[];
  layout?: GalleryLayout | null;
  onVideoClick?: (video: GalleryVideo, index: number) => void;
  className?: string;
  gridColumns?: number;
  editorMode?: boolean;
}

const VisualVideoGridGallery = memo(function VisualVideoGridGallery({
  videos,
  layoutItems,
  layout,
  onVideoClick,
  className,
  gridColumns,
  editorMode = false,
}: VisualVideoGridGalleryProps) {
  const viewport = usePreviewViewport();
  const videoMap = new Map(videos.map((video) => [video.id, video]));

  const ordered = [...layoutItems]
    .filter((item) => !item.hidden && videoMap.has(item.imageId))
    .sort((a, b) => a.order - b.order);

  const { items: positionedItems, columns } = useMemo(() => {
    if (editorMode && gridColumns) {
      return { items: ordered, columns: gridColumns };
    }

    if (gridColumns) {
      return {
        items: resolveLayoutItems(
          ordered,
          gridColumns,
          gridColumns === EDITOR_GRID_COLUMNS
        ),
        columns: gridColumns,
      };
    }

    return resolveLayoutForViewport(layout ?? null, viewport, ordered);
  }, [ordered, layout, viewport, gridColumns, editorMode]);

  if (!ordered.length) return null;

  const rowHeight = getRowHeight();
  const gap = getGridGap();

  return (
    <div
      className={cn("w-full", className)}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridAutoRows: `${rowHeight}px`,
        gap: `${gap}px`,
        minHeight: getCanvasHeight(positionedItems),
      }}
    >
      {positionedItems.map((item, index) => {
        const video = videoMap.get(item.imageId)!;
        const hover = item.hoverStyle;

        return (
          <button
            key={item.id}
            type="button"
            data-video-id={video.id}
            onClick={() => onVideoClick?.(video, index)}
            className={cn(
              "group relative overflow-hidden text-left",
              "ring-1 ring-inset ring-white/[0.12]",
              item.shadow !== false &&
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_16px_44px_rgba(0,0,0,0.38)]",
              "transition-[transform,box-shadow,ring-color] duration-500 ease-out",
              hover?.enabled && hover.zoom && "hover:-translate-y-1",
              "hover:ring-white/[0.2]",
              "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_24px_56px_rgba(0,0,0,0.48),0_0_36px_rgba(15,61,46,0.16)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/45",
              "motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            )}
            style={{
              gridColumn: `${item.x} / span ${item.colSpan}`,
              gridRow: `${item.y} / span ${item.rowSpan}`,
              borderRadius: item.borderRadius ?? 18,
            }}
          >
            <GridVideoTile video={video} hover={hover} />
          </button>
        );
      })}
    </div>
  );
});

export default VisualVideoGridGallery;
