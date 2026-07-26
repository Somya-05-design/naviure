"use server";

import { requireAuth } from "@/lib/auth";
import {
  revalidateAfterHierarchyChange,
  revalidateAfterLayoutChange,
  revalidateAdminSurfaces,
} from "@/lib/revalidation";
import {
  getAlbums,
  getCMSCategories,
  getCMSStats,
  getGalleryLayout,
  getGalleryLayouts,
  getVideoLayouts,
  getLayoutKey,
  logActivity,
  saveAlbums,
  saveCMSCategories,
  saveGalleryLayout,
  saveVideoLayout,
  saveImageMetadataMap,
  getImageMetadataMap,
  getBookings,
  getTestimonials,
  getContactMessages,
  getActivityLogs,
  syncCategoryCoverFromLayout,
  syncVideoCategoryCoverFromLayout,
} from "@/lib/services/cms";
import type {
  Album,
  CategoryCMS,
  GalleryLayout,
  ImageMetadata,
} from "@/types/cms";

export async function fetchCMSStats() {
  await requireAuth();
  return getCMSStats();
}

export async function fetchCMSCategories() {
  await requireAuth();
  return getCMSCategories();
}

export async function persistCMSCategories(categories: CategoryCMS[]) {
  const session = await requireAuth();
  const previous = await getCMSCategories();
  const previousIds = new Set(previous.map((item) => item.id));
  const nextIds = new Set(categories.map((item) => item.id));

  const removed = previous.filter((category) => !nextIds.has(category.id));
  if (removed.length > 0) {
    const { listProjects } = await import("@/lib/db/projects");
    for (const category of removed) {
      const linked = await listProjects({
        categorySlug: category.slug,
        includeHidden: true,
      });
      if (linked.length > 0) {
        throw new Error(
          `Cannot delete category "${category.name}" while it still has ${linked.length} project(s). Move or delete those projects first.`
        );
      }
    }
  }

  const saved = await saveCMSCategories(categories);

  for (const category of categories) {
    if (!previousIds.has(category.id)) {
      await logActivity("Category Created", "category", category.id, session.name);
    }
  }

  for (const category of previous) {
    if (!nextIds.has(category.id)) {
      await logActivity("Category Deleted", "category", category.id, session.name);
    }
  }

  const updated = categories.some((category) => {
    const old = previous.find((item) => item.id === category.id);
    return old && JSON.stringify(old) !== JSON.stringify(category);
  });

  if (updated) {
    await logActivity("Category Updated", "categories", "batch", session.name);
  }

  revalidateAfterHierarchyChange();
  return saved;
}

export async function fetchAlbums(categorySlug?: string) {
  await requireAuth();
  return getAlbums(categorySlug);
}

export async function persistAlbums(albums: Album[]) {
  const session = await requireAuth();
  const previous = await getAlbums();
  const previousIds = new Set(previous.map((item) => item.id));
  const nextIds = new Set(albums.map((item) => item.id));

  const saved = await saveAlbums(albums);

  for (const album of albums) {
    if (!previousIds.has(album.id)) {
      await logActivity("Album Created", "album", album.id, session.name);
    }
  }

  for (const album of previous) {
    if (!nextIds.has(album.id)) {
      await logActivity("Album Deleted", "album", album.id, session.name);
    }
  }

  const updated = albums.some((album) => {
    const old = previous.find((item) => item.id === album.id);
    return old && JSON.stringify(old) !== JSON.stringify(album);
  });

  if (updated) {
    await logActivity("Album Updated", "albums", "batch", session.name);
  }

  revalidateAfterHierarchyChange();
  return saved;
}

export async function fetchGalleryLayout(categorySlug: string, albumSlug?: string) {
  await requireAuth();
  return getGalleryLayout(getLayoutKey(categorySlug, albumSlug));
}

export async function fetchGalleryLayouts() {
  await requireAuth();
  return getGalleryLayouts();
}

export async function persistGalleryLayout(layout: GalleryLayout) {
  const session = await requireAuth();
  const saved = await saveGalleryLayout(layout);
  await syncCategoryCoverFromLayout(saved);
  await logActivity("Gallery Layout Saved", "gallery", layout.categorySlug, session.name);
  revalidateAfterLayoutChange(layout.categorySlug);
  return saved;
}

export async function fetchVideoGalleryLayouts() {
  await requireAuth();
  return getVideoLayouts();
}

export async function persistVideoGalleryLayout(layout: GalleryLayout) {
  const session = await requireAuth();
  const saved = await saveVideoLayout(layout);
  await syncVideoCategoryCoverFromLayout(saved);
  await logActivity("Video Layout Saved", "video-gallery", layout.categorySlug, session.name);
  revalidateAfterLayoutChange(layout.categorySlug);
  return saved;
}

export async function fetchImageMetadata() {
  await requireAuth();
  return getImageMetadataMap();
}

export async function persistImageMetadata(map: Record<string, ImageMetadata>) {
  const session = await requireAuth();
  await saveImageMetadataMap(map);
  await logActivity("Image Metadata Updated", "metadata", "batch", session.name);
  revalidateAdminSurfaces();
}

export async function fetchBookings() {
  await requireAuth();
  return getBookings();
}

export async function fetchTestimonials() {
  await requireAuth();
  return getTestimonials();
}

export async function fetchContactMessages() {
  await requireAuth();
  return getContactMessages();
}

export async function persistContactMessageStatus(
  id: string,
  status: "inbox" | "archived" | "replied"
) {
  const session = await requireAuth();
  const { updateContactMessageStatus } = await import("@/lib/services/cms");
  const updated = await updateContactMessageStatus(id, status);
  if (!updated) throw new Error("Message not found.");
  await logActivity("Contact Message Updated", "contact", id, session.name);
  revalidateAdminSurfaces();
  return updated;
}

export async function fetchActivityLogs() {
  await requireAuth();
  return getActivityLogs();
}
