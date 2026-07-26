import {
  listProjects,
  listAlbums,
  listPhotos,
  listVideos,
  listCategories,
} from "@/lib/db";
import { getImageMetadataMap } from "@/lib/services/cms";
import type { AdminSearchResult } from "@/types/cms";

/** Global admin search across projects, clients, categories, albums, media. */
export async function searchAdminContent(
  query: string,
  limit = 24
): Promise<AdminSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const [projects, albums, photos, videos, categories, metadataMap] =
    await Promise.all([
      listProjects({ includeHidden: true, search: q }),
      listAlbums({ includeHidden: true, search: q }),
      listPhotos({ search: q }),
      listVideos({ search: q }),
      listCategories(),
      getImageMetadataMap(),
    ]);

  const results: AdminSearchResult[] = [];
  const seen = new Set<string>();

  const push = (item: AdminSearchResult) => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(item);
  };

  for (const cat of categories) {
    if (
      cat.name.toLowerCase().includes(q) ||
      cat.slug.toLowerCase().includes(q) ||
      cat.description.toLowerCase().includes(q)
    ) {
      push({
        type: "category",
        id: cat.id,
        title: cat.name,
        subtitle: "Category",
        href: `/admin/library/${cat.slug}`,
      });
    }
  }

  for (const project of projects) {
    push({
      type: "project",
      id: project.id,
      title: project.name,
      subtitle: `Project · ${project.clientName || project.categorySlug}`,
      href: `/admin/library/${project.categorySlug}/${project.slug}`,
    });
  }

  for (const album of albums) {
    push({
      type: "album",
      id: album.id,
      title: album.name,
      subtitle: `Album · ${album.projectSlug}`,
      href: `/admin/library/${album.categorySlug}/${album.projectSlug}/${album.slug}`,
    });
  }

  for (const photo of photos) {
    push({
      type: "photo",
      id: photo.id,
      title: photo.title,
      subtitle: `Photo · ${photo.projectSlug}/${photo.albumSlug}`,
      href: `/admin/library/${photo.categorySlug}/${photo.projectSlug}/${photo.albumSlug}`,
    });
  }

  const photoIds = new Set(photos.map((p) => p.id));
  const allPhotos = await listPhotos();
  for (const photo of allPhotos) {
    if (photoIds.has(photo.id)) continue;
    const meta = metadataMap[photo.id];
    const matchesMeta =
      meta?.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
      meta?.altText?.toLowerCase().includes(q) ||
      meta?.description?.toLowerCase().includes(q) ||
      meta?.location?.toLowerCase().includes(q);
    if (!matchesMeta) continue;
    push({
      type: "photo",
      id: photo.id,
      title: photo.title,
      subtitle: `Photo · ${photo.projectSlug}/${photo.albumSlug}`,
      href: `/admin/library/${photo.categorySlug}/${photo.projectSlug}/${photo.albumSlug}`,
    });
  }

  for (const video of videos) {
    push({
      type: "video",
      id: video.id,
      title: video.title,
      subtitle: `Video · ${video.projectSlug}/${video.albumSlug}`,
      href: `/admin/library/${video.categorySlug}/${video.projectSlug}/${video.albumSlug}`,
    });
  }

  return results.slice(0, limit);
}
