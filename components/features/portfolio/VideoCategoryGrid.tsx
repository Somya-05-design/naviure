"use client";

import { useEffect, useMemo, useRef } from "react";
import VideoCategoryCard from "@/components/features/portfolio/VideoCategoryCard";
import { getPortfolioVideoCategory } from "@/lib/portfolio-navigation";
import type { Category, GalleryVideo } from "@/types";

interface VideoCategoryGridProps {
  categories: Category[];
  videos: GalleryVideo[];
}

function getCoverImage(category: Category, videos: GalleryVideo[]) {
  const fromGallery = videos.find((video) => video.category === category.slug)?.thumbnail;
  return fromGallery || category.coverImage;
}

export default function VideoCategoryGrid({
  categories,
  videos,
}: VideoCategoryGridProps) {
  const restoredRef = useRef(false);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  );

  useEffect(() => {
    if (restoredRef.current) return;

    const savedSlug = getPortfolioVideoCategory();
    if (!savedSlug) return;

    restoredRef.current = true;
    requestAnimationFrame(() => {
      document
        .getElementById(`portfolio-video-category-${savedSlug}`)
        ?.scrollIntoView({ block: "center", behavior: "auto" });
    });
  }, [sortedCategories]);

  return (
    <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-8 px-4 sm:grid-cols-2 sm:gap-9 lg:grid-cols-3 lg:gap-10 md:px-8">
      {sortedCategories.map((category, index) => (
        <div key={category.id} id={`portfolio-video-category-${category.slug}`}>
          <VideoCategoryCard
            category={category}
            coverImage={getCoverImage(category, videos)}
            priority={index < 3}
          />
        </div>
      ))}
    </div>
  );
}
