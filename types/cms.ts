import type { GalleryImage } from "./index";

export type GalleryTileSize =
  | "xs"
  | "s"
  | "m"
  | "l"
  | "xl"
  | "hero"
  | "portrait"
  | "landscape"
  | "wide"
  | "tall"
  | "square";

export type GalleryGridType =
  | "classic"
  | "masonry"
  | "pinterest"
  | "editorial"
  | "magazine"
  | "hero-first"
  | "luxury"
  | "custom";

export type LayoutStatus = "draft" | "published";

export type PreviewViewport = "desktop" | "laptop" | "tablet" | "mobile";

export interface GalleryHoverStyle {
  enabled: boolean;
  zoom: boolean;
  blur: boolean;
  grayscale: boolean;
  brightness: number;
  overlay: boolean;
  showCategory: boolean;
  showExplore: boolean;
  opacity: number;
}

export interface CategoryCMS {
  id: string;
  slug: string;
  name: string;
  description: string;
  coverImage: string;
  order: number;
  featured: boolean;
  hidden: boolean;
  color: string;
  seoTitle: string;
  seoDescription: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Album {
  id: string;
  categoryId?: string;
  categorySlug: string;
  /** Parent project (job) — required for hierarchy. */
  projectId?: string;
  projectSlug?: string;
  slug: string;
  name: string;
  description: string;
  coverImage: string;
  order: number;
  featured: boolean;
  published: boolean;
  hidden: boolean;
  seoTitle: string;
  seoDescription: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatusCMS =
  | "upcoming"
  | "in_progress"
  | "editing"
  | "completed"
  | "delivered"
  | "archived";

/** Project / job under a category (booking with embedded client details). */
export interface ProjectCMS {
  id: string;
  categoryId: string;
  categorySlug: string;
  slug: string;
  name: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  eventDate: string | null;
  shootDate: string | null;
  deliveryDate: string | null;
  location: string;
  status: ProjectStatusCMS;
  description: string;
  coverImage: string;
  order: number;
  featured: boolean;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryLayoutFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GalleryLayoutCrop {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface GalleryLayoutItem {
  id: string;
  imageId: string;
  size: GalleryTileSize;
  colSpan: number;
  rowSpan: number;
  x: number;
  y: number;
  order: number;
  frame?: GalleryLayoutFrame;
  crop?: GalleryLayoutCrop;
  pinned?: boolean;
  locked?: boolean;
  hidden?: boolean;
  favorite?: boolean;
  hero?: boolean;
  cover?: boolean;
  featured?: boolean;
  title?: string;
  description?: string;
  alt?: string;
  tags?: string[];
  borderRadius?: number;
  shadow?: boolean;
  animation?: string;
  hoverStyle?: GalleryHoverStyle;
}

export interface ViewportLayoutConfig {
  columns: number;
  items: GalleryLayoutItem[];
}

export interface LayoutVersion {
  id: string;
  label: string;
  createdAt: string;
  gridType: GalleryGridType;
  status: LayoutStatus;
  viewports: Partial<Record<PreviewViewport, ViewportLayoutConfig>>;
}

export interface GalleryLayout {
  categorySlug: string;
  albumSlug?: string;
  gridType: GalleryGridType;
  status: LayoutStatus;
  items: GalleryLayoutItem[];
  viewports?: Partial<Record<PreviewViewport, ViewportLayoutConfig>>;
  versions?: LayoutVersion[];
  updatedAt: string;
}

export interface ImageMetadata {
  imageId: string;
  camera?: string;
  lens?: string;
  iso?: string;
  exposure?: string;
  location?: string;
  description?: string;
  tags: string[];
  altText?: string;
  copyright?: string;
  starred?: boolean;
}

export interface Booking {
  id: string;
  customerName: string;
  customerEmail: string;
  package: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  eventDate: string;
  paymentStatus: "unpaid" | "partial" | "paid";
  notes: string;
  createdAt: string;
}

export interface Testimonial {
  id: string;
  clientName: string;
  quote: string;
  eventType: string;
  featured: boolean;
  published: boolean;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "inbox" | "archived" | "replied";
  createdAt: string;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  user: string;
  createdAt: string;
}

export interface CMSStats {
  photos: number;
  videos: number;
  projects: number;
  albums: number;
  categories: number;
  storageUsedMb: number;
  visitors: number;
  bookings: number;
  uploadsToday: number;
  uploadsThisMonth: number;
}

export interface AdminSearchResult {
  type: "photo" | "video" | "album" | "category" | "project";
  id: string;
  title: string;
  href: string;
  subtitle?: string;
}

export const EDITOR_GRID_COLUMNS = 12;

export const VIEWPORT_COLUMNS: Record<PreviewViewport, number> = {
  desktop: 12,
  laptop: 8,
  tablet: 6,
  mobile: 4,
};

export const VIEWPORT_WIDTHS: Record<PreviewViewport, number> = {
  desktop: 1440,
  laptop: 1280,
  tablet: 768,
  mobile: 390,
};

export const DEFAULT_HOVER_STYLE: GalleryHoverStyle = {
  enabled: true,
  zoom: true,
  blur: false,
  grayscale: false,
  brightness: 100,
  overlay: true,
  showCategory: false,
  showExplore: false,
  opacity: 100,
};

export const TILE_SIZE_PRESETS: Record<
  GalleryTileSize,
  { colSpan: number; rowSpan: number; label: string }
> = {
  xs: { colSpan: 2, rowSpan: 2, label: "Extra Small" },
  s: { colSpan: 2, rowSpan: 3, label: "Small" },
  m: { colSpan: 3, rowSpan: 3, label: "Medium" },
  l: { colSpan: 4, rowSpan: 4, label: "Large" },
  xl: { colSpan: 6, rowSpan: 5, label: "XL" },
  hero: { colSpan: 8, rowSpan: 6, label: "Hero" },
  portrait: { colSpan: 3, rowSpan: 5, label: "Portrait" },
  landscape: { colSpan: 6, rowSpan: 3, label: "Landscape" },
  wide: { colSpan: 8, rowSpan: 3, label: "Wide" },
  tall: { colSpan: 4, rowSpan: 6, label: "Tall" },
  square: { colSpan: 4, rowSpan: 4, label: "Square" },
};

export const GRID_TYPE_LABELS: Record<GalleryGridType, string> = {
  classic: "Classic Grid",
  masonry: "Masonry",
  pinterest: "Pinterest",
  editorial: "Editorial",
  magazine: "Magazine",
  "hero-first": "Hero First",
  luxury: "Luxury",
  custom: "Custom",
};

export function tileSizeFromImage(image: GalleryImage): GalleryTileSize {
  const ratio = image.width / Math.max(image.height, 1);
  if (Math.abs(ratio - 1) < 0.15) return "square";
  if (ratio < 0.75) return "portrait";
  if (ratio > 1.6) return "landscape";
  if (ratio > 1.2) return "wide";
  return "m";
}

export function normalizeLayoutItem(
  item: Partial<GalleryLayoutItem> & Pick<GalleryLayoutItem, "id" | "imageId">
): GalleryLayoutItem {
  const size = item.size ?? "m";
  const preset = TILE_SIZE_PRESETS[size];
  return {
    id: item.id,
    imageId: item.imageId,
    size,
    colSpan: item.colSpan ?? preset.colSpan,
    rowSpan: item.rowSpan ?? preset.rowSpan,
    x: item.x ?? 1,
    y: item.y ?? 1,
    order: item.order ?? 0,
    pinned: item.pinned ?? false,
    locked: item.locked ?? false,
    hidden: item.hidden ?? false,
    favorite: item.favorite ?? false,
    hero: item.hero ?? false,
    cover: item.cover ?? false,
    featured: item.featured ?? false,
    title: item.title ?? "",
    description: item.description ?? "",
    alt: item.alt ?? "",
    tags: item.tags ?? [],
    borderRadius: item.borderRadius ?? 18,
    shadow: item.shadow ?? true,
    animation: item.animation ?? "fade",
    hoverStyle: item.hoverStyle ?? { ...DEFAULT_HOVER_STYLE },
  };
}

export function createDefaultLayout(
  categorySlug: string,
  items: GalleryLayoutItem[]
): GalleryLayout {
  return {
    categorySlug,
    gridType: "custom",
    status: "draft",
    items,
    viewports: {
      desktop: { columns: VIEWPORT_COLUMNS.desktop, items },
      laptop: { columns: VIEWPORT_COLUMNS.laptop, items: scaleItemsForViewport(items, "laptop") },
      tablet: { columns: VIEWPORT_COLUMNS.tablet, items: scaleItemsForViewport(items, "tablet") },
      mobile: { columns: VIEWPORT_COLUMNS.mobile, items: scaleItemsForViewport(items, "mobile") },
    },
    versions: [],
    updatedAt: new Date().toISOString(),
  };
}

export function scaleItemsForViewport(
  items: GalleryLayoutItem[],
  viewport: PreviewViewport
): GalleryLayoutItem[] {
  const fromCols = VIEWPORT_COLUMNS.desktop;
  const toCols = VIEWPORT_COLUMNS[viewport];
  const ratio = toCols / fromCols;

  return items.map((item) => ({
    ...item,
    colSpan: Math.max(1, Math.min(toCols, Math.round(item.colSpan * ratio))),
    rowSpan: Math.max(1, item.rowSpan),
    x: Math.max(1, Math.min(toCols, Math.round(item.x * ratio) || 1)),
  }));
}

export function migrateLegacyLayout(layout: GalleryLayout): GalleryLayout {
  const items = (layout.items ?? []).map((item, index) =>
    normalizeLayoutItem({
      ...item,
      x: item.x ?? 1,
      y: item.y ?? ((index + 1) * 2),
      order: item.order ?? index,
    })
  );

  return {
    ...layout,
    gridType: layout.gridType ?? "custom",
    status: layout.status ?? "published",
    items,
    viewports: layout.viewports ?? {
      desktop: { columns: VIEWPORT_COLUMNS.desktop, items },
      laptop: {
        columns: VIEWPORT_COLUMNS.laptop,
        items: scaleItemsForViewport(items, "laptop"),
      },
      tablet: {
        columns: VIEWPORT_COLUMNS.tablet,
        items: scaleItemsForViewport(items, "tablet"),
      },
      mobile: {
        columns: VIEWPORT_COLUMNS.mobile,
        items: scaleItemsForViewport(items, "mobile"),
      },
    },
    versions: layout.versions ?? [],
  };
}
