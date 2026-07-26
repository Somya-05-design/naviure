import { getSettings, getVideoCategories, scanGalleryVideos } from "@/lib/services/content";
import VideosClient from "@/components/features/portfolio/VideosClient";

export const metadata = {
  title: "Videos",
  description: "Watch NAVIURE's cinematic films and brand stories.",
};

export default async function VideosPage() {
  const [settings, categories, videos] = await Promise.all([
    getSettings(),
    getVideoCategories(),
    scanGalleryVideos(),
  ]);

  return (
    <VideosClient
      settings={settings}
      categories={categories}
      videos={videos}
    />
  );
}
