import { randomUUID } from "@/lib/uuid";
import type { AlbumRecord, EntityStatus, PaginatedResult } from "@/lib/db/schema";
import { readTable, writeTable } from "@/lib/db/client";
import { slugify } from "@/lib/db/paths";
import { getCategoryBySlug } from "@/lib/db/categories";
import { getProjectById, getProjectBySlug } from "@/lib/db/projects";

const FILE = "albums.json";

function albumStatus(album: Pick<AlbumRecord, "hidden" | "published">): EntityStatus {
  if (album.hidden) return "hidden";
  if (!album.published) return "draft";
  return "active";
}

export async function listAlbums(filters?: {
  categorySlug?: string;
  projectId?: string;
  projectSlug?: string;
  search?: string;
  includeHidden?: boolean;
}): Promise<AlbumRecord[]> {
  let albums = await readTable<AlbumRecord[]>(FILE, []);

  if (filters?.categorySlug) {
    albums = albums.filter((a) => a.categorySlug === filters.categorySlug);
  }
  if (filters?.projectId) {
    albums = albums.filter((a) => a.projectId === filters.projectId);
  }
  if (filters?.projectSlug) {
    albums = albums.filter((a) => a.projectSlug === filters.projectSlug);
  }
  if (!filters?.includeHidden) {
    albums = albums.filter((a) => !a.hidden);
  }
  if (filters?.search?.trim()) {
    const q = filters.search.toLowerCase();
    albums = albums.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
  }

  return albums.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export async function paginateAlbums(input: {
  categorySlug?: string;
  projectId?: string;
  projectSlug?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  includeHidden?: boolean;
}): Promise<PaginatedResult<AlbumRecord>> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 50));
  const all = await listAlbums(input);
  const total = all.length;
  const start = (page - 1) * pageSize;
  return {
    items: all.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function saveAlbums(records: AlbumRecord[]): Promise<AlbumRecord[]> {
  const sorted = [...records].sort((a, b) => a.order - b.order);
  await writeTable(
    FILE,
    sorted.map((a) => ({ ...a, status: albumStatus(a) }))
  );
  return sorted;
}

export async function getAlbumById(id: string): Promise<AlbumRecord | null> {
  const albums = await listAlbums({ includeHidden: true });
  return albums.find((a) => a.id === id) ?? null;
}

export async function getAlbumBySlug(
  categorySlug: string,
  projectSlug: string,
  albumSlug: string
): Promise<AlbumRecord | null> {
  const albums = await listAlbums({
    categorySlug,
    projectSlug,
    includeHidden: true,
  });
  return albums.find((a) => a.slug === albumSlug) ?? null;
}

export async function createAlbum(input: {
  categorySlug: string;
  projectId?: string;
  projectSlug?: string;
  name: string;
  slug?: string;
  description?: string;
  coverImage?: string;
  published?: boolean;
}): Promise<AlbumRecord> {
  const category = await getCategoryBySlug(input.categorySlug);
  if (!category) throw new Error(`Category "${input.categorySlug}" not found.`);

  const project = input.projectId
    ? await getProjectById(input.projectId)
    : input.projectSlug
      ? await getProjectBySlug(input.categorySlug, input.projectSlug)
      : null;
  if (!project) throw new Error("Project is required to create an album.");
  if (project.categorySlug !== category.slug) {
    throw new Error(
      `Project "${project.slug}" belongs to category "${project.categorySlug}", not "${category.slug}".`
    );
  }

  const name = input.name.trim();
  if (!name) throw new Error("Album name is required.");

  const slug = slugify(input.slug || name);
  if (!slug) throw new Error("Album name must produce a valid slug.");

  const clash = await getAlbumBySlug(category.slug, project.slug, slug);
  if (clash) {
    throw new Error(`Album slug "${slug}" already exists for this project.`);
  }

  const all = await listAlbums({ includeHidden: true });
  const now = new Date().toISOString();
  const album: AlbumRecord = {
    id: randomUUID(),
    categoryId: category.id,
    categorySlug: category.slug,
    projectId: project.id,
    projectSlug: project.slug,
    slug,
    name,
    description: input.description ?? "",
    coverImage: input.coverImage ?? "",
    order: all.filter((a) => a.projectId === project.id).length,
    featured: false,
    published: input.published ?? true,
    hidden: false,
    status: "active",
    seoTitle: name,
    seoDescription: input.description ?? "",
    createdAt: now,
    updatedAt: now,
  };

  await saveAlbums([album, ...all]);
  return album;
}

export async function updateAlbum(
  id: string,
  patch: Partial<
    Pick<
      AlbumRecord,
      | "name"
      | "slug"
      | "description"
      | "coverImage"
      | "featured"
      | "published"
      | "hidden"
      | "order"
      | "seoTitle"
      | "seoDescription"
    >
  >
): Promise<AlbumRecord | null> {
  const all = await listAlbums({ includeHidden: true });
  const index = all.findIndex((a) => a.id === id);
  if (index < 0) return null;

  const previous = all[index];
  if (patch.name !== undefined && !patch.name.trim()) {
    throw new Error("Album name is required.");
  }

  const nextSlug = patch.slug ? slugify(patch.slug) : previous.slug;
  if (!nextSlug) throw new Error("Album slug is invalid.");

  if (nextSlug !== previous.slug) {
    const clash = all.find(
      (a) =>
        a.id !== id &&
        a.projectId === previous.projectId &&
        a.slug === nextSlug
    );
    if (clash) {
      throw new Error(
        `Album slug "${nextSlug}" already exists for this project.`
      );
    }
  }

  const next: AlbumRecord = {
    ...previous,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : previous.name,
    slug: nextSlug,
    updatedAt: new Date().toISOString(),
  };
  next.status = albumStatus(next);
  all[index] = next;
  await saveAlbums(all);

  // Keep denormalized albumSlug on media in sync. storageKey stays immutable.
  if (nextSlug !== previous.slug) {
    const { listPhotos, savePhotos } = await import("@/lib/db/photos");
    const { listVideos, saveVideos } = await import("@/lib/db/videos");

    const photos = await listPhotos();
    await savePhotos(
      photos.map((photo) =>
        photo.albumId === id ? { ...photo, albumSlug: nextSlug } : photo
      )
    );

    const videos = await listVideos();
    await saveVideos(
      videos.map((video) =>
        video.albumId === id ? { ...video, albumSlug: nextSlug } : video
      )
    );
  }

  return next;
}

export async function deleteAlbum(id: string): Promise<AlbumRecord | null> {
  const all = await listAlbums({ includeHidden: true });
  const target = all.find((a) => a.id === id);
  if (!target) return null;
  await saveAlbums(all.filter((a) => a.id !== id));
  return target;
}

export async function getDefaultAlbumForProject(
  categorySlug: string,
  projectSlug: string
) {
  const albums = await listAlbums({
    categorySlug,
    projectSlug,
    includeHidden: true,
  });
  return albums[0] ?? null;
}
