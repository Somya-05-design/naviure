import { notFound } from "next/navigation";
import { getCMSCategories } from "@/lib/services/cms";
import {
  getProjectBySlug,
  getAlbumBySlug,
  listPhotos,
  listVideos,
  getAlbumStatsMap,
} from "@/lib/db";
import { getImageMetadataMap } from "@/lib/services/cms";
import AlbumMediaManager from "@/components/admin/library/AlbumMediaManager";

export default async function AdminLibraryAlbumMediaPage({
  params,
}: {
  params: Promise<{
    categorySlug: string;
    projectSlug: string;
    albumSlug: string;
  }>;
}) {
  const { categorySlug, projectSlug, albumSlug } = await params;
  const categories = await getCMSCategories();
  const category = categories.find((c) => c.slug === categorySlug);
  const project = await getProjectBySlug(categorySlug, projectSlug);
  const album = await getAlbumBySlug(categorySlug, projectSlug, albumSlug);
  if (!category || !project || !album) notFound();

  const [photos, videos, metadataMap, albumStats] = await Promise.all([
    listPhotos({ albumId: album.id }),
    listVideos({ albumId: album.id }),
    getImageMetadataMap(),
    getAlbumStatsMap(),
  ]);

  return (
    <AlbumMediaManager
      category={category}
      project={project}
      album={album}
      photos={photos.map((p) => ({
        id: p.id,
        src: p.src,
        alt: p.title,
        category: p.categorySlug,
        albumSlug: p.albumSlug,
        title: p.title,
        thumbnail: p.thumbnail,
        width: p.width ?? 0,
        height: p.height ?? 0,
        order: p.order,
        featured: p.featured,
        size: p.fileSize,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }))}
      videos={videos.map((v) => ({
        id: v.id,
        src: v.src,
        thumbnail: v.thumbnail,
        title: v.title,
        category: v.categorySlug,
        albumSlug: v.albumSlug,
        duration: v.duration ?? "0:00",
        order: v.order,
        size: v.fileSize,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }))}
      metadataMap={metadataMap}
      stats={albumStats[album.id]}
    />
  );
}
