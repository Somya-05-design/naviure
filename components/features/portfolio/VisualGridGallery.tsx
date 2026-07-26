"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { usePreviewViewport } from "@/hooks/usePreviewViewport";
import {
  EDITOR_GRID_COLUMNS,
  getCanvasHeight,
  getGridGap,
  getRowHeight,
} from "@/lib/gallery-builder/engine";
import {
  MASONRY_CANVAS_WIDTH,
  MASONRY_GAP,
  getMasonryCanvasHeight,
} from "@/lib/gallery-builder/masonry-engine";
import { resolveLayoutForViewport, resolveLayoutItems } from "@/lib/gallery-layout-render";
import { getGalleryThumbUrl } from "@/lib/media-urls";
import type { GalleryImage } from "@/types";
import type { GalleryLayout, GalleryLayoutItem } from "@/types/cms";

interface VisualGridGalleryProps {
  images: GalleryImage[];
  layoutItems: GalleryLayoutItem[];
  layout?: GalleryLayout | null;
  onImageClick?: (image: GalleryImage, index: number) => void;
  className?: string;
  /** Force column count; when omitted, uses responsive viewport from layout. */
  gridColumns?: number;
  /** Keep exact editor positions (builder canvas / preview). */
  editorMode?: boolean;
}

const VisualGridGallery = memo(function VisualGridGallery({
  images,
  layoutItems,
  layout,
  onImageClick,
  className,
  gridColumns,
  editorMode = false,
}: VisualGridGalleryProps) {
  const viewport = usePreviewViewport();
  const imageMap = new Map(images.map((image) => [image.id, image]));

  const ordered = [...layoutItems]
    .filter((item) => !item.hidden && imageMap.has(item.imageId))
    .sort((a, b) => a.order - b.order);

  const usesFrames = ordered.some((item) => item.frame);

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

  const frameHeight = useMemo(
    () => (usesFrames ? getMasonryCanvasHeight(ordered, MASONRY_GAP) : 0),
    [ordered, usesFrames]
  );

  if (!ordered.length) return null;

  if (usesFrames) {
    return (
      <div
        className={cn("relative w-full", className)}
        style={{ height: frameHeight, maxWidth: MASONRY_CANVAS_WIDTH }}
      >
        {ordered.map((item, index) => {
          const image = imageMap.get(item.imageId)!;
          const frame = item.frame!;
          const crop = item.crop;
          const scale = 100 / MASONRY_CANVAS_WIDTH;

          return (
            <button
              key={item.id}
              type="button"
              data-photo-id={image.id}
              onClick={() => onImageClick?.(image, index)}
              className={cn(
                "absolute overflow-hidden text-left",
                "ring-1 ring-inset ring-white/[0.09]",
                item.shadow !== false && "shadow-[0_14px_40px_rgba(0,0,0,0.34)]",
                "transition-transform duration-500 hover:-translate-y-0.5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/45"
              )}
              style={{
                left: `${frame.x * scale}%`,
                top: frame.y,
                width: `${frame.w * scale}%`,
                height: frame.h,
                borderRadius: item.borderRadius ?? 18,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getGalleryThumbUrl(image.src, image.thumbnail)}
                alt={item.alt || image.alt}
                className="h-full w-full object-cover"
                style={{
                  transform: crop
                    ? `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale}) rotate(${crop.rotation}deg)`
                    : undefined,
                }}
                loading="lazy"
                decoding="async"
              />
            </button>
          );
        })}
      </div>
    );
  }

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
        const image = imageMap.get(item.imageId)!;
        const hover = item.hoverStyle;

        return (
          <button
            key={item.id}
            type="button"
            data-photo-id={image.id}
            onClick={() => onImageClick?.(image, index)}
            className={cn(
              "group relative overflow-hidden text-left",
              "ring-1 ring-inset ring-white/[0.09]",
              item.shadow !== false &&
                "shadow-[0_14px_40px_rgba(0,0,0,0.34)]",
              "transition-[transform,box-shadow] duration-500",
              hover?.enabled && hover.zoom && "hover:-translate-y-1",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/45"
            )}
            style={{
              gridColumn: `${item.x} / span ${item.colSpan}`,
              gridRow: `${item.y} / span ${item.rowSpan}`,
              borderRadius: item.borderRadius ?? 18,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getGalleryThumbUrl(image.src, image.thumbnail)}
              alt={item.alt || image.alt}
              className={cn(
                "h-full w-full object-cover transition duration-700",
                hover?.enabled && hover.zoom && "group-hover:scale-[1.03]",
                hover?.enabled &&
                  hover.grayscale &&
                  "grayscale group-hover:grayscale-0"
              )}
              loading="lazy"
              decoding="async"
            />
            {hover?.enabled && hover.overlay && (
              <div
                className="absolute inset-0 bg-black/25 transition group-hover:bg-black/10"
                style={{ opacity: (hover.opacity ?? 100) / 100 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
});

export default VisualGridGallery;
