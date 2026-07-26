import { scanGalleryPhotos } from "@/lib/services/content";
import { getCMSCategories, getGalleryLayouts } from "@/lib/services/cms";
import GalleryBuilder from "@/components/admin/gallery-builder/GalleryBuilder";

export default async function GalleryBuilderPage() {
  const [categories, photos, layouts] = await Promise.all([
    getCMSCategories(),
    scanGalleryPhotos(),
    getGalleryLayouts(),
  ]);

  return (
    <GalleryBuilder
      categories={categories}
      photos={photos}
      layouts={layouts}
    />
  );
}
