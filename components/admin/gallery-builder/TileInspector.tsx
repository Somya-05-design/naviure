"use client";

import {
  Maximize2,
  Minimize2,
  Pin,
  Eye,
  EyeOff,
  ImageIcon,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TILE_SIZE_PRESETS } from "@/types/cms";
import type { GalleryImage } from "@/types";
import type { GalleryLayoutItem, GalleryTileSize } from "@/types/cms";

const SIZE_OPTIONS = Object.entries(TILE_SIZE_PRESETS) as [
  GalleryTileSize,
  { colSpan: number; rowSpan: number; label: string },
][];

interface TileInspectorProps {
  item: GalleryLayoutItem | null;
  image?: GalleryImage;
  preview?: {
    src: string;
    title: string;
    subtitle?: string;
  };
  mediaLabel?: string;
  coverLabel?: string;
  onSizePreset: (size: GalleryTileSize) => void;
  onGrow: () => void;
  onShrink: () => void;
  onPin: () => void;
  onToggleHidden: () => void;
  onSetCover: () => void;
  onRemove: () => void;
}

export default function TileInspector({
  item,
  image,
  preview,
  mediaLabel = "Selected Photo",
  coverLabel = "Set as cover",
  onSizePreset,
  onGrow,
  onShrink,
  onPin,
  onToggleHidden,
  onSetCover,
  onRemove,
}: TileInspectorProps) {
  if (!item) {
    return (
      <div className="flex h-full min-h-0 flex-col justify-center text-center">
        <p className="text-sm text-soft-white/40">Select a tile on the grid</p>
        <p className="mt-2 text-xs text-soft-white/25">
          Drag to reorder · Resize with controls
        </p>
      </div>
    );
  }

  const previewSrc = preview?.src ?? image?.src;
  const previewTitle = preview?.title ?? image?.alt ?? item.alt;
  const previewSubtitle = preview?.subtitle;

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto">
      <div>
        <h3 className="mb-3 text-[11px] uppercase tracking-[0.24em] text-soft-white/40">
          {mediaLabel}
        </h3>
        <div className="overflow-hidden rounded-xl border border-white/[0.08]">
          {previewSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt={previewTitle}
              className="aspect-[4/3] w-full object-cover"
            />
          )}
          <div className="p-3">
            <p className="text-sm text-soft-white">{previewTitle}</p>
            <p className="mt-1 text-[10px] text-soft-white/35">
              {item.colSpan}×{item.rowSpan} grid cells
              {previewSubtitle ? ` · ${previewSubtitle}` : ""}
              {item.cover && " · Category cover"}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-soft-white/35">
          Size Preset
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {SIZE_OPTIONS.map(([size, preset]) => (
            <button
              key={size}
              type="button"
              onClick={() => onSizePreset(size)}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-left text-[10px] transition-colors",
                item.size === size
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-white/[0.08] text-soft-white/55 hover:border-white/20"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onShrink}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] py-2 text-xs text-soft-white/70 hover:border-white/25"
        >
          <Minimize2 size={14} />
          Smaller
        </button>
        <button
          type="button"
          onClick={onGrow}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] py-2 text-xs text-soft-white/70 hover:border-white/25"
        >
          <Maximize2 size={14} />
          Larger
        </button>
      </div>

      <div className="space-y-1.5">
        <InspectorButton
          icon={Pin}
          label={item.pinned ? "Unpin position" : "Pin position"}
          active={item.pinned}
          onClick={onPin}
        />
        <InspectorButton
          icon={ImageIcon}
          label={item.cover ? "Remove cover" : coverLabel}
          active={item.cover}
          onClick={onSetCover}
        />
        <InspectorButton
          icon={item.hidden ? Eye : EyeOff}
          label={item.hidden ? "Show in gallery" : "Hide from gallery"}
          active={item.hidden}
          onClick={onToggleHidden}
        />
        <InspectorButton
          icon={Trash2}
          label="Remove from grid"
          danger
          onClick={onRemove}
        />
      </div>
    </div>
  );
}

function InspectorButton({
  icon: Icon,
  label,
  active,
  danger,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
        danger
          ? "border-red-500/20 text-red-300 hover:border-red-500/40"
          : active
            ? "border-gold/30 bg-gold/10 text-gold"
            : "border-white/[0.08] text-soft-white/60 hover:border-white/20"
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
