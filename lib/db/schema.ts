/** Canonical table shapes — JSON-backed today, SQL-ready tomorrow.
 *
 * Hierarchy: Category → Project (Job) → Album → Media (Photos / Videos)
 *
 * A Project is a photography booking/job. Client contact fields live on the
 * project — the same person booking again creates a new project.
 */

export type EntityStatus = "active" | "hidden" | "draft";

export type ProjectStatus =
  | "upcoming"
  | "in_progress"
  | "editing"
  | "completed"
  | "delivered"
  | "archived";

export interface CategoryRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  coverImage: string;
  order: number;
  featured: boolean;
  hidden: boolean;
  status: EntityStatus;
  color: string;
  seoTitle: string;
  seoDescription: string;
  createdAt: string;
  updatedAt: string;
}

/** Project / job under a category (booking with embedded client details). */
export interface ProjectRecord {
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
  status: ProjectStatus;
  description: string;
  coverImage: string;
  order: number;
  featured: boolean;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Custom album under a project (Haldi, Ceremony, Highlights…). Never hardcoded. */
export interface AlbumRecord {
  id: string;
  categoryId: string;
  categorySlug: string;
  projectId: string;
  projectSlug: string;
  slug: string;
  name: string;
  description: string;
  coverImage: string;
  order: number;
  featured: boolean;
  published: boolean;
  hidden: boolean;
  status: EntityStatus;
  seoTitle: string;
  seoDescription: string;
  createdAt: string;
  updatedAt: string;
}

export type MediaType = "photo" | "video";

interface MediaBase {
  id: string;
  categoryId: string;
  categorySlug: string;
  projectId: string;
  projectSlug: string;
  albumId: string;
  albumSlug: string;
  name: string;
  title: string;
  description: string;
  originalFilename: string | null;
  generatedFilename: string | null;
  url: string;
  src: string;
  storageKey: string | null;
  mimeType: string | null;
  fileSize: number;
  etag: string | null;
  checksum: string | null;
  thumbnail: string;
  order: number;
  size: number;
  uploadedAt: string;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoRecord extends MediaBase {
  width: number | null;
  height: number | null;
  orientation: number | null;
  featured: boolean;
  mediaType: "photo";
}

export interface VideoRecord extends MediaBase {
  duration: string | null;
  resolution: string | null;
  /** Admin-selected or generated poster image (still frame) URL. */
  poster: string | null;
  width: number | null;
  height: number | null;
  orientation: "landscape" | "portrait" | "square" | null;
  mediaType: "video";
}

export interface ActivityRecord {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  user: string;
  createdAt: string;
}

export interface SiteAnalytics {
  totalVisitors: number;
  updatedAt: string;
}

export interface CategoryStats {
  id: string;
  projectCount: number;
  albumCount: number;
  photoCount: number;
  videoCount: number;
}

export interface ProjectStats {
  id: string;
  albumCount: number;
  photoCount: number;
  videoCount: number;
  storageUsedBytes: number;
}

export interface AlbumStats {
  id: string;
  photoCount: number;
  videoCount: number;
}

export interface DashboardStats {
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

export interface MonthlyUploadStat {
  month: string;
  label: string;
  photos: number;
  videos: number;
  total: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
