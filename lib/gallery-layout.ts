import type { GalleryImage } from "@/types";

/** Responsive column count — max 5 on desktop XL. */
export function getGalleryColumns(viewportWidth: number): number {
  if (viewportWidth < 640) return 1;
  if (viewportWidth < 1024) return 2;
  if (viewportWidth < 1280) return 3;
  if (viewportWidth < 1600) return 4;
  return 5;
}

export function getGalleryColumnGap(viewportWidth: number): number {
  if (viewportWidth < 640) return 10;
  if (viewportWidth < 1024) return 12;
  return 16;
}

/** Stable featured rhythm — first image + every 9th after. */
export function isFeaturedGalleryImage(index: number): boolean {
  return index === 0 || (index > 0 && index % 9 === 0);
}

export function getImageAspectRatio(image: GalleryImage): number {
  return image.width / Math.max(image.height, 1);
}

/** Relative display height used for shortest-column packing. */
export function getRelativeImageHeight(image: GalleryImage): number {
  return Math.max(image.height, 1) / Math.max(image.width, 1);
}

export const GALLERY_BATCH_SIZE = 24;

export interface MasonryPlacedItem {
  image: GalleryImage;
  index: number;
}

export type MasonrySection =
  | {
      type: "featured";
      item: MasonryPlacedItem;
    }
  | {
      type: "columns";
      columns: MasonryPlacedItem[][];
    };

/**
 * Shortest-column masonry packing — stable order, balanced columns, featured full-width breaks.
 */
export function buildMasonrySections(
  images: MasonryPlacedItem[],
  columnCount: number,
  gap: number
): MasonrySection[] {
  if (columnCount <= 1) {
    return images.map((item) => ({
      type: "featured" as const,
      item,
    }));
  }

  const sections: MasonrySection[] = [];
  let columns: MasonryPlacedItem[][] = Array.from(
    { length: columnCount },
    () => []
  );
  let columnHeights = Array(columnCount).fill(0);

  const flushColumns = () => {
    if (columns.some((column) => column.length > 0)) {
      sections.push({ type: "columns", columns });
      columns = Array.from({ length: columnCount }, () => []);
      columnHeights = Array(columnCount).fill(0);
    }
  };

  for (const item of images) {
    if (isFeaturedGalleryImage(item.index)) {
      flushColumns();
      sections.push({ type: "featured", item });
      continue;
    }

    const shortestIndex = columnHeights.indexOf(Math.min(...columnHeights));
    columns[shortestIndex].push(item);
    columnHeights[shortestIndex] +=
      getRelativeImageHeight(item.image) + gap / 900;
  }

  flushColumns();
  return sections;
}
