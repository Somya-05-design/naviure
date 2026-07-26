import { getSettings, getCategories, scanGalleryPhotos } from "@/lib/services/content";
import { getGalleryLayouts } from "@/lib/services/cms";
import PhotosClient from "@/components/features/portfolio/PhotosClient";

export const metadata = {
  title: "Photos",
  description: "Explore NAVIURE's luxury photography portfolio — weddings, portraits, and cinematic visual stories.",
};

export default async function PhotosPage() {
  const [settings, categories, images, layouts] = await Promise.all([
    getSettings(),
    getCategories(),
    scanGalleryPhotos(),
    getGalleryLayouts(),
  ]);

  return (
    <PhotosClient
      settings={settings}
      categories={categories}
      images={images}
      layouts={layouts}
    />
  );
}
