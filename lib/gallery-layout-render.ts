import {
  EDITOR_GRID_COLUMNS,
  getGridGap,
  getRowHeight,
  packItems,
  scaleItemForViewport,
} from "@/lib/gallery-builder/engine";
import {
  getColumnsForViewport,
  getLayoutItemsForViewport,
} from "@/lib/gallery-layout-cms";
import type { GalleryLayout, GalleryLayoutItem, PreviewViewport } from "@/types/cms";
import { VIEWPORT_COLUMNS } from "@/types/cms";

export function buildLayoutViewports(items: GalleryLayoutItem[]) {
  return (["desktop", "laptop", "tablet", "mobile"] as PreviewViewport[]).reduce(
    (acc, viewport) => {
      const columns = VIEWPORT_COLUMNS[viewport];
      acc[viewport] = {
        columns,
        items: resolveLayoutItems(items, columns, viewport === "desktop"),
      };
      return acc;
    },
    {} as NonNullable<GalleryLayout["viewports"]>
  );
}

export function resolveLayoutItems(
  items: GalleryLayoutItem[],
  columns: number,
  preservePositions = false
): GalleryLayoutItem[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);

  if (preservePositions && columns === EDITOR_GRID_COLUMNS) {
    return sorted;
  }

  const scaled =
    columns === EDITOR_GRID_COLUMNS
      ? sorted
      : sorted.map((item) =>
          scaleItemForViewport(item, EDITOR_GRID_COLUMNS, columns)
        );

  return packItems(
    scaled.map((item, index) => ({ ...item, x: 1, y: 1, order: index })),
    columns
  );
}

export function resolveLayoutForViewport(
  layout: GalleryLayout | null,
  viewport: PreviewViewport,
  fallbackItems: GalleryLayoutItem[]
): { items: GalleryLayoutItem[]; columns: number } {
  const columns = layout
    ? getColumnsForViewport(layout, viewport)
    : EDITOR_GRID_COLUMNS;

  const sourceItems = layout
    ? getLayoutItemsForViewport(layout, viewport)
    : fallbackItems;

  const preservePositions =
    Boolean(layout) && columns === EDITOR_GRID_COLUMNS && viewport === "desktop";

  return {
    columns,
    items: resolveLayoutItems(sourceItems, columns, preservePositions),
  };
}

export function getTileTopPx(item: GalleryLayoutItem, canvasPadding = 16): number {
  const rowHeight = getRowHeight();
  const gap = getGridGap();
  return canvasPadding + (item.y - 1) * (rowHeight + gap);
}

export function getClampedInspectorTop(
  item: GalleryLayoutItem,
  inspectorHeight: number,
  canvasHeight: number,
  canvasPadding = 16
): number {
  const tileTop = getTileTopPx(item, canvasPadding);
  const maxTop = Math.max(canvasPadding, canvasHeight - inspectorHeight);
  return Math.min(Math.max(canvasPadding, tileTop), maxTop);
}
