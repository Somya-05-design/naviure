import { notFound } from "next/navigation";
import {
  getSettings,
  getVideoCategories,
  scanGalleryVideos,
} from "@/lib/services/content";
import { getVideoLayout, getLayoutKey } from "@/lib/services/cms";
import VideosClient from "@/components/features/portfolio/VideosClient";
import { formatCategoryName } from "@/lib/utils";

interface VideosAlbumPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const categories = await getVideoCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: VideosAlbumPageProps) {
  const { slug } = await params;
  const categories = await getVideoCategories();
  const category = categories.find((item) => item.slug === slug);

  if (!category) {
    return { title: "Videos" };
  }

  return {
    title: category.name,
    description: `Watch NAVIURE's ${formatCategoryName(slug)} films and cinematic stories.`,
  };
}

export default async function VideosAlbumPage({ params }: VideosAlbumPageProps) {
  const { slug } = await params;
  const [settings, categories, videos, layout] = await Promise.all([
    getSettings(),
    getVideoCategories(),
    scanGalleryVideos(),
    getVideoLayout(getLayoutKey(slug)),
  ]);

  if (!categories.some((category) => category.slug === slug)) {
    notFound();
  }

  return (
    <VideosClient
      settings={settings}
      categories={categories}
      videos={videos}
      albumSlug={slug}
      layout={layout?.status === "published" ? layout : null}
    />
  );
}
