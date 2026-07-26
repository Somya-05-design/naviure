import { scanGalleryPhotos, scanGalleryVideos } from "@/lib/services/content";
import { getAlbums, getCMSCategories, getImageMetadataMap } from "@/lib/services/cms";
import { listProjects } from "@/lib/db";
import PhotoManager from "@/components/admin/photos/PhotoManager";

export default async function AdminPhotosPage() {
  const [photos, videos, categories, albums, projects, metadataMap] =
    await Promise.all([
      scanGalleryPhotos(),
      scanGalleryVideos(),
      getCMSCategories(),
      getAlbums(),
      listProjects({ includeHidden: true }),
      getImageMetadataMap(),
    ]);

  return (
    <PhotoManager
      photos={photos}
      videos={videos}
      categories={categories}
      albums={albums}
      projects={projects}
      metadataMap={metadataMap}
    />
  );
}
