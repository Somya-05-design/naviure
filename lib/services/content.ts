import fs from "fs/promises";
import path from "path";
import type {
  SiteSettings,
  AboutContent,
  Category,
  GalleryImage,
  GalleryVideo,
} from "@/types";
import { storage } from "@/lib/storage";
import { randomUUID } from "@/lib/uuid";
import { resolveMediaRef } from "@/lib/assets";
import { isPublicCategorySlug } from "@/lib/public-categories";

const DATA_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "data");

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

function resolveSettings(raw: SiteSettings): SiteSettings {
  return {
    ...raw,
    introVideo: resolveMediaRef(raw.introVideo),
    introVideoPortrait: resolveMediaRef(
      (raw as SiteSettings & { introVideoPortrait?: string }).introVideoPortrait ||
        raw.introVideo
    ),
    introVideoLandscape: resolveMediaRef(
      (raw as SiteSettings & { introVideoLandscape?: string }).introVideoLandscape ||
        raw.introVideo
    ),
    heroImage: resolveMediaRef(raw.heroImage),
    footerImage: resolveMediaRef(raw.footerImage),
    seo: {
      ...raw.seo,
      ogImage: resolveMediaRef(raw.seo?.ogImage),
    },
  };
}

export async function getSettings(): Promise<SiteSettings> {
  const raw = await readJson<SiteSettings>("settings.json", {} as SiteSettings);
  return resolveSettings(raw);
}

export async function updateSettings(data: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await readJson<SiteSettings>("settings.json", {} as SiteSettings);
  const updated = {
    ...current,
    ...data,
    seo: data.seo ? { ...current.seo, ...data.seo } : current.seo,
    contact: data.contact ? { ...current.contact, ...data.contact } : current.contact,
    social: data.social ? { ...current.social, ...data.social } : current.social,
  };
  await writeJson("settings.json", updated);
  return resolveSettings(updated);
}

export async function getAboutContent(): Promise<AboutContent> {
  const raw = await readJson<AboutContent>("about.json", {} as AboutContent);
  return {
    ...raw,
    photographerImage: resolveMediaRef(raw.photographerImage),
  };
}

export async function updateAboutContent(data: Partial<AboutContent>): Promise<AboutContent> {
  const current = await readJson<AboutContent>("about.json", {} as AboutContent);
  const updated = { ...current, ...data };
  await writeJson("about.json", updated);
  return {
    ...updated,
    photographerImage: resolveMediaRef(updated.photographerImage),
  };
}

/** Public portfolio categories only (locked allow-list). */
export async function getCategories(): Promise<Category[]> {
  const categories = await readJson<Category[]>("categories.json", []);
  return categories
    .filter((cat) => isPublicCategorySlug(cat.slug))
    .map((cat) => ({
      ...cat,
      coverImage: cat.coverImage ? resolveMediaRef(cat.coverImage) : "",
    }))
    .sort((a, b) => a.order - b.order);
}

/** All categories including admin-only (corporate/food/fashion/others). */
export async function getAllCategories(): Promise<Category[]> {
  const categories = await readJson<Category[]>("categories.json", []);
  return categories
    .map((cat) => ({
      ...cat,
      coverImage: cat.coverImage ? resolveMediaRef(cat.coverImage) : "",
    }))
    .sort((a, b) => a.order - b.order);
}

export async function getVideoCategories(): Promise<Category[]> {
  return getCategories();
}

export async function updateCategories(categories: Category[]): Promise<Category[]> {
  await writeJson("categories.json", categories);
  return categories;
}

async function readGalleryPhotos(): Promise<GalleryImage[]> {
  const { listPhotos, toGalleryImages } = await import("@/lib/db/photos");
  return toGalleryImages(await listPhotos({ sort: "oldest" }));
}

async function readGalleryVideos(): Promise<GalleryVideo[]> {
  const { listVideos, toGalleryVideos } = await import("@/lib/db/videos");
  return toGalleryVideos(await listVideos({ sort: "oldest" }));
}

/** CMS-backed photo registry — no local gallery folder scanning. */
export async function scanGalleryPhotos(): Promise<GalleryImage[]> {
  return readGalleryPhotos();
}

/** CMS-backed video registry — no local gallery folder scanning. */
export async function scanGalleryVideos(): Promise<GalleryVideo[]> {
  return readGalleryVideos();
}

export async function saveGalleryPhotos(photos: GalleryImage[]): Promise<GalleryImage[]> {
  const sorted = [...photos].sort((a, b) => a.order - b.order);
  await writeJson("photos.json", sorted);
  return sorted;
}

export async function saveGalleryVideos(videos: GalleryVideo[]): Promise<GalleryVideo[]> {
  const sorted = [...videos].sort((a, b) => a.order - b.order);
  await writeJson("videos.json", sorted);
  return sorted;
}

export async function registerGalleryPhoto(input: {
  src: string;
  category: string;
  alt?: string;
  width?: number;
  height?: number;
  featured?: boolean;
  size?: number;
}): Promise<GalleryImage> {
  const photos = await readGalleryPhotos();
  const categoryPhotos = photos.filter((photo) => photo.category === input.category);
  const photo: GalleryImage = {
    id: randomUUID(),
    src: input.src,
    alt: input.alt ?? `${input.category} photo`,
    category: input.category,
    width: input.width ?? 1200,
    height: input.height ?? 1600,
    order: categoryPhotos.length,
    featured: input.featured ?? categoryPhotos.length < 3,
    size: input.size,
  };
  await saveGalleryPhotos([...photos, photo]);
  return photo;
}

export async function registerGalleryVideo(input: {
  src: string;
  category: string;
  title?: string;
  thumbnail?: string;
  duration?: string;
  size?: number;
}): Promise<GalleryVideo> {
  const videos = await readGalleryVideos();
  const categoryVideos = videos.filter((video) => video.category === input.category);
  const video: GalleryVideo = {
    id: randomUUID(),
    src: input.src,
    thumbnail: input.thumbnail ?? "",
    title: input.title ?? "Untitled Video",
    category: input.category,
    duration: input.duration ?? "0:00",
    order: categoryVideos.length,
    size: input.size,
  };
  await saveGalleryVideos([...videos, video]);
  return video;
}

export async function getVideosByCategory(category: string): Promise<GalleryVideo[]> {
  const all = await scanGalleryVideos();
  return all.filter((video) => video.category === category).sort((a, b) => a.order - b.order);
}

export async function getPhotosByCategory(category: string): Promise<GalleryImage[]> {
  const all = await scanGalleryPhotos();
  return all.filter((img) => img.category === category).sort((a, b) => a.order - b.order);
}

export async function exportBackup() {
  const [settings, about, categories] = await Promise.all([
    getSettings(),
    getAboutContent(),
    getCategories(),
  ]);
  return {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    settings,
    about,
    categories,
  };
}

export async function importBackup(data: {
  settings?: SiteSettings;
  about?: AboutContent;
  categories?: Category[];
}) {
  if (data.settings) await writeJson("settings.json", data.settings);
  if (data.about) await writeJson("about.json", data.about);
  if (data.categories) await writeJson("categories.json", data.categories);
}

export { storage };
