export interface SiteSettings {
  siteName: string;
  tagline: string;
  introVideo: string;
  introVideoPortrait?: string;
  introVideoLandscape?: string;
  heroImage: string;
  footerImage: string;
  animationsEnabled: boolean;
  seo: SEOSettings;
  contact: ContactSettings;
  social: SocialLinks;
}

export interface SEOSettings {
  title: string;
  description: string;
  keywords: string[];
  ogImage: string;
  twitterHandle: string;
  canonicalUrl: string;
}

export interface ContactSettings {
  email: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  address: string;
  mapEmbedUrl?: string;
}

export interface SocialLinks {
  instagram: string;
  whatsapp: string;
  email: string;
  phone: string;
}

export interface AboutContent {
  name: string;
  title: string;
  heroSubtitle: string;
  story: string;
  experience: ExperienceItem[];
  achievements: AchievementItem[];
  services: ServiceItem[];
  photographerImage: string;
}

export interface ExperienceItem {
  id: string;
  year: string;
  title: string;
  description: string;
}

export interface AchievementItem {
  id: string;
  value: string;
  label: string;
}

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  coverImage: string;
  order: number;
  featured: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  category: string;
  categoryId?: string;
  albumId?: string;
  albumSlug?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  width: number;
  height: number;
  order: number;
  featured: boolean;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface GalleryVideo {
  id: string;
  src: string;
  thumbnail: string;
  /** Still-frame poster image (baked derivative or admin-selected), if any. */
  poster?: string;
  title: string;
  category: string;
  categoryId?: string;
  albumId?: string;
  albumSlug?: string;
  description?: string;
  duration: string;
  width?: number;
  height?: number;
  orientation?: "landscape" | "portrait" | "square";
  order: number;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  role: "admin" | "editor";
  name: string;
}

export interface NavItem {
  label: string;
  href: string;
  id: string;
}

export type StorageProvider = "local" | "r2";

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
  /** Object ETag from storage (R2/S3) when available. */
  etag: string | null;
  /** SHA-256 hex of file bytes computed locally before upload. */
  checksum: string | null;
}

export interface StorageObjectInfo {
  exists: boolean;
  etag: string | null;
  size: number | null;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  settings: SiteSettings;
  about: AboutContent;
  categories: Category[];
}
