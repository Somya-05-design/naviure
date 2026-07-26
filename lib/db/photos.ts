import { randomUUID } from "@/lib/uuid";
import type { GalleryImage } from "@/types";
import type { PhotoRecord } from "@/lib/db/schema";
import { readTable, writeTable } from "@/lib/db/client";
import { getCategoryBySlug } from "@/lib/db/categories";
import { getProjectBySlug } from "@/lib/db/projects";
import { getAlbumBySlug } from "@/lib/db/albums";

const FILE = "photos.json";
const DEFAULT_DATE = "2026-01-01T00:00:00.000Z";

/** Serialize JSON read-modify-write to prevent lost updates under concurrent uploads. */
let photoWriteChain: Promise<unknown> = Promise.resolve();

function withPhotoLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = photoWriteChain.then(fn, fn);
  photoWriteChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

type RawPhoto = Partial<PhotoRecord> &
  Partial<GalleryImage> & {
    category?: string;
    alt?: string;
    /** Legacy hierarchy fields */
    clientId?: string;
    clientSlug?: string;
    eventId?: string;
    eventSlug?: string;
  };

function normalizePhoto(raw: RawPhoto, index: number): PhotoRecord {
  const categorySlug = raw.categorySlug ?? raw.category ?? "uncategorized";
  const projectSlug = raw.projectSlug ?? raw.clientSlug ?? "general";
  const albumSlug = raw.albumSlug ?? raw.eventSlug ?? "main";
  const src = raw.src ?? raw.url ?? "";
  const title = raw.title ?? raw.name ?? raw.alt ?? "Untitled photo";
  const size = raw.fileSize ?? raw.size ?? 0;
  const createdAt = raw.createdAt ?? raw.uploadedAt ?? DEFAULT_DATE;
  const albumId =
    raw.albumId ??
    raw.eventId ??
    `album-${categorySlug}-${projectSlug}-${albumSlug}`;
  const projectId =
    raw.projectId ?? raw.clientId ?? `project-${categorySlug}-${projectSlug}`;
  const storageKey = raw.storageKey ?? null;
  const generatedFilename = raw.generatedFilename ??
    (storageKey ? storageKey.split("/").pop() ?? null : null);

  return {
    id: raw.id ?? randomUUID(),
    categoryId: raw.categoryId ?? categorySlug,
    categorySlug,
    projectId,
    projectSlug,
    albumId,
    albumSlug,
    name: raw.name ?? title,
    title,
    description: raw.description ?? "",
    originalFilename: raw.originalFilename ?? null,
    generatedFilename,
    url: raw.url ?? src,
    src,
    storageKey,
    mimeType: raw.mimeType ?? null,
    fileSize: size,
    etag: raw.etag ?? null,
    checksum: raw.checksum ?? null,
    thumbnail: raw.thumbnail ?? src,
    width: raw.width ?? null,
    height: raw.height ?? null,
    orientation: raw.orientation ?? null,
    order: raw.order ?? index,
    featured: raw.featured ?? false,
    size,
    mediaType: "photo",
    uploadedAt: raw.uploadedAt ?? createdAt,
    uploadedBy: raw.uploadedBy ?? null,
    createdAt,
    updatedAt: raw.updatedAt ?? createdAt,
  };
}

function photoToGalleryImage(photo: PhotoRecord): GalleryImage {
  return {
    id: photo.id,
    src: photo.src || photo.url,
    alt: photo.title || photo.name,
    category: photo.categorySlug,
    categoryId: photo.categoryId,
    albumId: photo.albumId,
    albumSlug: photo.albumSlug,
    title: photo.title,
    description: photo.description,
    thumbnail: photo.thumbnail,
    width: photo.width && photo.width > 0 ? photo.width : 1200,
    height: photo.height && photo.height > 0 ? photo.height : 1600,
    order: photo.order,
    featured: photo.featured,
    size: photo.fileSize,
    createdAt: photo.createdAt,
    updatedAt: photo.updatedAt,
  };
}

export async function listPhotos(filters?: {
  categorySlug?: string;
  projectSlug?: string;
  projectId?: string;
  albumSlug?: string;
  albumId?: string;
  search?: string;
  sort?: "newest" | "oldest" | "alpha";
}): Promise<PhotoRecord[]> {
  const raw = await readTable<RawPhoto[]>(FILE, []);
  let photos = raw.map(normalizePhoto);

  if (filters?.categorySlug) {
    photos = photos.filter((p) => p.categorySlug === filters.categorySlug);
  }
  if (filters?.projectId) {
    photos = photos.filter((p) => p.projectId === filters.projectId);
  }
  if (filters?.projectSlug) {
    photos = photos.filter((p) => p.projectSlug === filters.projectSlug);
  }
  if (filters?.albumId) {
    photos = photos.filter((p) => p.albumId === filters.albumId);
  }
  if (filters?.albumSlug) {
    photos = photos.filter((p) => p.albumSlug === filters.albumSlug);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    photos = photos.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.categorySlug.toLowerCase().includes(q) ||
        p.projectSlug.toLowerCase().includes(q) ||
        p.albumSlug.toLowerCase().includes(q) ||
        (p.originalFilename?.toLowerCase().includes(q) ?? false)
    );
  }

  switch (filters?.sort) {
    case "oldest":
      photos.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    case "alpha":
      photos.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "newest":
    default:
      photos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return photos;
}

export async function savePhotos(records: PhotoRecord[]): Promise<void> {
  await writeTable(FILE, records);
}

export async function createPhoto(input: {
  src: string;
  url?: string;
  storageKey?: string | null;
  categorySlug: string;
  projectSlug: string;
  albumSlug: string;
  title?: string;
  name?: string;
  description?: string;
  originalFilename?: string | null;
  generatedFilename?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  orientation?: number | null;
  featured?: boolean;
  size?: number;
  fileSize?: number;
  etag?: string | null;
  checksum?: string | null;
  thumbnail?: string;
  uploadedBy?: string | null;
}): Promise<PhotoRecord> {
  return withPhotoLock(async () => {
    const category = await getCategoryBySlug(input.categorySlug);
    if (!category) throw new Error(`Category "${input.categorySlug}" not found.`);

    const project = await getProjectBySlug(input.categorySlug, input.projectSlug);
    if (!project) throw new Error(`Project "${input.projectSlug}" not found.`);

    const album = await getAlbumBySlug(
      input.categorySlug,
      input.projectSlug,
      input.albumSlug
    );
    if (!album) {
      throw new Error(
        `Album "${input.albumSlug}" was not found for project "${input.projectSlug}".`
      );
    }

    const existing = await listPhotos({
      categorySlug: input.categorySlug,
      projectSlug: project.slug,
      albumSlug: album.slug,
    });
    const now = new Date().toISOString();
    const title = input.title ?? input.name ?? "Untitled photo";
    const fileSize = input.fileSize ?? input.size ?? 0;
    const url = input.url ?? input.src;
    const generatedFilename =
      input.generatedFilename ??
      (input.storageKey ? input.storageKey.split("/").pop() ?? null : null);

    const photo: PhotoRecord = {
      id: randomUUID(),
      categoryId: category.id,
      categorySlug: input.categorySlug,
      projectId: project.id,
      projectSlug: project.slug,
      albumId: album.id,
      albumSlug: album.slug,
      name: input.name ?? title,
      title,
      description: input.description ?? "",
      originalFilename: input.originalFilename ?? null,
      generatedFilename,
      url,
      src: input.src || url,
      storageKey: input.storageKey ?? null,
      mimeType: input.mimeType ?? null,
      fileSize,
      etag: input.etag ?? null,
      checksum: input.checksum ?? null,
      thumbnail: input.thumbnail ?? url,
      width: input.width ?? null,
      height: input.height ?? null,
      orientation: input.orientation ?? null,
      order: existing.length,
      featured: input.featured ?? existing.length < 3,
      size: fileSize,
      mediaType: "photo",
      uploadedAt: now,
      uploadedBy: input.uploadedBy ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const all = await listPhotos();
    await savePhotos([photo, ...all]);
    return photo;
  });
}

export async function updatePhoto(
  id: string,
  patch: Partial<
    Pick<
      PhotoRecord,
      | "title"
      | "name"
      | "description"
      | "categorySlug"
      | "categoryId"
      | "projectSlug"
      | "projectId"
      | "albumSlug"
      | "albumId"
      | "featured"
      | "order"
      | "thumbnail"
    >
  >
): Promise<PhotoRecord | null> {
  return withPhotoLock(async () => {
    const photos = await listPhotos();
    const index = photos.findIndex((photo) => photo.id === id);
    if (index < 0) return null;

    const next: PhotoRecord = {
      ...photos[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    if (patch.title && !patch.name) next.name = patch.title;
    if (patch.name && !patch.title) next.title = patch.name;

    photos[index] = next;
    await savePhotos(photos);
    return next;
  });
}

export async function getPhotoById(id: string): Promise<PhotoRecord | null> {
  const photos = await listPhotos();
  return photos.find((photo) => photo.id === id) ?? null;
}

export async function deletePhoto(id: string): Promise<PhotoRecord | null> {
  return withPhotoLock(async () => {
    const photos = await listPhotos();
    const target = photos.find((photo) => photo.id === id);
    if (!target) return null;
    await savePhotos(photos.filter((photo) => photo.id !== id));
    return target;
  });
}

export async function restorePhoto(photo: PhotoRecord): Promise<void> {
  return withPhotoLock(async () => {
    const photos = await listPhotos();
    if (photos.some((entry) => entry.id === photo.id)) return;
    await savePhotos([photo, ...photos]);
  });
}

export function toGalleryImages(records: PhotoRecord[]): GalleryImage[] {
  return records.map(photoToGalleryImage);
}
