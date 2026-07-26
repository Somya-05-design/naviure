import { randomUUID } from "@/lib/uuid";
import type { GalleryVideo } from "@/types";
import type { VideoRecord } from "@/lib/db/schema";
import { readTable, writeTable } from "@/lib/db/client";
import { getCategoryBySlug } from "@/lib/db/categories";
import { getProjectBySlug } from "@/lib/db/projects";
import { getAlbumBySlug } from "@/lib/db/albums";

const FILE = "videos.json";
const DEFAULT_DATE = "2026-01-01T00:00:00.000Z";

function deriveOrientation(
  width: number | null | undefined,
  height: number | null | undefined
): "landscape" | "portrait" | "square" | null {
  if (!width || !height) return null;
  if (width > height) return "landscape";
  if (height > width) return "portrait";
  return "square";
}

/** Serialize JSON read-modify-write to prevent lost updates under concurrent uploads. */
let videoWriteChain: Promise<unknown> = Promise.resolve();

function withVideoLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = videoWriteChain.then(fn, fn);
  videoWriteChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

type RawVideo = Partial<VideoRecord> &
  Partial<GalleryVideo> & {
    category?: string;
    clientId?: string;
    clientSlug?: string;
    eventId?: string;
    eventSlug?: string;
  };

function normalizeVideo(raw: RawVideo, index: number): VideoRecord {
  const categorySlug = raw.categorySlug ?? raw.category ?? "uncategorized";
  const projectSlug = raw.projectSlug ?? raw.clientSlug ?? "general";
  const albumSlug = raw.albumSlug ?? raw.eventSlug ?? "main";
  const src = raw.src ?? raw.url ?? "";
  const title = raw.title ?? raw.name ?? "Untitled video";
  const size = raw.fileSize ?? raw.size ?? 0;
  const createdAt = raw.createdAt ?? raw.uploadedAt ?? DEFAULT_DATE;
  const albumId =
    raw.albumId ??
    raw.eventId ??
    `album-${categorySlug}-${projectSlug}-${albumSlug}`;
  const projectId =
    raw.projectId ?? raw.clientId ?? `project-${categorySlug}-${projectSlug}`;
  const storageKey = raw.storageKey ?? null;
  const generatedFilename =
    raw.generatedFilename ??
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
    duration: raw.duration ?? null,
    resolution: raw.resolution ?? null,
    poster: raw.poster ?? null,
    width: raw.width ?? null,
    height: raw.height ?? null,
    orientation: raw.orientation ?? deriveOrientation(raw.width, raw.height),
    order: raw.order ?? index,
    size,
    mediaType: "video",
    uploadedAt: raw.uploadedAt ?? createdAt,
    uploadedBy: raw.uploadedBy ?? null,
    createdAt,
    updatedAt: raw.updatedAt ?? createdAt,
  };
}

function videoToGallery(video: VideoRecord): GalleryVideo {
  return {
    id: video.id,
    src: video.src || video.url,
    thumbnail: video.thumbnail,
    title: video.title || video.name,
    category: video.categorySlug,
    categoryId: video.categoryId,
    albumId: video.albumId,
    albumSlug: video.albumSlug,
    description: video.description,
    poster: video.poster ?? undefined,
    duration: video.duration ?? "",
    width: video.width ?? undefined,
    height: video.height ?? undefined,
    orientation: video.orientation ?? undefined,
    order: video.order,
    size: video.fileSize,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
  };
}

export async function listVideos(filters?: {
  categorySlug?: string;
  projectSlug?: string;
  projectId?: string;
  albumSlug?: string;
  albumId?: string;
  search?: string;
  sort?: "newest" | "oldest" | "alpha";
}): Promise<VideoRecord[]> {
  const raw = await readTable<RawVideo[]>(FILE, []);
  let videos = raw.map(normalizeVideo);

  if (filters?.categorySlug) {
    videos = videos.filter((v) => v.categorySlug === filters.categorySlug);
  }
  if (filters?.projectId) {
    videos = videos.filter((v) => v.projectId === filters.projectId);
  }
  if (filters?.projectSlug) {
    videos = videos.filter((v) => v.projectSlug === filters.projectSlug);
  }
  if (filters?.albumId) {
    videos = videos.filter((v) => v.albumId === filters.albumId);
  }
  if (filters?.albumSlug) {
    videos = videos.filter((v) => v.albumSlug === filters.albumSlug);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    videos = videos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.categorySlug.toLowerCase().includes(q) ||
        v.projectSlug.toLowerCase().includes(q) ||
        v.albumSlug.toLowerCase().includes(q) ||
        (v.originalFilename?.toLowerCase().includes(q) ?? false)
    );
  }

  switch (filters?.sort) {
    case "oldest":
      videos.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    case "alpha":
      videos.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "newest":
    default:
      videos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return videos;
}

export async function saveVideos(records: VideoRecord[]): Promise<void> {
  await writeTable(FILE, records);
}

export async function createVideo(input: {
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
  duration?: string | null;
  resolution?: string | null;
  poster?: string | null;
  width?: number | null;
  height?: number | null;
  orientation?: "landscape" | "portrait" | "square" | null;
  size?: number;
  fileSize?: number;
  etag?: string | null;
  checksum?: string | null;
  thumbnail?: string;
  uploadedBy?: string | null;
}): Promise<VideoRecord> {
  return withVideoLock(async () => {
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

    const existing = await listVideos({
      categorySlug: input.categorySlug,
      projectSlug: project.slug,
      albumSlug: album.slug,
    });
    const now = new Date().toISOString();
    const title = input.title ?? input.name ?? "Untitled video";
    const fileSize = input.fileSize ?? input.size ?? 0;
    const url = input.url ?? input.src;
    const generatedFilename =
      input.generatedFilename ??
      (input.storageKey ? input.storageKey.split("/").pop() ?? null : null);

    const video: VideoRecord = {
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
      duration: input.duration ?? null,
      resolution: input.resolution ?? null,
      poster: input.poster ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      orientation: input.orientation ?? deriveOrientation(input.width, input.height),
      order: existing.length,
      size: fileSize,
      mediaType: "video",
      uploadedAt: now,
      uploadedBy: input.uploadedBy ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const all = await listVideos();
    await saveVideos([video, ...all]);
    return video;
  });
}

export async function updateVideo(
  id: string,
  patch: Partial<
    Pick<
      VideoRecord,
      | "title"
      | "name"
      | "description"
      | "categorySlug"
      | "categoryId"
      | "projectSlug"
      | "projectId"
      | "albumSlug"
      | "albumId"
      | "duration"
      | "resolution"
      | "poster"
      | "width"
      | "height"
      | "orientation"
      | "order"
      | "thumbnail"
    >
  >
): Promise<VideoRecord | null> {
  return withVideoLock(async () => {
    const videos = await listVideos();
    const index = videos.findIndex((video) => video.id === id);
    if (index < 0) return null;

    const next: VideoRecord = {
      ...videos[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    if (patch.title && !patch.name) next.name = patch.title;
    if (patch.name && !patch.title) next.title = patch.name;

    videos[index] = next;
    await saveVideos(videos);
    return next;
  });
}

export async function getVideoById(id: string): Promise<VideoRecord | null> {
  const videos = await listVideos();
  return videos.find((video) => video.id === id) ?? null;
}

export async function deleteVideo(id: string): Promise<VideoRecord | null> {
  return withVideoLock(async () => {
    const videos = await listVideos();
    const target = videos.find((video) => video.id === id);
    if (!target) return null;
    await saveVideos(videos.filter((video) => video.id !== id));
    return target;
  });
}

export async function restoreVideo(video: VideoRecord): Promise<void> {
  return withVideoLock(async () => {
    const videos = await listVideos();
    if (videos.some((entry) => entry.id === video.id)) return;
    await saveVideos([video, ...videos]);
  });
}

export function toGalleryVideos(records: VideoRecord[]): GalleryVideo[] {
  return records.map(videoToGallery);
}
