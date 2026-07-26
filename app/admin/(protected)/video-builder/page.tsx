import { getVideoCategories, scanGalleryVideos } from "@/lib/services/content";
import { getVideoLayouts } from "@/lib/services/cms";
import VideoBuilder from "@/components/admin/video-builder/VideoBuilder";

export default async function VideoBuilderPage() {
  const [categories, videos, layouts] = await Promise.all([
    getVideoCategories(),
    scanGalleryVideos(),
    getVideoLayouts(),
  ]);

  return (
    <VideoBuilder categories={categories} videos={videos} layouts={layouts} />
  );
}
