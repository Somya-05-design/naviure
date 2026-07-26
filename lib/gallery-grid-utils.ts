import type { GalleryLayoutItem, GalleryTileSize } from "@/types/cms";
import { EDITOR_GRID_COLUMNS, TILE_SIZE_PRESETS } from "@/types/cms";

export function previewColumnSpan(
  item: GalleryLayoutItem,
  gridColumns = 4
): number {
  return Math.max(
    1,
    Math.min(
      gridColumns,
      Math.round((item.colSpan / EDITOR_GRID_COLUMNS) * gridColumns)
    )
  );
}

export function previewAspectClass(item: GalleryLayoutItem): string {
  const ratio = item.colSpan / Math.max(item.rowSpan, 1);
  if (ratio >= 2) return "aspect-[21/9]";
  if (ratio >= 1.35) return "aspect-[4/3]";
  if (ratio <= 0.72) return "aspect-[3/4]";
  if (ratio <= 0.92) return "aspect-[4/5]";
  return "aspect-square";
}

export function editorColSpanFromPreviewCols(cols: number, gridColumns = 4): number {
  return Math.max(
    1,
    Math.min(
      EDITOR_GRID_COLUMNS,
      Math.round((cols / gridColumns) * EDITOR_GRID_COLUMNS)
    )
  );
}

export function editorRowSpanFromHeight(height: "short" | "default" | "tall"): number {
  switch (height) {
    case "short":
      return 2;
    case "tall":
      return 6;
    default:
      return 4;
  }
}

export function previewHeightFromRowSpan(rowSpan: number): "short" | "default" | "tall" {
  if (rowSpan <= 2) return "short";
  if (rowSpan >= 5) return "tall";
  return "default";
}

export function previewColsFromItem(
  item: GalleryLayoutItem,
  gridColumns = 4
): number {
  return previewColumnSpan(item, gridColumns);
}

export const ALL_TILE_SIZES = Object.entries(TILE_SIZE_PRESETS).map(
  ([key, value]) => ({
    key: key as GalleryTileSize,
    label: value.label,
  })
);

export const PRIMARY_SIZES: GalleryTileSize[] = ["s", "m", "l", "hero"];
export const EXTRA_SIZES: GalleryTileSize[] = [
  "xs",
  "xl",
  "portrait",
  "landscape",
  "wide",
  "tall",
  "square",
];
