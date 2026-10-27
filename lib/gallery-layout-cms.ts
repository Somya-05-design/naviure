import type { GalleryImage, Category } from "@/types";
import type { GalleryLayout, GalleryLayoutItem } from "@/types/cms";
import { migrateLegacyLayout, VIEWPORT_COLUMNS } from "@/types/cms";
import { buildDefaultLayoutItems } from "@/lib/gallery-builder/engine";
import { getGalleryWebUrl } from "@/lib/media-urls";

export function getCoverImageFromLayout(
  layout: GalleryLayout | null | undefined,
  images: GalleryImage[],
  categorySlug: string
): string | undefined {
  const coverItem = layout?.items.find(
    (item) => (item.cover || item.hero) && !item.hidden
  );
  if (!coverItem) return undefined;
  const image = images.find(
    (img) => img.id === coverItem.imageId && img.category === categorySlug
  );
  if (!image) return undefined;
  return getGalleryWebUrl(image.thumbnail || image.src);
}

export function getCategoryCoverImage(
  category: Category,
  images: GalleryImage[],
  layout?: GalleryLayout | null
): string {
  const fromLayout = getCoverImageFromLayout(layout, images, category.slug);
  if (fromLayout) return fromLayout;

  if (category.coverImage) {
    return getGalleryWebUrl(category.coverImage);
  }

  const first = images.find((image) => image.category === category.slug);
  if (first) return getGalleryWebUrl(first.thumbnail || first.src);
  return "";
}

export function applyGalleryLayout(
  images: GalleryImage[],
  layout: GalleryLayout | null
): { items: GalleryLayoutItem[]; images: GalleryImage[]; layout: GalleryLayout | null } {
  if (!layout?.items?.length) {
    const defaults = buildDefaultLayoutItems(images);
    return { items: defaults, images, layout: null };
  }

  const normalized = migrateLegacyLayout(layout);
  const imageMap = new Map(images.map((image) => [image.id, image]));
  const visibleItems = normalized.items.filter(
    (item) => !item.hidden && imageMap.has(item.imageId)
  );

  // Stale layout (e.g. pre-migration demo IDs): fall back to default masonry items.
  if (visibleItems.length === 0) {
    const defaults = buildDefaultLayoutItems(images);
    return { items: defaults, images, layout: null };
  }

  const ordered: GalleryImage[] = [];
  for (const item of [...visibleItems].sort((a, b) => a.order - b.order)) {
    const image = imageMap.get(item.imageId);
    if (image) {
      ordered.push(image);
      imageMap.delete(item.imageId);
    }
  }

  for (const image of imageMap.values()) {
    ordered.push(image);
  }

  return {
    items: visibleItems,
    images: ordered,
    layout: normalized,
  };
}

export function getLayoutItemsForViewport(
  layout: GalleryLayout | null,
  viewport: keyof typeof VIEWPORT_COLUMNS
): GalleryLayoutItem[] {
  if (!layout) return [];
  const normalized = migrateLegacyLayout(layout);
  const viewportLayout = normalized.viewports?.[viewport];
  if (viewportLayout?.items?.length) return viewportLayout.items;
  return normalized.items;
}

export function getColumnsForViewport(
  layout: GalleryLayout | null,
  viewport: keyof typeof VIEWPORT_COLUMNS
): number {
  if (!layout) return VIEWPORT_COLUMNS[viewport];
  const normalized = migrateLegacyLayout(layout);
  return (
    normalized.viewports?.[viewport]?.columns ??
    VIEWPORT_COLUMNS[viewport]
  );
}
