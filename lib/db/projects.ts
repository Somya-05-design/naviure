import { randomUUID } from "@/lib/uuid";
import type {
  PaginatedResult,
  ProjectRecord,
  ProjectStatus,
} from "@/lib/db/schema";
import { readTable, writeTable } from "@/lib/db/client";
import { slugify } from "@/lib/db/paths";
import { getCategoryBySlug } from "@/lib/db/categories";

const FILE = "projects.json";

const PROJECT_STATUSES: ProjectStatus[] = [
  "upcoming",
  "in_progress",
  "editing",
  "completed",
  "delivered",
  "archived",
];

export function isProjectStatus(value: string): value is ProjectStatus {
  return PROJECT_STATUSES.includes(value as ProjectStatus);
}

export async function listProjects(filters?: {
  categorySlug?: string;
  status?: ProjectStatus;
  search?: string;
  includeHidden?: boolean;
}): Promise<ProjectRecord[]> {
  let projects = await readTable<ProjectRecord[]>(FILE, []);

  if (filters?.categorySlug) {
    projects = projects.filter((p) => p.categorySlug === filters.categorySlug);
  }
  if (filters?.status) {
    projects = projects.filter((p) => p.status === filters.status);
  }
  if (!filters?.includeHidden) {
    projects = projects.filter((p) => !p.hidden && p.status !== "archived");
  }
  if (filters?.search?.trim()) {
    const q = filters.search.toLowerCase();
    projects = projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        p.clientEmail.toLowerCase().includes(q) ||
        p.clientPhone.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.categorySlug.toLowerCase().includes(q)
    );
  }

  return projects.sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name)
  );
}

export async function paginateProjects(input: {
  categorySlug?: string;
  status?: ProjectStatus;
  search?: string;
  page?: number;
  pageSize?: number;
  includeHidden?: boolean;
}): Promise<PaginatedResult<ProjectRecord>> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 50));
  const all = await listProjects(input);
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

export async function saveProjects(
  records: ProjectRecord[]
): Promise<ProjectRecord[]> {
  const sorted = [...records].sort((a, b) => a.order - b.order);
  await writeTable(FILE, sorted);
  return sorted;
}

export async function getProjectById(id: string): Promise<ProjectRecord | null> {
  const projects = await listProjects({ includeHidden: true });
  return projects.find((p) => p.id === id) ?? null;
}

export async function getProjectBySlug(
  categorySlug: string,
  projectSlug: string
): Promise<ProjectRecord | null> {
  const projects = await listProjects({ categorySlug, includeHidden: true });
  return projects.find((p) => p.slug === projectSlug) ?? null;
}

export async function createProject(input: {
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
}): Promise<ProjectRecord> {
  const category = await getCategoryBySlug(input.categorySlug);
  if (!category) throw new Error(`Category "${input.categorySlug}" not found.`);

  const name = input.name.trim();
  if (!name) throw new Error("Project name is required.");

  const slug = slugify(input.slug || name);
  if (!slug) throw new Error("Project name must produce a valid slug.");

  const existing = await getProjectBySlug(input.categorySlug, slug);
  if (existing) {
    throw new Error(`Project slug "${slug}" already exists in this category.`);
  }

  const all = await listProjects({ includeHidden: true });
  const now = new Date().toISOString();
  const project: ProjectRecord = {
    id: randomUUID(),
    categoryId: category.id,
    categorySlug: category.slug,
    slug,
    name,
    clientName: (input.clientName ?? "").trim(),
    clientPhone: (input.clientPhone ?? "").trim(),
    clientEmail: (input.clientEmail ?? "").trim(),
    eventDate: input.eventDate ?? null,
    shootDate: input.shootDate ?? null,
    deliveryDate: input.deliveryDate ?? null,
    location: (input.location ?? "").trim(),
    status: input.status ?? "upcoming",
    description: input.description ?? "",
    coverImage: input.coverImage ?? "",
    order: all.filter((p) => p.categorySlug === category.slug).length,
    featured: false,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };

  await saveProjects([project, ...all]);
  return project;
}

export async function updateProject(
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
      | "featured"
      | "hidden"
      | "order"
      | "categoryId"
      | "categorySlug"
    >
  >
): Promise<ProjectRecord | null> {
  const all = await listProjects({ includeHidden: true });
  const index = all.findIndex((p) => p.id === id);
  if (index < 0) return null;

  if (patch.status && !isProjectStatus(patch.status)) {
    throw new Error(`Invalid project status "${patch.status}".`);
  }
  if (patch.name !== undefined && !patch.name.trim()) {
    throw new Error("Project name is required.");
  }

  const previous = all[index];
  const nextSlug = patch.slug ? slugify(patch.slug) : previous.slug;
  if (!nextSlug) throw new Error("Project slug is invalid.");

  if (nextSlug !== previous.slug) {
    const clash = all.find(
      (p) =>
        p.id !== id &&
        p.categorySlug === previous.categorySlug &&
        p.slug === nextSlug
    );
    if (clash) {
      throw new Error(
        `Project slug "${nextSlug}" already exists in this category.`
      );
    }
  }

  const next: ProjectRecord = {
    ...previous,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : previous.name,
    slug: nextSlug,
    updatedAt: new Date().toISOString(),
  };
  if (patch.hidden === true) {
    next.status = "archived";
  }
  if (patch.status === "archived") {
    next.hidden = true;
  } else if (patch.status) {
    next.hidden = false;
  }

  all[index] = next;
  await saveProjects(all);

  // Keep denormalized slug references in sync. storageKey values stay immutable.
  if (nextSlug !== previous.slug) {
    const { listAlbums, saveAlbums } = await import("@/lib/db/albums");
    const { listPhotos, savePhotos } = await import("@/lib/db/photos");
    const { listVideos, saveVideos } = await import("@/lib/db/videos");

    const albums = await listAlbums({ includeHidden: true });
    await saveAlbums(
      albums.map((album) =>
        album.projectId === id
          ? { ...album, projectSlug: nextSlug, updatedAt: next.updatedAt }
          : album
      )
    );

    const photos = await listPhotos();
    await savePhotos(
      photos.map((photo) =>
        photo.projectId === id ? { ...photo, projectSlug: nextSlug } : photo
      )
    );

    const videos = await listVideos();
    await saveVideos(
      videos.map((video) =>
        video.projectId === id ? { ...video, projectSlug: nextSlug } : video
      )
    );
  }

  return next;
}

export async function deleteProject(id: string): Promise<ProjectRecord | null> {
  const all = await listProjects({ includeHidden: true });
  const target = all.find((p) => p.id === id);
  if (!target) return null;
  await saveProjects(all.filter((p) => p.id !== id));
  return target;
}
