import type { GalleryImage } from "@/types";
import type { GalleryLayoutFrame, GalleryLayoutItem } from "@/types/cms";
import { normalizeLayoutItem } from "@/types/cms";
import { randomUUID } from "@/lib/uuid";

export const MASONRY_CANVAS_WIDTH = 1200;
export const MASONRY_GAP = 12;
export const MASONRY_MIN_SIZE = 180;
export const MASONRY_SNAP_THRESHOLD = 8;

export type MasonryFrame = GalleryLayoutFrame;

export interface MasonryPlacedItem {
  id: string;
  frame: MasonryFrame;
  order: number;
  pinned?: boolean;
}

type SkylineSegment = { x: number; w: number; y: number };

function clampSize(value: number, min = MASONRY_MIN_SIZE) {
  return Math.max(min, value);
}

function clampFrame(frame: MasonryFrame, canvasWidth: number): MasonryFrame {
  const w = clampSize(Math.min(frame.w, canvasWidth));
  const h = clampSize(frame.h);
  const x = Math.max(0, Math.min(frame.x, canvasWidth - w));
  const y = Math.max(0, frame.y);
  return { x, y, w, h };
}

function skylineHeight(segments: SkylineSegment[], x: number, w: number) {
  let maxY = 0;
  for (const seg of segments) {
    if (seg.x + seg.w <= x || seg.x >= x + w) continue;
    maxY = Math.max(maxY, seg.y);
  }
  return maxY;
}

function mergeSkyline(segments: SkylineSegment[]) {
  if (!segments.length) return [{ x: 0, w: MASONRY_CANVAS_WIDTH, y: 0 }];
  const sorted = [...segments].sort((a, b) => a.x - b.x);
  const merged: SkylineSegment[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const seg = sorted[i];
    if (seg.x <= last.x + last.w) {
      last.w = Math.max(last.w, seg.x + seg.w - last.x);
      last.y = Math.max(last.y, seg.y);
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

function addRectToSkyline(
  segments: SkylineSegment[],
  rect: MasonryFrame,
  gap: number
) {
  const bottom = rect.y + rect.h + gap;
  const next: SkylineSegment[] = [];

  for (const seg of segments) {
    if (seg.x + seg.w <= rect.x || seg.x >= rect.x + rect.w) {
      next.push({ ...seg });
      continue;
    }
    if (seg.x < rect.x) {
      next.push({ x: seg.x, w: rect.x - seg.x, y: seg.y });
    }
    if (seg.x + seg.w > rect.x + rect.w) {
      next.push({
        x: rect.x + rect.w,
        w: seg.x + seg.w - (rect.x + rect.w),
        y: seg.y,
      });
    }
  }

  next.push({ x: rect.x, w: rect.w, y: bottom });
  return mergeSkyline(next);
}

function findBestPosition(
  w: number,
  h: number,
  segments: SkylineSegment[],
  canvasWidth: number
) {
  let bestX = 0;
  let bestY = Number.POSITIVE_INFINITY;
  const step = Math.max(4, Math.floor(w / 12));

  for (let x = 0; x <= canvasWidth - w; x += step) {
    const y = skylineHeight(segments, x, w);
    const placedY = y === 0 ? 0 : y;
    if (placedY < bestY) {
      bestY = placedY;
      bestX = x;
    }
  }

  return { x: bestX, y: bestY === Number.POSITIVE_INFINITY ? 0 : bestY };
}

export function defaultFrameForImage(
  image: GalleryImage,
  canvasWidth = MASONRY_CANVAS_WIDTH
): MasonryFrame {
  const ratio = image.width / Math.max(image.height, 1);
  let w = canvasWidth * 0.34;
  if (ratio > 1.45) w = canvasWidth * 0.62;
  else if (ratio > 1.1) w = canvasWidth * 0.48;
  else if (ratio < 0.72) w = canvasWidth * 0.28;
  else if (ratio < 0.92) w = canvasWidth * 0.32;

  w = clampSize(Math.min(w, canvasWidth));
  const h = clampSize(w / ratio);
  return { x: 0, y: 0, w, h };
}

export function gridItemToFrame(
  item: GalleryLayoutItem,
  canvasWidth: number,
  columns = 12,
  rowHeight = 72,
  gap = MASONRY_GAP
): MasonryFrame {
  if (item.frame) return { ...item.frame };
  const colWidth = (canvasWidth - gap * (columns - 1)) / columns;
  return {
    x: (item.x - 1) * (colWidth + gap),
    y: (item.y - 1) * (rowHeight + gap),
    w: Math.max(
      MASONRY_MIN_SIZE,
      item.colSpan * colWidth + (item.colSpan - 1) * gap
    ),
    h: Math.max(
      MASONRY_MIN_SIZE,
      item.rowSpan * rowHeight + (item.rowSpan - 1) * gap
    ),
  };
}

export function ensureItemFrame(
  item: GalleryLayoutItem,
  image?: GalleryImage,
  canvasWidth = MASONRY_CANVAS_WIDTH
): GalleryLayoutItem {
  if (item.frame) return item;
  const frame = image
    ? defaultFrameForImage(image, canvasWidth)
    : gridItemToFrame(item, canvasWidth);
  return { ...item, frame };
}

export function reflowMasonry(
  items: MasonryPlacedItem[],
  canvasWidth = MASONRY_CANVAS_WIDTH,
  gap = MASONRY_GAP,
  options?: {
    anchor?: { id: string; frame: MasonryFrame };
    dragPreview?: { id: string; frame: MasonryFrame };
  }
): MasonryPlacedItem[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  let segments: SkylineSegment[] = [{ x: 0, w: canvasWidth, y: 0 }];
  const placed: MasonryPlacedItem[] = [];

  const anchorId = options?.anchor?.id ?? options?.dragPreview?.id;
  const anchorFrame =
    options?.anchor?.frame ?? options?.dragPreview?.frame ?? null;

  if (anchorId && anchorFrame) {
    const anchor = sorted.find((item) => item.id === anchorId);
    if (anchor) {
      const frame = clampFrame(anchorFrame, canvasWidth);
      placed.push({ ...anchor, frame });
      segments = addRectToSkyline(segments, frame, gap);
    }
  }

  for (const item of sorted) {
    if (item.id === anchorId) continue;

    if (item.pinned) {
      const frame = clampFrame(item.frame, canvasWidth);
      placed.push({ ...item, frame });
      segments = addRectToSkyline(segments, frame, gap);
      continue;
    }

    const pos = findBestPosition(item.frame.w, item.frame.h, segments, canvasWidth);
    const frame = clampFrame(
      {
        x: pos.x,
        y: pos.y,
        w: item.frame.w,
        h: item.frame.h,
      },
      canvasWidth
    );
    placed.push({ ...item, frame });
    segments = addRectToSkyline(segments, frame, gap);
  }

  return placed.sort((a, b) => a.order - b.order);
}

export function itemsToMasonry(
  items: GalleryLayoutItem[],
  photos: Map<string, GalleryImage>,
  canvasWidth = MASONRY_CANVAS_WIDTH
): MasonryPlacedItem[] {
  return items.map((item) => {
    const image = photos.get(item.imageId);
    const withFrame = ensureItemFrame(item, image, canvasWidth);
    return {
      id: withFrame.id,
      order: withFrame.order,
      pinned: withFrame.pinned,
      frame: withFrame.frame!,
    };
  });
}

export function masonryToItems(
  placed: MasonryPlacedItem[],
  original: GalleryLayoutItem[]
): GalleryLayoutItem[] {
  const map = new Map(original.map((item) => [item.id, item]));
  return placed.map((entry) => ({
    ...map.get(entry.id)!,
    frame: entry.frame,
    order: entry.order,
    pinned: entry.pinned,
  }));
}

export function getMasonryCanvasHeight(
  items: MasonryPlacedItem[] | GalleryLayoutItem[],
  gap = MASONRY_GAP
) {
  if (!items.length) return 640;
  let max = 0;
  for (const item of items) {
    const frame = "frame" in item && item.frame ? item.frame : null;
    if (!frame) continue;
    max = Math.max(max, frame.y + frame.h);
  }
  return max + gap * 4;
}

export function insertMasonryItem(
  items: MasonryPlacedItem[],
  newItem: MasonryPlacedItem,
  canvasWidth = MASONRY_CANVAS_WIDTH,
  gap = MASONRY_GAP
) {
  const next = [...items, newItem].map((item, index) => ({
    ...item,
    order: index,
  }));
  return reflowMasonry(next, canvasWidth, gap);
}

export function reorderAtPoint(
  items: MasonryPlacedItem[],
  draggedId: string,
  point: { x: number; y: number },
  canvasWidth = MASONRY_CANVAS_WIDTH,
  gap = MASONRY_GAP
) {
  const dragged = items.find((item) => item.id === draggedId);
  if (!dragged) return items;

  const others = items
    .filter((item) => item.id !== draggedId)
    .sort((a, b) => a.order - b.order);

  let insertIndex = others.length;
  for (let i = 0; i < others.length; i++) {
    const o = others[i];
    const cy = o.frame.y + o.frame.h / 2;
    if (point.y < cy) {
      insertIndex = i;
      break;
    }
  }

  const reordered = [...others];
  reordered.splice(insertIndex, 0, dragged);
  const normalized = reordered.map((item, index) => ({ ...item, order: index }));

  return reflowMasonry(normalized, canvasWidth, gap, {
    dragPreview: { id: draggedId, frame: dragged.frame },
  });
}

export interface SnapResult {
  frame: MasonryFrame;
  guides: { vertical: number[]; horizontal: number[] };
}

export function snapFrame(
  frame: MasonryFrame,
  others: MasonryPlacedItem[],
  canvasWidth = MASONRY_CANVAS_WIDTH
): SnapResult {
  const threshold = MASONRY_SNAP_THRESHOLD;
  const guides = { vertical: [] as number[], horizontal: [] as number[] };
  let { x, y } = frame;
  const { w, h } = frame;

  const targetsX = [0, canvasWidth / 2 - w / 2, canvasWidth - w];
  const targetsY = [0];
  const edges = {
    left: x,
    right: x + w,
    top: y,
    bottom: y + h,
    cx: x + w / 2,
    cy: y + h / 2,
  };

  for (const other of others) {
    const f = other.frame;
    targetsX.push(f.x, f.x + f.w - w, f.x + f.w / 2 - w / 2);
    targetsY.push(f.y, f.y + f.h - h, f.y + f.h / 2 - h / 2);
  }

  for (const tx of targetsX) {
    if (Math.abs(x - tx) <= threshold) {
      x = tx;
      guides.vertical.push(tx);
      break;
    }
  }

  for (const ty of targetsY) {
    if (Math.abs(y - ty) <= threshold) {
      y = ty;
      guides.horizontal.push(ty);
      break;
    }
  }

  // Edge snapping
  for (const other of others) {
    const f = other.frame;
    const pairs: [number, number][] = [
      [edges.left, f.x],
      [edges.right, f.x + f.w],
      [edges.left, f.x + f.w],
      [edges.right, f.x],
      [edges.top, f.y],
      [edges.bottom, f.y + f.h],
    ];
    for (const [a, b] of pairs) {
      if (Math.abs(a - b) <= threshold) {
        if (a === edges.left || a === edges.right) {
          x += b - a;
          guides.vertical.push(b);
        } else {
          y += b - a;
          guides.horizontal.push(b);
        }
      }
    }
  }

  return {
    frame: clampFrame({ x, y, w, h }, canvasWidth),
    guides: {
      vertical: [...new Set(guides.vertical)],
      horizontal: [...new Set(guides.horizontal)],
    },
  };
}

export function applyFrameResize(
  start: MasonryFrame,
  handle: string,
  dx: number,
  dy: number,
  aspectRatio: number,
  canvasWidth = MASONRY_CANVAS_WIDTH
): MasonryFrame {
  let { x, y, w, h } = start;

  if (handle.includes("e")) w = start.w + dx;
  if (handle.includes("w")) {
    w = start.w - dx;
    x = start.x + dx;
  }
  if (handle.includes("s")) h = start.h + dy;
  if (handle.includes("n")) {
    h = start.h - dy;
    y = start.y + dy;
  }

  // Corner handles preserve aspect ratio
  if (handle.length === 2) {
    if (Math.abs(dx) > Math.abs(dy)) {
      h = w / aspectRatio;
      if (handle.includes("n")) y = start.y + start.h - h;
    } else {
      w = h * aspectRatio;
      if (handle.includes("w")) x = start.x + start.w - w;
    }
  }

  w = clampSize(w);
  h = clampSize(h);

  if (x + w > canvasWidth) {
    if (handle.includes("w")) x = canvasWidth - w;
    else w = canvasWidth - x;
  }
  if (x < 0) x = 0;
  if (y < 0) y = 0;

  return clampFrame({ x, y, w, h }, canvasWidth);
}

export function buildMasonryLayout(
  images: GalleryImage[],
  canvasWidth = MASONRY_CANVAS_WIDTH,
  gap = MASONRY_GAP
): GalleryLayoutItem[] {
  const masonry: MasonryPlacedItem[] = images.map((image, index) => ({
    id: randomUUID(),
    order: index,
    frame: defaultFrameForImage(image, canvasWidth),
  }));

  const packed = reflowMasonry(masonry, canvasWidth, gap);
  return packed.map((entry, index) =>
    normalizeLayoutItem({
      id: entry.id,
      imageId: images[index].id,
      order: index,
      frame: entry.frame,
      alt: images[index].alt,
    })
  );
}

/* ------------------------------------------------------------------ */
/* Visual size presets — width as a fraction of the canvas, height    */
/* derived from the photo aspect ratio so photos never distort.       */
/* ------------------------------------------------------------------ */

export type FrameSizePreset = "small" | "wide" | "tall" | "square" | "hero";

const PRESET_WIDTH_FRACTION: Record<FrameSizePreset, number> = {
  small: 0.24,
  wide: 0.5,
  tall: 0.3,
  square: 0.32,
  hero: 0.66,
};

export function resizeFrameToPreset(
  frame: MasonryFrame,
  preset: FrameSizePreset,
  aspectRatio: number,
  canvasWidth = MASONRY_CANVAS_WIDTH
): MasonryFrame {
  const safeRatio = aspectRatio > 0 ? aspectRatio : 1;
  const w = clampSize(Math.min(canvasWidth * PRESET_WIDTH_FRACTION[preset], canvasWidth));

  let h: number;
  switch (preset) {
    case "square":
      h = w;
      break;
    case "tall":
      h = Math.max(w / safeRatio, w * 1.35);
      break;
    case "wide":
      h = Math.min(w / safeRatio, w * 0.62);
      break;
    case "hero":
      h = Math.min(w / safeRatio, w * 0.66);
      break;
    default:
      h = w / safeRatio;
  }

  return clampFrame({ x: frame.x, y: frame.y, w, h: clampSize(h) }, canvasWidth);
}

/* ------------------------------------------------------------------ */
/* Auto Arrange — curated layouts. Each generator assigns a frame per  */
/* photo, then the skyline packer settles everything gap-free.         */
/* ------------------------------------------------------------------ */

export type AutoArrangeStyle =
  | "balanced"
  | "luxury"
  | "editorial"
  | "pinterest"
  | "magazine"
  | "instagram"
  | "hero"
  | "storytelling";

export const AUTO_ARRANGE_STYLES: { id: AutoArrangeStyle; label: string }[] = [
  { id: "balanced", label: "Balanced" },
  { id: "luxury", label: "Luxury Wedding" },
  { id: "editorial", label: "Editorial" },
  { id: "pinterest", label: "Pinterest" },
  { id: "magazine", label: "Magazine" },
  { id: "instagram", label: "Instagram" },
  { id: "hero", label: "Hero" },
  { id: "storytelling", label: "Storytelling" },
];

function frameFromWidth(
  width: number,
  ratio: number,
  cap = MASONRY_CANVAS_WIDTH
): MasonryFrame {
  const w = clampSize(Math.min(width, cap));
  const h = clampSize(w / (ratio > 0 ? ratio : 1));
  return { x: 0, y: 0, w, h };
}

export function autoArrangeItems(
  items: GalleryLayoutItem[],
  photos: Map<string, GalleryImage>,
  style: AutoArrangeStyle,
  canvasWidth = MASONRY_CANVAS_WIDTH,
  gap = MASONRY_GAP
): GalleryLayoutItem[] {
  const ordered = [...items].sort((a, b) => a.order - b.order);
  const ratioFor = (item: GalleryLayoutItem) => {
    const img = photos.get(item.imageId);
    return img ? img.width / Math.max(img.height, 1) : 1;
  };

  const cw = canvasWidth;
  const half = (cw - gap) / 2;
  const third = (cw - gap * 2) / 3;

  const framed = ordered.map((item, index) => {
    const ratio = ratioFor(item);
    let frame: MasonryFrame;

    switch (style) {
      case "instagram": {
        frame = { x: 0, y: 0, w: third, h: third };
        break;
      }
      case "pinterest": {
        frame = frameFromWidth(third, ratio);
        break;
      }
      case "hero": {
        frame = index === 0 ? frameFromWidth(cw, ratio) : frameFromWidth(third, ratio);
        break;
      }
      case "magazine": {
        const mod = index % 5;
        const width = mod === 0 ? cw * 0.62 : mod === 1 ? cw * 0.38 - gap : half;
        frame = frameFromWidth(width, ratio);
        break;
      }
      case "editorial": {
        frame = index % 3 === 0 ? frameFromWidth(cw, ratio) : frameFromWidth(half, ratio);
        break;
      }
      case "luxury": {
        if (index === 0) frame = frameFromWidth(cw, ratio);
        else if (index % 4 === 1) frame = frameFromWidth(half, ratio);
        else frame = frameFromWidth(third, ratio);
        break;
      }
      case "storytelling": {
        const wide = index % 2 === 0;
        frame = frameFromWidth(wide ? cw * 0.72 : cw * 0.4, ratio);
        break;
      }
      case "balanced":
      default: {
        const width = ratio > 1.3 ? half : ratio < 0.85 ? third : half * 0.9;
        frame = frameFromWidth(width, ratio);
        break;
      }
    }

    return {
      id: item.id,
      order: index,
      pinned: false,
      frame,
    } as MasonryPlacedItem;
  });

  const packed = reflowMasonry(framed, canvasWidth, gap);
  const byId = new Map(ordered.map((item) => [item.id, item]));
  return packed
    .sort((a, b) => a.order - b.order)
    .map((entry, index) => ({
      ...byId.get(entry.id)!,
      frame: entry.frame,
      order: index,
      pinned: false,
    }));
}
