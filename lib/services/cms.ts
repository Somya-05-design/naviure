import fs from "fs/promises";
import path from "path";
import type { Category } from "@/types";
import type {
  ActivityLogEntry,
  Album,
  Booking,
  CategoryCMS,
  CMSStats,
  ContactMessage,
  GalleryLayout,
  ImageMetadata,
  Testimonial,
} from "@/types/cms";
import { migrateLegacyLayout } from "@/types/cms";
import {
  getDashboardStats,
  getMonthlyUploadStats as dbGetMonthlyUploadStats,
  getRecentMediaUploads,
  listActivity,
  logActivity as dbLogActivity,
} from "@/lib/db";
import { scanGalleryPhotos, scanGalleryVideos, getCategories } from "@/lib/services/content";

const DATA_DIR = path.join(process.cwd(), "data");

async function readJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(path.join(DATA_DIR, filename), "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filename: string, data: T): Promise<void> {
  await fs.writeFile(
    path.join(DATA_DIR, filename),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

function toCategoryCMS(category: Category): CategoryCMS {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    coverImage: category.coverImage,
    order: category.order,
    featured: category.featured,
    hidden: false,
    color: "#0F3D2E",
    seoTitle: category.name,
    seoDescription: category.description,
  };
}

export async function getCMSCategories(): Promise<CategoryCMS[]> {
  const [stored, base] = await Promise.all([
    readJson<CategoryCMS[]>("categories-cms.json", []),
    getCategories(),
  ]);

  if (stored.length > 0) return stored.sort((a, b) => a.order - b.order);

  return base.map(toCategoryCMS).sort((a, b) => a.order - b.order);
}

export async function saveCMSCategories(categories: CategoryCMS[]): Promise<CategoryCMS[]> {
  const sorted = [...categories].sort((a, b) => a.order - b.order);
  await writeJson("categories-cms.json", sorted);

  await writeJson(
    "categories.json",
    sorted.map(
      // Intentionally strip admin-only fields from the public categories file.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ hidden, color, seoTitle, seoDescription, ...cat }) => ({
        ...cat,
        description: seoDescription || cat.description,
      })
    )
  );

  return sorted;
}

export async function getAlbums(categorySlug?: string): Promise<Album[]> {
  const { listAlbums } = await import("@/lib/db/albums");
  const albums = await listAlbums({
    categorySlug,
    includeHidden: true,
  });
  return albums.map((album) => ({
    id: album.id,
    categoryId: album.categoryId,
    categorySlug: album.categorySlug,
    projectId: album.projectId,
    projectSlug: album.projectSlug,
    slug: album.slug,
    name: album.name,
    description: album.description,
    coverImage: album.coverImage,
    order: album.order,
    featured: album.featured,
    published: album.published,
    hidden: album.hidden,
    seoTitle: album.seoTitle,
    seoDescription: album.seoDescription,
    createdAt: album.createdAt,
    updatedAt: album.updatedAt,
  }));
}

export async function saveAlbums(albums: Album[]): Promise<Album[]> {
  const { saveAlbums: saveAlbumRecords } = await import("@/lib/db/albums");
  for (const album of albums) {
    if (!album.projectId || !album.projectSlug) {
      throw new Error(
        `Album "${album.name}" is missing projectId/projectSlug. Create albums under a project via Library.`
      );
    }
  }
  await saveAlbumRecords(
    albums.map((album) => ({
      id: album.id,
      categoryId: album.categoryId ?? album.categorySlug,
      categorySlug: album.categorySlug,
      projectId: album.projectId!,
      projectSlug: album.projectSlug!,
      slug: album.slug,
      name: album.name,
      description: album.description,
      coverImage: album.coverImage,
      order: album.order,
      featured: album.featured,
      published: album.published,
      hidden: album.hidden,
      status: album.hidden ? "hidden" : album.published ? "active" : "draft",
      seoTitle: album.seoTitle,
      seoDescription: album.seoDescription,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
    }))
  );
  return albums;
}

export async function getGalleryLayouts(): Promise<Record<string, GalleryLayout>> {
  return readJson<Record<string, GalleryLayout>>("gallery-layouts.json", {});
}

export async function getVideoLayouts(): Promise<Record<string, GalleryLayout>> {
  return readJson<Record<string, GalleryLayout>>("video-layouts.json", {});
}

export async function getGalleryLayout(key: string): Promise<GalleryLayout | null> {
  const layouts = await getGalleryLayouts();
  const layout = layouts[key];
  return layout ? migrateLegacyLayout(layout) : null;
}

export async function getVideoLayout(key: string): Promise<GalleryLayout | null> {
  const layouts = await getVideoLayouts();
  const layout = layouts[key];
  return layout ? migrateLegacyLayout(layout) : null;
}

export async function saveGalleryLayout(layout: GalleryLayout): Promise<GalleryLayout> {
  const layouts = await getGalleryLayouts();
  const migrated = migrateLegacyLayout(layout);
  layouts[getLayoutKey(migrated.categorySlug, migrated.albumSlug)] = {
    ...migrated,
    updatedAt: new Date().toISOString(),
  };
  await writeJson("gallery-layouts.json", layouts);
  return layouts[getLayoutKey(migrated.categorySlug, migrated.albumSlug)];
}

export async function saveVideoLayout(layout: GalleryLayout): Promise<GalleryLayout> {
  const layouts = await getVideoLayouts();
  const migrated = migrateLegacyLayout(layout);
  layouts[getLayoutKey(migrated.categorySlug, migrated.albumSlug)] = {
    ...migrated,
    updatedAt: new Date().toISOString(),
  };
  await writeJson("video-layouts.json", layouts);
  return layouts[getLayoutKey(migrated.categorySlug, migrated.albumSlug)];
}

export function getLayoutKey(categorySlug: string, albumSlug?: string) {
  return albumSlug ? `${categorySlug}/${albumSlug}` : categorySlug;
}

export async function syncCategoryCoverFromLayout(
  layout: GalleryLayout
): Promise<void> {
  const coverItem = layout.items.find((item) => (item.cover || item.hero) && !item.hidden);
  if (!coverItem) return;

  const photos = await scanGalleryPhotos();
  const photo = photos.find((entry) => entry.id === coverItem.imageId);
  if (!photo) return;

  const categories = await getCMSCategories();
  const hasCategory = categories.some((cat) => cat.slug === layout.categorySlug);
  if (!hasCategory) return;

  await saveCMSCategories(
    categories.map((cat) =>
      cat.slug === layout.categorySlug ? { ...cat, coverImage: photo.src } : cat
    )
  );
}

export async function syncVideoCategoryCoverFromLayout(
  layout: GalleryLayout
): Promise<void> {
  const coverItem = layout.items.find((item) => (item.cover || item.hero) && !item.hidden);
  if (!coverItem) return;

  const videos = await scanGalleryVideos();
  const video = videos.find((entry) => entry.id === coverItem.imageId);
  if (!video) return;

  const categories = await getCMSCategories();
  const hasCategory = categories.some((cat) => cat.slug === layout.categorySlug);
  if (!hasCategory) return;

  await saveCMSCategories(
    categories.map((cat) =>
      cat.slug === layout.categorySlug
        ? { ...cat, coverImage: video.thumbnail }
        : cat
    )
  );
}

export async function getImageMetadataMap(): Promise<Record<string, ImageMetadata>> {
  return readJson<Record<string, ImageMetadata>>("image-metadata.json", {});
}

export async function saveImageMetadataMap(
  map: Record<string, ImageMetadata>
): Promise<void> {
  await writeJson("image-metadata.json", map);
}

export async function getBookings(): Promise<Booking[]> {
  return readJson<Booking[]>("bookings.json", []);
}

export async function getTestimonials(): Promise<Testimonial[]> {
  return readJson<Testimonial[]>("testimonials.json", []);
}

export async function getContactMessages(): Promise<ContactMessage[]> {
  const messages = await readJson<ContactMessage[]>("contact-messages.json", []);
  return messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function appendContactMessage(message: ContactMessage): Promise<void> {
  const messages = await readJson<ContactMessage[]>("contact-messages.json", []);
  messages.unshift(message);
  await writeJson("contact-messages.json", messages);
}

export async function updateContactMessageStatus(
  id: string,
  status: ContactMessage["status"]
): Promise<ContactMessage | null> {
  const messages = await readJson<ContactMessage[]>("contact-messages.json", []);
  const index = messages.findIndex((item) => item.id === id);
  if (index < 0) return null;
  messages[index] = { ...messages[index], status };
  await writeJson("contact-messages.json", messages);
  return messages[index];
}

export interface AdminUserPublic {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function getAdminUsers(): Promise<AdminUserPublic[]> {
  const users = await readJson<
    Array<{ id: string; email: string; name: string; role: string }>
  >("admin-users.json", []);
  return users.map(({ id, email, name, role }) => ({ id, email, name, role }));
}

export async function getActivityLogs(): Promise<ActivityLogEntry[]> {
  return listActivity(200);
}

export async function logActivity(
  action: string,
  entity: string,
  entityId: string,
  user = "Admin"
): Promise<void> {
  await dbLogActivity(action, entity, entityId, user);
}

export async function getCMSStats(): Promise<CMSStats> {
  return getDashboardStats();
}

export async function getRecentUploads(limit = 8) {
  return getRecentMediaUploads(limit);
}

export async function getMonthlyUploadStats() {
  return dbGetMonthlyUploadStats(6);
}
