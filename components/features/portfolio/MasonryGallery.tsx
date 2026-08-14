"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import MediaImage from "@/components/ui/MediaImage";
import { cn } from "@/lib/utils";
import {
  GALLERY_BATCH_SIZE,
  buildMasonrySections,
  getGalleryColumnGap,
  getGalleryColumns,
  type MasonryPlacedItem,
  type MasonrySection,
} from "@/lib/gallery-layout";
import { getGalleryDisplayUrl } from "@/lib/media-urls";
import type { GalleryImage } from "@/types";

interface MasonryGalleryProps {
  images: GalleryImage[];
  onImageClick: (image: GalleryImage, index: number) => void;
  initialVisibleCount?: number;
  onVisibleCountChange?: (count: number) => void;
}

interface MasonryPhotoProps {
  image: GalleryImage;
  index: number;
  featured?: boolean;
  onImageClick: (image: GalleryImage, index: number) => void;
}

const MasonryPhoto = memo(function MasonryPhoto({
  image,
  index,
  featured = false,
  onImageClick,
}: MasonryPhotoProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  // First screenful loads eagerly; the rest use native lazy loading.
  const eager = featured || index < 6;

  return (
    <button
      type="button"
      className={cn(
        "group relative block w-full cursor-pointer text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#081A12]",
        featured ? "mx-auto max-w-[min(100%,960px)]" : "w-full"
      )}
      onClick={() => onImageClick(image, index)}
      aria-label={`View ${image.alt}`}
      data-photo-id={image.id}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-[18px]",
          "bg-[#0A1410]/90",
          "ring-1 ring-inset ring-white/[0.09]",
          "shadow-[0_14px_40px_rgba(0,0,0,0.34)]",
          "transition-[transform,box-shadow,filter] duration-[520ms] ease-out will-change-transform",
          "group-hover:-translate-y-1",
          "group-hover:shadow-[0_22px_56px_rgba(0,0,0,0.46),0_0_32px_rgba(15,61,46,0.14)]",
          "group-hover:brightness-[1.05]"
        )}
      >
        {!isLoaded && (
          <div
            className="w-full animate-pulse bg-gradient-to-br from-[#0D2218] via-[#081A12] to-[#0A1410]"
            style={{
              aspectRatio: `${Math.max(image.width, 1)} / ${Math.max(image.height, 1)}`,
            }}
            aria-hidden
          />
        )}

        <MediaImage
          src={getGalleryDisplayUrl(image.src, image.thumbnail, featured)}
          alt={image.alt}
          width={Math.max(image.width, 1)}
          height={Math.max(image.height, 1)}
          className={cn(
            "block h-auto w-full",
            "transition-[transform,opacity] duration-700 ease-out will-change-transform",
            "group-hover:scale-[1.015]",
            isLoaded ? "opacity-100" : "absolute inset-0 h-full w-full object-contain opacity-0"
          )}
          sizes={
            featured
              ? "(max-width: 640px) 100vw, 960px"
              : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, (max-width: 1600px) 25vw, 20vw"
          }
          loading={eager ? "eager" : "lazy"}
          priority={featured || index === 0}
          onLoad={() => setIsLoaded(true)}
        />
      </div>
    </button>
  );
});

function MasonryColumns({
  section,
  gap,
  onImageClick,
}: {
  section: Extract<MasonrySection, { type: "columns" }>;
  gap: number;
  onImageClick: (image: GalleryImage, index: number) => void;
}) {
  return (
    <div
      className="flex w-full items-start"
      style={{ gap }}
    >
      {section.columns.map((column, columnIndex) => (
        <div
          key={`col-${columnIndex}`}
          className="flex min-w-0 flex-1 flex-col"
          style={{ gap }}
        >
          {column.map(({ image, index }) => (
            <MasonryPhoto
              key={image.id}
              image={image}
              index={index}
              onImageClick={onImageClick}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function MasonryGallery({
  images,
  onImageClick,
  initialVisibleCount,
  onVisibleCountChange,
}: MasonryGalleryProps) {
  const resolvedInitialCount = initialVisibleCount ?? GALLERY_BATCH_SIZE;
  const [columns, setColumns] = useState(3);
  const [gap, setGap] = useState(16);
  const [visibleCount, setVisibleCount] = useState(resolvedInitialCount);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset pagination when the image set (or requested count) changes, using a
  // stable content signature so identity churn can never cause a render loop.
  const imagesSignature = `${images.length}:${images[0]?.id ?? ""}`;
  const [trackedSignature, setTrackedSignature] = useState(imagesSignature);
  const [trackedInitialCount, setTrackedInitialCount] =
    useState(resolvedInitialCount);
  if (
    imagesSignature !== trackedSignature ||
    resolvedInitialCount !== trackedInitialCount
  ) {
    setTrackedSignature(imagesSignature);
    setTrackedInitialCount(resolvedInitialCount);
    setVisibleCount(resolvedInitialCount);
  }

  useEffect(() => {
    const updateLayout = () => {
      const width = window.innerWidth;
      setColumns(getGalleryColumns(width));
      setGap(getGalleryColumnGap(width));
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    onVisibleCountChange?.(visibleCount);
  }, [onVisibleCountChange, visibleCount]);

  const placedItems = useMemo<MasonryPlacedItem[]>(
    () =>
      images.slice(0, visibleCount).map((image, index) => ({ image, index })),
    [images, visibleCount]
  );

  const sections = useMemo(
    () => buildMasonrySections(placedItems, columns, gap),
    [placedItems, columns, gap]
  );

  const loadMore = useCallback(() => {
    setVisibleCount((count) =>
      Math.min(count + GALLERY_BATCH_SIZE, images.length)
    );
  }, [images.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || visibleCount >= images.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "640px 0px", threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, images.length, loadMore]);

  return (
    <div className="mx-auto w-full max-w-[1520px] px-4 sm:px-6 md:px-8">
      <div className="flex w-full flex-col" style={{ gap }}>
        {sections.map((section, sectionIndex) =>
          section.type === "featured" ? (
            <MasonryPhoto
              key={`featured-${section.item.image.id}-${section.item.index}`}
              image={section.item.image}
              index={section.item.index}
              featured
              onImageClick={onImageClick}
            />
          ) : (
            <MasonryColumns
              key={`columns-${sectionIndex}`}
              section={section}
              gap={gap}
              onImageClick={onImageClick}
            />
          )
        )}
      </div>

      {visibleCount < images.length && (
        <div ref={sentinelRef} className="h-24 w-full" aria-hidden />
      )}
    </div>
  );
}
