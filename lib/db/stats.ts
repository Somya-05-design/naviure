import type {
  AlbumStats,
  CategoryStats,
  DashboardStats,
  MonthlyUploadStat,
  ProjectStats,
  SiteAnalytics,
} from "@/lib/db/schema";
import { readTable, writeTable } from "@/lib/db/client";
import { listCategories } from "@/lib/db/categories";
import { listProjects } from "@/lib/db/projects";
import { listAlbums } from "@/lib/db/albums";
import { listPhotos } from "@/lib/db/photos";
import { listVideos } from "@/lib/db/videos";
import type { GalleryImage, GalleryVideo } from "@/types";

const ANALYTICS_FILE = "site-analytics.json";

export async function getSiteAnalytics(): Promise<SiteAnalytics> {
  return readTable<SiteAnalytics>(ANALYTICS_FILE, {
    totalVisitors: 0,
    updatedAt: new Date().toISOString(),
  });
}

export async function incrementVisitors(): Promise<number> {
  const current = await getSiteAnalytics();
  const next = {
    totalVisitors: current.totalVisitors + 1,
    updatedAt: new Date().toISOString(),
  };
  await writeTable(ANALYTICS_FILE, next);
  return next.totalVisitors;
}

export async function getUploadPeriodStats() {
  const stats = await getDashboardStats();
  return {
    uploadsToday: stats.uploadsToday,
    uploadsThisMonth: stats.uploadsThisMonth,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [photos, videos, albums, projects, categories, analytics] =
    await Promise.all([
      listPhotos(),
      listVideos(),
      listAlbums({ includeHidden: true }),
      listProjects({ includeHidden: true }),
      listCategories(),
      getSiteAnalytics(),
    ]);

  const storageBytes = [...photos, ...videos].reduce(
    (total, item) => total + (item.fileSize ?? item.size ?? 0),
    0
  );

  const bookings = await readTable<{ status: string }[]>("bookings.json", []);

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let uploadsToday = 0;
  let uploadsThisMonth = 0;
  for (const item of [...photos, ...videos]) {
    if (item.createdAt.slice(0, 10) === todayKey) uploadsToday += 1;
    if (item.createdAt.slice(0, 7) === monthKey) uploadsThisMonth += 1;
  }

  return {
    photos: photos.length,
    videos: videos.length,
    projects: projects.length,
    albums: albums.length,
    categories: categories.length,
    storageUsedMb: Math.round(storageBytes / (1024 * 1024)),
    visitors: analytics.totalVisitors,
    bookings: bookings.filter((b) => b.status !== "cancelled").length,
    uploadsToday,
    uploadsThisMonth,
  };
}

export async function getCategoryStatsMap(): Promise<Record<string, CategoryStats>> {
  const [categories, projects, albums, photos, videos] = await Promise.all([
    listCategories(),
    listProjects({ includeHidden: true }),
    listAlbums({ includeHidden: true }),
    listPhotos(),
    listVideos(),
  ]);

  const map: Record<string, CategoryStats> = {};
  for (const cat of categories) {
    map[cat.id] = {
      id: cat.id,
      projectCount: projects.filter((p) => p.categorySlug === cat.slug).length,
      albumCount: albums.filter((a) => a.categorySlug === cat.slug).length,
      photoCount: photos.filter((p) => p.categorySlug === cat.slug).length,
      videoCount: videos.filter((v) => v.categorySlug === cat.slug).length,
    };
  }
  return map;
}

export async function getProjectStatsMap(): Promise<Record<string, ProjectStats>> {
  const [projects, albums, photos, videos] = await Promise.all([
    listProjects({ includeHidden: true }),
    listAlbums({ includeHidden: true }),
    listPhotos(),
    listVideos(),
  ]);

  const map: Record<string, ProjectStats> = {};
  for (const project of projects) {
    const projectPhotos = photos.filter((p) => p.projectId === project.id);
    const projectVideos = videos.filter((v) => v.projectId === project.id);
    map[project.id] = {
      id: project.id,
      albumCount: albums.filter((a) => a.projectId === project.id).length,
      photoCount: projectPhotos.length,
      videoCount: projectVideos.length,
      storageUsedBytes: [...projectPhotos, ...projectVideos].reduce(
        (sum, m) => sum + (m.fileSize ?? m.size ?? 0),
        0
      ),
    };
  }
  return map;
}

export async function getAlbumStatsMap(): Promise<Record<string, AlbumStats>> {
  const [albums, photos, videos] = await Promise.all([
    listAlbums({ includeHidden: true }),
    listPhotos(),
    listVideos(),
  ]);

  const map: Record<string, AlbumStats> = {};
  for (const album of albums) {
    map[album.id] = {
      id: album.id,
      photoCount: photos.filter((p) => p.albumId === album.id).length,
      videoCount: videos.filter((v) => v.albumId === album.id).length,
    };
  }
  return map;
}

export async function getMonthlyUploadStats(months = 6): Promise<MonthlyUploadStat[]> {
  const [photos, videos] = await Promise.all([listPhotos(), listVideos()]);
  const buckets = new Map<string, { photos: number; videos: number }>();

  const add = (date: string, type: "photo" | "video") => {
    const key = date.slice(0, 7);
    const bucket = buckets.get(key) ?? { photos: 0, videos: 0 };
    if (type === "photo") bucket.photos += 1;
    else bucket.videos += 1;
    buckets.set(key, bucket);
  };

  photos.forEach((p) => add(p.createdAt, "photo"));
  videos.forEach((v) => add(v.createdAt, "video"));

  const now = new Date();
  const result: MonthlyUploadStat[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key) ?? { photos: 0, videos: 0 };
    result.push({
      month: key,
      label: d.toLocaleString("en-US", { month: "short" }),
      photos: bucket.photos,
      videos: bucket.videos,
      total: bucket.photos + bucket.videos,
    });
  }

  return result;
}

export async function getRecentMediaUploads(limit = 8) {
  const [photos, videos] = await Promise.all([listPhotos(), listVideos()]);
  const merged: Array<
    (GalleryImage | GalleryVideo) & { mediaType: "photo" | "video"; createdAt: string }
  > = [
    ...photos.map((p) => ({
      id: p.id,
      src: p.src,
      alt: p.title,
      category: p.categorySlug,
      width: p.width ?? 0,
      height: p.height ?? 0,
      order: p.order,
      featured: p.featured,
      size: p.fileSize ?? p.size,
      thumbnail: p.thumbnail,
      title: p.title,
      createdAt: p.createdAt,
      mediaType: "photo" as const,
    })),
    ...videos.map((v) => ({
      id: v.id,
      src: v.thumbnail || v.src,
      alt: v.title,
      category: v.categorySlug,
      thumbnail: v.thumbnail,
      title: v.title,
      duration: v.duration ?? "0:00",
      order: v.order,
      size: v.fileSize ?? v.size,
      createdAt: v.createdAt,
      mediaType: "video" as const,
      width: 0,
      height: 0,
      featured: false,
    })),
  ];

  return merged
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function getRecentProjects(limit = 8) {
  const projects = await listProjects({ includeHidden: true });
  return [...projects]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}
