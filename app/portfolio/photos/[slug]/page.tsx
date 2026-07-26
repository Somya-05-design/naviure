import { notFound } from "next/navigation";
import { getSettings, getCategories, scanGalleryPhotos } from "@/lib/services/content";
import { getGalleryLayout, getLayoutKey } from "@/lib/services/cms";
import PhotosClient from "@/components/features/portfolio/PhotosClient";
import { formatCategoryName } from "@/lib/utils";

interface PhotosAlbumPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: PhotosAlbumPageProps) {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);

  if (!category) {
    return { title: "Photos" };
  }

  return {
    title: category.name,
    description: `Explore NAVIURE's ${formatCategoryName(slug)} photography collection.`,
  };
}

export default async function PhotosAlbumPage({ params }: PhotosAlbumPageProps) {
  const { slug } = await params;
  const [settings, categories, images, layout] = await Promise.all([
    getSettings(),
    getCategories(),
    scanGalleryPhotos(),
    getGalleryLayout(getLayoutKey(slug)),
  ]);

  if (!categories.some((category) => category.slug === slug)) {
    notFound();
  }

  return (
    <PhotosClient
      settings={settings}
      categories={categories}
      images={images}
      albumSlug={slug}
      layout={layout?.status === "published" ? layout : null}
    />
  );
}
