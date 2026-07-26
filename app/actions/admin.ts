"use server";

import { requireAuth } from "@/lib/auth";
import {
  revalidateAdminSurfaces,
  revalidateAfterContentChange,
  revalidateAfterHierarchyChange,
  revalidateAfterMediaChange,
} from "@/lib/revalidation";
import {
  getSettings,
  updateSettings,
  getAboutContent,
  updateAboutContent,
  getCategories,
  updateCategories,
  exportBackup,
  importBackup,
} from "@/lib/services/content";
import { storage, extractStorageKey, getStorageProvider } from "@/lib/storage";
import { validateUploadInput } from "@/lib/storage/validate";
import { readImageDimensions } from "@/lib/storage/image-meta";
import { buildMediaStorageKey } from "@/lib/db/paths";
import {
  createPhoto,
  createVideo,
  deletePhoto,
  deleteVideo,
  getPhotoById,
  getVideoById,
  restorePhoto,
  restoreVideo,
  updatePhoto,
  updateVideo,
  getCategoryBySlug,
  getProjectBySlug,
  getAlbumBySlug,
  createProject,
  updateProject,
  deleteProject,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  listProjects,
  listAlbums,
  listPhotos,
  listVideos,
  paginateProjects,
  paginateAlbums,
  getProjectById,
} from "@/lib/db";
import { logActivity } from "@/lib/services/cms";
import type { SiteSettings, AboutContent, Category, UploadResult } from "@/types";
import type {
  PhotoRecord,
  VideoRecord,
  ProjectRecord,
  AlbumRecord,
  ProjectStatus,
} from "@/lib/db/schema";

function revalidateAdminOnly() {
  revalidateAdminSurfaces();
}

export async function getAdminSettings() {
  await requireAuth();
  return getSettings();
}

export async function saveSettings(data: Partial<SiteSettings>) {
  const session = await requireAuth();
  const result = await updateSettings(data);
  await logActivity("Settings Updated", "settings", "site", session.name);
  revalidateAfterContentChange();
  return result;
}

export async function getAdminAbout() {
  await requireAuth();
  return getAboutContent();
}

export async function saveAbout(data: Partial<AboutContent>) {
  const session = await requireAuth();
  const result = await updateAboutContent(data);
  await logActivity("About Updated", "about", "page", session.name);
  revalidateAfterContentChange();
  return result;
}

export async function getAdminCategories() {
  await requireAuth();
  return getCategories();
}

export async function saveCategories(categories: Category[]) {
  const session = await requireAuth();
  const result = await updateCategories(categories);
  await logActivity("Categories Updated", "categories", "batch", session.name);
  revalidateAfterContentChange();
  revalidateAfterHierarchyChange();
  return result;
}

function assertStorageReady() {
  if (getStorageProvider() !== "r2") return;
  const required = [
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
  ] as const;
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Cloudflare R2 is not configured. Missing: ${missing.join(", ")}. ` +
        `Set STORAGE_PROVIDER=local for local files, or provide all R2 variables.`
    );
  }
}

async function uploadAndPersistGalleryMedia(input: {
  file: File;
  buffer: Buffer;
  category: string;
  projectSlug: string;
  albumSlug: string;
  mediaType: "photo" | "video";
  uploadedBy: string;
}): Promise<UploadResult> {
  const key = buildMediaStorageKey(
    input.category,
    input.projectSlug,
    input.albumSlug,
    input.mediaType,
    input.file.name
  );

  const result = await storage.upload(input.buffer, key, input.file.type);

  const confirmed = await storage.head(result.key);
  if (!confirmed.exists) {
    try {
      await storage.delete(result.key);
    } catch {
      // ignore
    }
    throw new Error(
      `Upload verification failed: "${result.key}" is missing from storage after upload.`
    );
  }

  const title = input.file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
  const generatedFilename = result.key.split("/").pop() ?? null;

  try {
    if (input.mediaType === "photo") {
      const dims = await readImageDimensions(input.buffer);
      const photo = await createPhoto({
        src: result.url,
        url: result.url,
        storageKey: result.key,
        categorySlug: input.category,
        projectSlug: input.projectSlug,
        albumSlug: input.albumSlug,
        title,
        name: title,
        originalFilename: input.file.name,
        generatedFilename,
        mimeType: input.file.type || null,
        size: result.size,
        fileSize: result.size,
        etag: result.etag,
        checksum: result.checksum,
        thumbnail: result.url,
        width: dims.width,
        height: dims.height,
        orientation: dims.orientation,
        uploadedBy: input.uploadedBy,
      });
      await logActivity("Photo Uploaded", "photo", photo.id, input.uploadedBy);
    } else {
      const video = await createVideo({
        src: result.url,
        url: result.url,
        storageKey: result.key,
        categorySlug: input.category,
        projectSlug: input.projectSlug,
        albumSlug: input.albumSlug,
        title,
        name: title,
        originalFilename: input.file.name,
        generatedFilename,
        mimeType: input.file.type || null,
        size: result.size,
        fileSize: result.size,
        etag: result.etag,
        checksum: result.checksum,
        thumbnail: result.url,
        duration: null,
        resolution: null,
        uploadedBy: input.uploadedBy,
      });
      await logActivity("Video Uploaded", "video", video.id, input.uploadedBy);
    }
    revalidateAfterMediaChange(input.category);
  } catch (error) {
    try {
      await storage.delete(result.key);
    } catch (rollbackError) {
      console.error(
        `Upload metadata failed and storage rollback also failed for ${result.key}:`,
        rollbackError
      );
    }
    throw error instanceof Error
      ? error
      : new Error("Failed to save media metadata after upload.");
  }

  return result;
}

export async function uploadFile(formData: FormData) {
  const session = await requireAuth();
  assertStorageReady();

  const file = formData.get("file") as File | null;
  const category = String(formData.get("category") || "").trim();
  const projectSlug =
    String(
      formData.get("projectSlug") || formData.get("clientSlug") || ""
    ).trim() || "general";
  const albumSlug =
    String(
      formData.get("albumSlug") ||
        formData.get("eventSlug") ||
        ""
    ).trim() || "main";
  const siteFolder = String(formData.get("siteFolder") || "").trim();
  const mediaTypeRaw = formData.get("mediaType");
  const mediaType =
    mediaTypeRaw === "photo" || mediaTypeRaw === "video" ? mediaTypeRaw : null;

  if (!category && siteFolder) {
    if (!file) throw new Error("No file provided.");
    const inferredType: "photo" | "video" =
      mediaType ?? (file.type.startsWith("video/") ? "video" : "photo");
    validateUploadInput({
      file,
      category: "site",
      projectSlug: "assets",
      albumSlug: siteFolder,
      mediaType: inferredType,
    });
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = buildMediaStorageKey(
      "site",
      "assets",
      siteFolder,
      inferredType,
      file.name
    );
    const result = await storage.upload(buffer, key, file.type);
    const confirmed = await storage.head(result.key);
    if (!confirmed.exists) {
      try {
        await storage.delete(result.key);
      } catch {
        // ignore
      }
      throw new Error(
        `Upload verification failed: "${result.key}" is missing from storage after upload.`
      );
    }
    await logActivity(
      inferredType === "photo" ? "Photo Uploaded" : "Video Uploaded",
      inferredType,
      result.key,
      session.name
    );
    revalidateAfterContentChange();
    return result;
  }

  validateUploadInput({
    file,
    category,
    projectSlug,
    albumSlug,
    mediaType,
  });

  const categoryRecord = await getCategoryBySlug(category);
  if (!categoryRecord && category !== "site") {
    throw new Error(`Category "${category}" was not found.`);
  }
  const projectRecord = await getProjectBySlug(category, projectSlug);
  if (!projectRecord) {
    throw new Error(
      `Project "${projectSlug}" was not found in category "${category}". Create the project first.`
    );
  }
  const albumRecord = await getAlbumBySlug(category, projectSlug, albumSlug);
  if (!albumRecord) {
    throw new Error(
      `Album "${albumSlug}" was not found for project "${projectSlug}". Create the album first.`
    );
  }

  const buffer = Buffer.from(await file!.arrayBuffer());
  return uploadAndPersistGalleryMedia({
    file: file!,
    buffer,
    category,
    projectSlug,
    albumSlug,
    mediaType: mediaType!,
    uploadedBy: session.name,
  });
}

export async function updateMediaMetadata(
  id: string,
  mediaType: "photo" | "video",
  patch: {
    title?: string;
    name?: string;
    description?: string;
    categorySlug?: string;
    projectSlug?: string;
    albumSlug?: string;
  }
) {
  const session = await requireAuth();

  if (mediaType === "photo") {
    const existing = await getPhotoById(id);
    if (!existing) throw new Error("Photo not found.");

    const nextPatch: Parameters<typeof updatePhoto>[1] = {
      title: patch.title,
      name: patch.name,
      description: patch.description,
    };

    if (patch.categorySlug || patch.projectSlug || patch.albumSlug) {
      const categorySlug = patch.categorySlug ?? existing.categorySlug;
      const projectSlug = patch.projectSlug ?? existing.projectSlug;
      const albumSlug = patch.albumSlug ?? existing.albumSlug;
      const category = await getCategoryBySlug(categorySlug);
      const project = await getProjectBySlug(categorySlug, projectSlug);
      const album = await getAlbumBySlug(categorySlug, projectSlug, albumSlug);
      if (!category) throw new Error(`Category "${categorySlug}" was not found.`);
      if (!project) throw new Error(`Project "${projectSlug}" was not found.`);
      if (!album) throw new Error(`Album "${albumSlug}" was not found.`);
      nextPatch.categorySlug = categorySlug;
      nextPatch.categoryId = category.id;
      nextPatch.projectSlug = project.slug;
      nextPatch.projectId = project.id;
      nextPatch.albumSlug = album.slug;
      nextPatch.albumId = album.id;
    }

    const updated = await updatePhoto(id, nextPatch);
    if (!updated) throw new Error("Photo not found.");
    await logActivity("Photo Updated", "photo", id, session.name);
    revalidateAfterMediaChange(updated.categorySlug);
    return updated;
  }

  const existing = await getVideoById(id);
  if (!existing) throw new Error("Video not found.");

  const nextPatch: Parameters<typeof updateVideo>[1] = {
    title: patch.title,
    name: patch.name,
    description: patch.description,
  };

  if (patch.categorySlug || patch.projectSlug || patch.albumSlug) {
    const categorySlug = patch.categorySlug ?? existing.categorySlug;
    const projectSlug = patch.projectSlug ?? existing.projectSlug;
    const albumSlug = patch.albumSlug ?? existing.albumSlug;
    const category = await getCategoryBySlug(categorySlug);
    const project = await getProjectBySlug(categorySlug, projectSlug);
    const album = await getAlbumBySlug(categorySlug, projectSlug, albumSlug);
    if (!category) throw new Error(`Category "${categorySlug}" was not found.`);
    if (!project) throw new Error(`Project "${projectSlug}" was not found.`);
    if (!album) throw new Error(`Album "${albumSlug}" was not found.`);
    nextPatch.categorySlug = categorySlug;
    nextPatch.categoryId = category.id;
    nextPatch.projectSlug = project.slug;
    nextPatch.projectId = project.id;
    nextPatch.albumSlug = album.slug;
    nextPatch.albumId = album.id;
  }

  const updated = await updateVideo(id, nextPatch);
  if (!updated) throw new Error("Video not found.");
  await logActivity("Video Updated", "video", id, session.name);
  revalidateAfterMediaChange(updated.categorySlug);
  return updated;
}

async function deleteMediaWithRollback(
  id: string,
  mediaType: "photo" | "video",
  userName: string
) {
  if (mediaType === "photo") {
    const photo = await getPhotoById(id);
    if (!photo) throw new Error("Photo not found.");

    const key = photo.storageKey || extractStorageKey(photo.url || photo.src);
    const removed = await deletePhoto(id);
    if (!removed) throw new Error("Photo not found.");

    if (key) {
      try {
        await storage.delete(key);
      } catch (error) {
        await restorePhoto(removed);
        throw new Error(
          `Failed to delete storage object "${key}". Metadata was restored. ${
            error instanceof Error ? error.message : ""
          }`.trim()
        );
      }
    }

    await logActivity("Photo Deleted", "photo", id, userName);
    return { ok: true as const, storageDeleted: Boolean(key) };
  }

  const video = await getVideoById(id);
  if (!video) throw new Error("Video not found.");

  const key = video.storageKey || extractStorageKey(video.url || video.src);
  const removed = await deleteVideo(id);
  if (!removed) throw new Error("Video not found.");

  if (key) {
    try {
      await storage.delete(key);
    } catch (error) {
      await restoreVideo(removed);
      throw new Error(
        `Failed to delete storage object "${key}". Metadata was restored. ${
          error instanceof Error ? error.message : ""
        }`.trim()
      );
    }
  }

  await logActivity("Video Deleted", "video", id, userName);
  return { ok: true as const, storageDeleted: Boolean(key) };
}

export async function deleteMedia(id: string, mediaType: "photo" | "video") {
  const session = await requireAuth();
  assertStorageReady();
  const existing =
    mediaType === "photo" ? await getPhotoById(id) : await getVideoById(id);
  const result = await deleteMediaWithRollback(id, mediaType, session.name);
  revalidateAfterMediaChange(existing?.categorySlug);
  return result;
}

/* ─── Project CRUD ─── */

export async function fetchProjects(filters?: {
  categorySlug?: string;
  status?: ProjectStatus;
  search?: string;
}) {
  await requireAuth();
  return listProjects({ ...filters, includeHidden: true });
}

export async function fetchProjectsPage(input: {
  categorySlug?: string;
  status?: ProjectStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  await requireAuth();
  return paginateProjects({ ...input, includeHidden: true });
}

export async function persistProject(input: {
  categorySlug: string;
  name: string;
  slug?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  eventDate?: string | null;
  shootDate?: string | null;
  deliveryDate?: string | null;
  location?: string;
  status?: ProjectStatus;
  description?: string;
  coverImage?: string;
}) {
  const session = await requireAuth();
  const project = await createProject(input);
  await logActivity("Project Created", "project", project.id, session.name);
  revalidateAfterHierarchyChange(project.categorySlug);
  return project;
}

export async function persistProjectUpdate(
  id: string,
  patch: Partial<
    Pick<
      ProjectRecord,
      | "name"
      | "slug"
      | "clientName"
      | "clientPhone"
      | "clientEmail"
      | "eventDate"
      | "shootDate"
      | "deliveryDate"
      | "location"
      | "status"
      | "description"
      | "coverImage"
      | "hidden"
      | "featured"
    >
  >
) {
  const session = await requireAuth();
  const updated = await updateProject(id, patch);
  if (!updated) throw new Error("Project not found.");
  await logActivity("Project Updated", "project", id, session.name);
  revalidateAfterHierarchyChange(updated.categorySlug);
  return updated;
}

/**
 * Cascade delete: media (JSON + R2) → albums → project.
 * On R2 failure, media metadata is restored and the operation aborts.
 */
export async function removeProject(id: string) {
  const session = await requireAuth();
  assertStorageReady();

  const project = await getProjectById(id);
  if (!project) throw new Error("Project not found.");

  const albums = await listAlbums({ projectId: id, includeHidden: true });
  const [photos, videos] = await Promise.all([
    listPhotos({ projectId: id }),
    listVideos({ projectId: id }),
  ]);

  for (const photo of photos) {
    await deleteMediaWithRollback(photo.id, "photo", session.name);
  }
  for (const video of videos) {
    await deleteMediaWithRollback(video.id, "video", session.name);
  }

  for (const album of albums) {
    await deleteAlbum(album.id);
    await logActivity("Album Deleted", "album", album.id, session.name);
  }

  const removed = await deleteProject(id);
  if (!removed) throw new Error("Project not found.");
  await logActivity("Project Deleted", "project", id, session.name);
  revalidateAfterHierarchyChange(project.categorySlug);
  return removed;
}

/* ─── Album CRUD ─── */

export async function fetchAlbums(input: {
  categorySlug?: string;
  projectId?: string;
  projectSlug?: string;
  search?: string;
}) {
  await requireAuth();
  return listAlbums({ ...input, includeHidden: true });
}

export async function fetchAlbumsPage(input: {
  categorySlug?: string;
  projectId?: string;
  projectSlug?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  await requireAuth();
  return paginateAlbums({ ...input, includeHidden: true });
}

export async function persistAlbum(input: {
  categorySlug: string;
  projectId?: string;
  projectSlug?: string;
  name: string;
  slug?: string;
  description?: string;
}) {
  const session = await requireAuth();
  const album = await createAlbum(input);
  await logActivity("Album Created", "album", album.id, session.name);
  revalidateAfterHierarchyChange(album.categorySlug);
  return album;
}

export async function persistAlbumUpdate(
  id: string,
  patch: Partial<
    Pick<
      AlbumRecord,
      | "name"
      | "slug"
      | "description"
      | "coverImage"
      | "hidden"
      | "published"
      | "featured"
    >
  >
) {
  const session = await requireAuth();
  const updated = await updateAlbum(id, patch);
  if (!updated) throw new Error("Album not found.");
  await logActivity("Album Updated", "album", id, session.name);
  revalidateAfterHierarchyChange(updated.categorySlug);
  return updated;
}

export async function removeAlbum(id: string) {
  const session = await requireAuth();
  assertStorageReady();

  const [photos, videos] = await Promise.all([
    listPhotos({ albumId: id }),
    listVideos({ albumId: id }),
  ]);

  for (const photo of photos) {
    await deleteMediaWithRollback(photo.id, "photo", session.name);
  }
  for (const video of videos) {
    await deleteMediaWithRollback(video.id, "video", session.name);
  }

  const removed = await deleteAlbum(id);
  if (!removed) throw new Error("Album not found.");
  await logActivity("Album Deleted", "album", id, session.name);
  revalidateAfterHierarchyChange(removed.categorySlug);
  return removed;
}

export async function deleteFile(key: string) {
  await requireAuth();
  assertStorageReady();
  await storage.delete(key);
  revalidateAdminOnly();
}

export async function backupData() {
  await requireAuth();
  return exportBackup();
}

export async function restoreData(data: {
  settings?: SiteSettings;
  about?: AboutContent;
  categories?: Category[];
}) {
  const session = await requireAuth();
  const result = await importBackup(data);
  await logActivity("Backup Restored", "backup", "site", session.name);
  revalidateAfterContentChange();
  revalidateAfterHierarchyChange();
  return result;
}

export async function searchAdmin(query: string) {
  await requireAuth();
  const { searchAdminContent } = await import("@/lib/db/search");
  return searchAdminContent(query);
}

export type { PhotoRecord, VideoRecord, ProjectRecord, AlbumRecord };
