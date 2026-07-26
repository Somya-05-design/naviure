import type { GalleryImage, GalleryVideo } from "@/types";
import type {
  GalleryGridType,
  GalleryLayoutItem,
  GalleryTileSize,
  PreviewViewport,
} from "@/types/cms";
import {
  EDITOR_GRID_COLUMNS,
  TILE_SIZE_PRESETS,
  tileSizeFromImage,
  normalizeLayoutItem,
  VIEWPORT_COLUMNS,
} from "@/types/cms";
import { randomUUID } from "@/lib/uuid";

export { EDITOR_GRID_COLUMNS, VIEWPORT_COLUMNS };

const ROW_HEIGHT = 72;
const GAP = 8;

export function getRowHeight() {
  return ROW_HEIGHT;
}

export function getGridGap() {
  return GAP;
}

export function buildDefaultLayoutItems(
  images: GalleryImage[]
): GalleryLayoutItem[] {
  return buildCategoryGridLayout(images, [], "custom", EDITOR_GRID_COLUMNS, {
    rearrange: true,
    seed: 1,
  });
}

/** Ensure every category photo is on the grid, optionally arranged with the active grid type. */
export function buildCategoryGridLayout(
  photos: GalleryImage[],
  existingItems: GalleryLayoutItem[] = [],
  gridType: GalleryGridType,
  columns: number = EDITOR_GRID_COLUMNS,
  options?: { rearrange?: boolean; seed?: number }
): GalleryLayoutItem[] {
  if (!photos.length) return [];

  const photoMap = new Map(photos.map((photo) => [photo.id, photo]));
  const existingByImage = new Map(
    existingItems
      .filter((item) => photoMap.has(item.imageId))
      .map((item) => [item.imageId, item])
  );

  const sortedPhotos = [...photos].sort((a, b) => a.order - b.order);
  const items: GalleryLayoutItem[] = sortedPhotos.map((photo, index) => {
    const existing = existingByImage.get(photo.id);
    if (existing) {
      return { ...existing, order: index };
    }

    const size = tileSizeFromImage(photo);
    const preset = TILE_SIZE_PRESETS[size];
    return normalizeLayoutItem({
      id: randomUUID(),
      imageId: photo.id,
      size,
      colSpan: preset.colSpan,
      rowSpan: preset.rowSpan,
      x: 1,
      y: 1,
      order: index,
      alt: photo.alt,
    });
  });

  if (!items.some((item) => item.cover) && items.length) {
    items[0] = { ...items[0], cover: true, hero: true, featured: true };
  }

  if (options?.rearrange) {
    return runGalleryAutoArrange(items, gridType, columns, {
      varyGrid: false,
      seed: options.seed ?? 1,
    });
  }

  return packItems(items, columns);
}

export function tileSizeFromVideo(): GalleryTileSize {
  return "landscape";
}

/** Ensure every category video is on the grid, optionally arranged with the active grid type. */
export function buildCategoryVideoGridLayout(
  videos: GalleryVideo[],
  existingItems: GalleryLayoutItem[] = [],
  gridType: GalleryGridType,
  columns: number = EDITOR_GRID_COLUMNS,
  options?: { rearrange?: boolean; seed?: number }
): GalleryLayoutItem[] {
  if (!videos.length) return [];

  const videoMap = new Map(videos.map((video) => [video.id, video]));
  const existingByVideo = new Map(
    existingItems
      .filter((item) => videoMap.has(item.imageId))
      .map((item) => [item.imageId, item])
  );

  const sortedVideos = [...videos].sort((a, b) => a.order - b.order);
  const items: GalleryLayoutItem[] = sortedVideos.map((video, index) => {
    const existing = existingByVideo.get(video.id);
    if (existing) {
      return { ...existing, order: index };
    }

    const size = tileSizeFromVideo();
    const preset = TILE_SIZE_PRESETS[size];
    return normalizeLayoutItem({
      id: randomUUID(),
      imageId: video.id,
      size,
      colSpan: preset.colSpan,
      rowSpan: preset.rowSpan,
      x: 1,
      y: 1,
      order: index,
      alt: video.title,
      title: video.title,
    });
  });

  if (!items.some((item) => item.cover) && items.length) {
    items[0] = { ...items[0], cover: true, hero: true, featured: true };
  }

  if (options?.rearrange) {
    return runGalleryAutoArrange(items, gridType, columns, {
      varyGrid: false,
      seed: options.seed ?? 1,
    });
  }

  return packItems(items, columns);
}

export function packItems(
  items: GalleryLayoutItem[],
  columns: number = EDITOR_GRID_COLUMNS
): GalleryLayoutItem[] {
  const grid: boolean[][] = [];
  const placed: GalleryLayoutItem[] = [];

  const occupies = (x: number, y: number, cols: number, rows: number) => {
    for (let row = y - 1; row < y - 1 + rows; row++) {
      for (let col = x - 1; col < x - 1 + cols; col++) {
        if (grid[row]?.[col]) return true;
      }
    }
    return false;
  };

  const mark = (x: number, y: number, cols: number, rows: number) => {
    for (let row = y - 1; row < y - 1 + rows; row++) {
      if (!grid[row]) grid[row] = [];
      for (let col = x - 1; col < x - 1 + cols; col++) {
        grid[row][col] = true;
      }
    }
  };

  const sorted = [...items].sort((a, b) => a.order - b.order);

  for (const item of sorted) {
    const cols = Math.min(item.colSpan, columns);
    const rows = item.rowSpan;
    let placedItem: GalleryLayoutItem | null = null;

    for (let y = 1; y < 500 && !placedItem; y++) {
      for (let x = 1; x <= columns - cols + 1; x++) {
        if (!occupies(x, y, cols, rows)) {
          mark(x, y, cols, rows);
          placedItem = { ...item, x, y, colSpan: cols, order: placed.length };
          break;
        }
      }
    }

    if (placedItem) placed.push(placedItem);
  }

  return placed;
}

export function resolveAutoArrangeGridType(
  gridType: GalleryGridType
): Exclude<GalleryGridType, "custom"> {
  return gridType === "custom" ? "masonry" : gridType;
}

const SCENE_GRID_POOL: GalleryGridType[] = [
  "luxury",
  "masonry",
  "editorial",
  "hero-first",
  "magazine",
  "pinterest",
  "classic",
];

const MASONRY_PATTERNS: GalleryTileSize[][] = [
  ["portrait", "m", "landscape", "tall", "square"],
  ["square", "tall", "m", "portrait", "wide"],
  ["landscape", "portrait", "tall", "square", "m"],
  ["wide", "m", "portrait", "landscape", "tall"],
  ["tall", "square", "m", "wide", "portrait"],
];

const LUXURY_PATTERNS: GalleryTileSize[][] = [
  ["hero", "xl", "l", "portrait", "wide"],
  ["wide", "xl", "portrait", "l", "hero"],
  ["portrait", "hero", "wide", "xl", "l"],
  ["xl", "wide", "l", "portrait", "tall"],
  ["l", "portrait", "hero", "wide", "square"],
];

export function pickSceneGridType(
  base: GalleryGridType,
  seed: number,
  varyGrid: boolean
): GalleryGridType {
  if (!varyGrid) return resolveAutoArrangeGridType(base);
  return SCENE_GRID_POOL[(Math.max(1, seed) - 1) % SCENE_GRID_POOL.length];
}

function sizeFromPattern(
  patterns: GalleryTileSize[][],
  index: number,
  seed: number
): GalleryTileSize {
  const pattern = patterns[seed % patterns.length];
  const offset = Math.floor(seed / patterns.length) % pattern.length;
  return pattern[(index + offset) % pattern.length];
}

function sizedItem(
  item: GalleryLayoutItem,
  index: number,
  size: GalleryTileSize,
  columns: number,
  extra?: Partial<GalleryLayoutItem>
) {
  const preset = TILE_SIZE_PRESETS[size];
  return normalizeLayoutItem({
    ...item,
    size,
    colSpan: Math.min(preset.colSpan, columns),
    rowSpan: preset.rowSpan,
    order: index,
    ...extra,
  });
}

export function autoArrange(
  items: GalleryLayoutItem[],
  gridType: GalleryGridType,
  columns: number = EDITOR_GRID_COLUMNS,
  seed = 0
): GalleryLayoutItem[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const effectiveType = resolveAutoArrangeGridType(gridType);

  switch (effectiveType) {
    case "hero-first":
      return autoHeroFirst(sorted, columns, seed);
    case "masonry":
    case "pinterest":
      return autoMasonry(sorted, columns, seed);
    case "editorial":
    case "magazine":
      return autoEditorial(sorted, columns, seed);
    case "luxury":
      return autoLuxury(sorted, columns, seed);
    case "classic":
      return autoClassic(sorted, columns, seed);
    default:
      return packItems(sorted, columns);
  }
}

/** Full auto-arrange: new grid structure each scene, photos keep their order. */
export function runGalleryAutoArrange(
  items: GalleryLayoutItem[],
  gridType: GalleryGridType,
  columns: number = EDITOR_GRID_COLUMNS,
  options?: { seed?: number; varyGrid?: boolean }
): GalleryLayoutItem[] {
  const seed = options?.seed ?? 0;
  const varyGrid = options?.varyGrid ?? false;
  const sorted = [...items].sort((a, b) => a.order - b.order);
  if (!sorted.length) return sorted;

  const coverItem = sorted.find((item) => item.cover);
  const sceneGridType = pickSceneGridType(gridType, seed, varyGrid);
  const working = sorted.map((item) => ({ ...item, pinned: false }));
  const arranged = autoArrange(working, sceneGridType, columns, seed);

  if (!coverItem) return arranged;

  const coverTile = arranged.find((item) => item.id === coverItem.id);
  if (!coverTile) return arranged;

  const others = arranged
    .filter((item) => item.id !== coverItem.id)
    .sort((a, b) => a.order - b.order);

  return packItems(
    [
      { ...coverTile, cover: true, hero: true, order: 0 },
      ...others.map((item, index) => ({
        ...item,
        cover: false,
        hero: false,
        order: index + 1,
      })),
    ],
    columns
  );
}

/** Keep manually pinned items (order + size); auto-arrange the rest. */
export function smartArrange(
  items: GalleryLayoutItem[],
  gridType: GalleryGridType,
  columns: number = EDITOR_GRID_COLUMNS
): GalleryLayoutItem[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const unpinned = sorted.filter((item) => !item.pinned);

  if (!unpinned.length) return sorted;
  if (unpinned.length === sorted.length) {
    return autoArrange(items, gridType, columns);
  }

  const autoSized = autoArrange(
    unpinned.map((item, index) => ({ ...item, order: index })),
    gridType,
    columns
  );

  let autoIndex = 0;
  const merged = sorted.map((item, order) => {
    if (item.pinned) {
      return { ...item, order };
    }
    const next = autoSized[autoIndex++];
    if (!next) return { ...item, order };
    return {
      ...next,
      id: item.id,
      imageId: item.imageId,
      order,
      pinned: false,
    };
  });

  return packItems(merged, columns);
}

function autoClassic(items: GalleryLayoutItem[], columns: number, seed = 0) {
  const variants = [
    { cols: 3, rows: 3, size: "m" as GalleryTileSize },
    { cols: 4, rows: 2, size: "s" as GalleryTileSize },
    { cols: 2, rows: 4, size: "portrait" as GalleryTileSize },
    { cols: 6, rows: 3, size: "landscape" as GalleryTileSize },
  ];
  const variant = variants[seed % variants.length];
  const colSpan = Math.max(1, Math.min(columns, Math.floor(columns / variant.cols)));
  const uniform = items.map((item, index) =>
    normalizeLayoutItem({
      ...item,
      size: variant.size,
      colSpan,
      rowSpan: variant.rows,
      order: index,
    })
  );
  return packItems(uniform, columns);
}

function autoHeroFirst(items: GalleryLayoutItem[], columns: number, seed = 0) {
  const heroSpans = [5, 6, 7, 8];
  const heroRowSpan = heroSpans[seed % heroSpans.length];
  const sidePatterns: GalleryTileSize[][] = [
    ["portrait", "m", "square"],
    ["m", "landscape", "s"],
    ["square", "tall", "m"],
    ["wide", "m", "portrait"],
  ];
  const sidePattern = sidePatterns[seed % sidePatterns.length];

  const arranged = items.map((item, index) => {
    if (index === 0) {
      return normalizeLayoutItem({
        ...item,
        size: "hero",
        colSpan: columns,
        rowSpan: heroRowSpan,
        hero: true,
        order: 0,
      });
    }
    const size = sidePattern[(index - 1) % sidePattern.length];
    const preset = TILE_SIZE_PRESETS[size];
    return normalizeLayoutItem({
      ...item,
      size,
      colSpan: preset.colSpan,
      rowSpan: preset.rowSpan,
      order: index,
    });
  });
  return packItems(arranged, columns);
}

function autoMasonry(items: GalleryLayoutItem[], columns: number, seed = 0) {
  const colBoost = seed % 3;
  const arranged = items.map((item, index) => {
    const size = sizeFromPattern(MASONRY_PATTERNS, index, seed);
    const preset = TILE_SIZE_PRESETS[size];
    return normalizeLayoutItem({
      ...item,
      size,
      colSpan: Math.min(
        Math.max(1, preset.colSpan + colBoost - 1),
        columns
      ),
      rowSpan: Math.max(2, preset.rowSpan + (seed % 2)),
      order: index,
    });
  });
  return packItems(arranged, columns);
}

function autoEditorial(items: GalleryLayoutItem[], columns: number, seed = 0) {
  const wideEvery = [3, 4, 5, 6][seed % 4];
  const wideSizes = [
    { colSpan: 8, rowSpan: 4, size: "wide" as GalleryTileSize },
    { colSpan: 6, rowSpan: 5, size: "tall" as GalleryTileSize },
    { colSpan: 10, rowSpan: 3, size: "landscape" as GalleryTileSize },
    { colSpan: 12, rowSpan: 4, size: "hero" as GalleryTileSize },
  ];
  const smallSizes = [
    { colSpan: 3, rowSpan: 3, size: "m" as GalleryTileSize },
    { colSpan: 2, rowSpan: 3, size: "s" as GalleryTileSize },
    { colSpan: 4, rowSpan: 2, size: "landscape" as GalleryTileSize },
    { colSpan: 3, rowSpan: 4, size: "portrait" as GalleryTileSize },
  ];
  const wide = wideSizes[seed % wideSizes.length];
  const small = smallSizes[(seed + 1) % smallSizes.length];

  const arranged = items.map((item, index) => {
    if (index % wideEvery === 0) {
      return normalizeLayoutItem({
        ...item,
        size: wide.size,
        colSpan: Math.min(wide.colSpan, columns),
        rowSpan: wide.rowSpan,
        featured: true,
        order: index,
      });
    }
    return normalizeLayoutItem({
      ...item,
      size: small.size,
      colSpan: Math.min(small.colSpan, columns),
      rowSpan: small.rowSpan,
      order: index,
    });
  });
  return packItems(arranged, columns);
}

function autoLuxury(items: GalleryLayoutItem[], columns: number, seed = 0) {
  const arranged = items.map((item, index) => {
    const size = sizeFromPattern(LUXURY_PATTERNS, index, seed);
    return sizedItem(item, index, size, columns, {
      borderRadius: 18 + (seed % 3) * 2,
      shadow: true,
    });
  });
  return packItems(arranged, columns);
}

export function swapItems(
  items: GalleryLayoutItem[],
  sourceId: string,
  targetId: string
): GalleryLayoutItem[] {
  const source = items.find((item) => item.id === sourceId);
  const target = items.find((item) => item.id === targetId);
  if (!source || !target) return items;

  return items.map((item) => {
    if (item.id === sourceId) {
      return { ...item, x: target.x, y: target.y, order: target.order };
    }
    if (item.id === targetId) {
      return { ...item, x: source.x, y: source.y, order: source.order };
    }
    return item;
  });
}

export function moveItemToPosition(
  items: GalleryLayoutItem[],
  itemId: string,
  x: number,
  y: number,
  columns: number
): GalleryLayoutItem[] {
  const item = items.find((entry) => entry.id === itemId);
  if (!item || item.locked) return items;

  const cols = Math.min(item.colSpan, columns);
  const clampedX = Math.max(1, Math.min(x, columns - cols + 1));
  const clampedY = Math.max(1, y);

  return items.map((entry) =>
    entry.id === itemId ? { ...entry, x: clampedX, y: clampedY } : entry
  );
}

export function resizeItem(
  items: GalleryLayoutItem[],
  itemId: string,
  colSpan: number,
  rowSpan: number,
  columns: number
): GalleryLayoutItem[] {
  const resized = items.map((item) => {
    if (item.id !== itemId || item.locked) return item;
    return {
      ...item,
      colSpan: Math.max(1, Math.min(colSpan, columns)),
      rowSpan: Math.max(1, rowSpan),
    };
  });
  return packItems(resized, columns);
}

/** Move an item to a grid cell and reflow the layout. */
export function dropItemAtPosition(
  items: GalleryLayoutItem[],
  itemId: string,
  x: number,
  y: number,
  columns: number
): GalleryLayoutItem[] {
  const item = items.find((entry) => entry.id === itemId);
  if (!item || item.locked) return items;

  const reordered = items
    .filter((entry) => entry.id !== itemId)
    .sort((a, b) => a.order - b.order);

  const targetIndex = Math.max(
    0,
    Math.min(reordered.length, Math.round((y - 1) * 2 + (x - 1) / columns))
  );

  reordered.splice(targetIndex, 0, {
    ...item,
    x: Math.max(1, x),
    y: Math.max(1, y),
    pinned: true,
  });

  return packItems(
    reordered.map((entry, index) => ({ ...entry, order: index })),
    columns
  );
}

export function getCanvasHeight(items: GalleryLayoutItem[]) {
  if (!items.length) return ROW_HEIGHT * 4;
  const maxRow = Math.max(...items.map((item) => item.y + item.rowSpan - 1));
  return maxRow * (ROW_HEIGHT + GAP) + GAP;
}

export function scaleSpan(
  span: number,
  editorColumns: number,
  targetColumns: number
) {
  return Math.max(1, Math.round((span / editorColumns) * targetColumns));
}

export function scaleItemForViewport(
  item: GalleryLayoutItem,
  fromColumns: number,
  toColumns: number
): GalleryLayoutItem {
  const ratio = toColumns / fromColumns;
  return {
    ...item,
    colSpan: Math.max(1, Math.min(toColumns, Math.round(item.colSpan * ratio))),
    x: Math.max(1, Math.min(toColumns, Math.round(item.x * ratio) || 1)),
  };
}

export function getItemsForViewport(
  items: GalleryLayoutItem[],
  viewport: PreviewViewport
) {
  const columns = VIEWPORT_COLUMNS[viewport];
  return packItems(
    items.map((item) => scaleItemForViewport(item, VIEWPORT_COLUMNS.desktop, columns)),
    columns
  );
}
