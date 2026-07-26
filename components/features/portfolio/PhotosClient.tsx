"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import PortfolioHero from "@/components/features/portfolio/PortfolioHero";
import MinimalFooter from "@/components/layout/MinimalFooter";
import CategoryStack from "@/components/features/portfolio/CategoryStack";
import MobileCategoryCarousel from "@/components/features/portfolio/MobileCategoryCarousel";
import PortfolioSecondaryNav from "@/components/layout/PortfolioSecondaryNav";
import MasonryGallery from "@/components/features/portfolio/MasonryGallery";
import VisualGridGallery from "@/components/features/portfolio/VisualGridGallery";
import Lightbox, {
  type LightboxOriginRect,
} from "@/components/features/portfolio/Lightbox";
import { cn, formatCategoryName } from "@/lib/utils";
import {
  getPhotoAlbumState,
  markReturningToCategories,
  readCategoryRestoreState,
  resolveCategoryFocusTarget,
  savePhotoAlbumState,
  savePhotoCategoryStackState,
} from "@/lib/portfolio-navigation";
import {
  getScrollY,
  scrollToY,
  subscribeScroll,
} from "@/lib/scroll-controller";
import { applyGalleryLayout } from "@/lib/gallery-layout-cms";
import { GALLERY_BATCH_SIZE } from "@/lib/gallery-layout";
import type { GalleryImage, Category, SiteSettings } from "@/types";
import type { GalleryLayout, GalleryLayoutItem } from "@/types/cms";

interface PhotosClientProps {
  settings: SiteSettings;
  categories: Category[];
  images: GalleryImage[];
  layouts?: Record<string, GalleryLayout>;
  albumSlug?: string;
  layout?: GalleryLayout | null;
  layoutItems?: GalleryLayoutItem[];
}

const LIGHTBOX_HISTORY_FLAG = "naviurePhotoLightbox";

function readThumbRect(imageId: string): LightboxOriginRect | null {
  if (typeof document === "undefined") return null;
  const safeId =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(imageId)
      : imageId.replace(/"/g, '\\"');
  const el = document.querySelector(`[data-photo-id="${safeId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

export default function PhotosClient({
  settings,
  categories,
  images,
  layouts,
  albumSlug,
  layout,
  layoutItems,
}: PhotosClientProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [originRect, setOriginRect] = useState<LightboxOriginRect | null>(null);
  const saveAlbumFrameRef = useRef<number | null>(null);
  const lightboxOpenRef = useRef(false);
  const closingLightboxRef = useRef(false);
  const albumScrollRestoredRef = useRef<string | null>(null);

  const filteredImages = albumSlug
    ? images.filter((img) => img.category === albumSlug)
    : images;

  const rawLayout =
    layout ??
    (layoutItems?.length
      ? ({
          categorySlug: albumSlug ?? "",
          gridType: "custom",
          status: "published",
          items: layoutItems,
          updatedAt: "",
        } as GalleryLayout)
      : null);

  // applyGalleryLayout returns layout:null when published items are stale
  // (e.g. pre-migration demo IDs) — fall back to MasonryGallery.
  const galleryData = applyGalleryLayout(filteredImages, rawLayout);
  const hasCustomLayout = Boolean(galleryData.layout?.items?.length);
  const galleryImages = galleryData.images;
  const initialVisibleCount = GALLERY_BATCH_SIZE;

  const persistAlbumState = useCallback(
    (
      partial: Partial<{
        scrollY: number;
        lightboxIndex: number | null;
        selectedImageId: string | null;
        visibleCount: number;
      }> = {}
    ) => {
      if (!albumSlug) return;

      savePhotoAlbumState(albumSlug, {
        scrollY: partial.scrollY ?? getScrollY(),
        lightboxIndex:
          partial.lightboxIndex !== undefined
            ? partial.lightboxIndex
            : lightboxIndex,
        selectedImageId:
          partial.selectedImageId !== undefined
            ? partial.selectedImageId
            : lightboxIndex !== null
              ? (galleryImages[lightboxIndex]?.id ?? null)
              : null,
        visibleCount: partial.visibleCount ?? GALLERY_BATCH_SIZE,
      });
    },
    [albumSlug, galleryImages, lightboxIndex]
  );

  const schedulePersistAlbum = useCallback(() => {
    if (!albumSlug) return;
    if (saveAlbumFrameRef.current !== null) {
      cancelAnimationFrame(saveAlbumFrameRef.current);
    }
    saveAlbumFrameRef.current = requestAnimationFrame(() => {
      saveAlbumFrameRef.current = null;
      persistAlbumState();
    });
  }, [albumSlug, persistAlbumState]);

  const restoreAlbumScroll = useCallback(
    (selectedImageId?: string | null) => {
      if (!albumSlug) return;
      const saved = getPhotoAlbumState(albumSlug);
      const y = saved?.scrollY ?? 0;
      scrollToY(y, { immediate: true });

      const id = selectedImageId ?? saved?.selectedImageId;
      if (!id) return;
      requestAnimationFrame(() => {
        const safeId =
          typeof CSS !== "undefined" && typeof CSS.escape === "function"
            ? CSS.escape(id)
            : id.replace(/"/g, '\\"');
        const el = document.querySelector(
          `[data-photo-id="${safeId}"]`
        ) as HTMLElement | null;
        el?.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    },
    [albumSlug]
  );

  const openLightbox = useCallback(
    (image: GalleryImage, index: number) => {
      const rect = readThumbRect(image.id);
      setOriginRect(rect);

      persistAlbumState({
        scrollY: getScrollY(),
        lightboxIndex: index,
        selectedImageId: image.id,
      });

      if (typeof window !== "undefined") {
        // Preserve Next.js router state on the history entry so back() only
        // dismisses the lightbox and never pops the album route.
        const prev =
          window.history.state && typeof window.history.state === "object"
            ? window.history.state
            : {};
        window.history.pushState(
          { ...prev, [LIGHTBOX_HISTORY_FLAG]: true, index },
          ""
        );
      }

      lightboxOpenRef.current = true;
      setLightboxIndex(index);
    },
    [persistAlbumState]
  );

  const closeLightbox = useCallback(() => {
    const selectedId =
      lightboxIndex !== null
        ? (galleryImages[lightboxIndex]?.id ?? null)
        : null;

    lightboxOpenRef.current = false;

    if (
      typeof window !== "undefined" &&
      window.history.state?.[LIGHTBOX_HISTORY_FLAG]
    ) {
      // Pop the lightbox history entry. popstate handler clears React state
      // and restores scroll — do NOT markReturningToCategories.
      closingLightboxRef.current = true;
      window.history.back();
      return;
    }

    setLightboxIndex(null);
    setOriginRect(null);
    persistAlbumState({ lightboxIndex: null, selectedImageId: selectedId });
    restoreAlbumScroll(selectedId);
  }, [
    galleryImages,
    lightboxIndex,
    persistAlbumState,
    restoreAlbumScroll,
  ]);

  const navigateLightbox = useCallback(
    (index: number) => {
      setLightboxIndex(index);
      const id = galleryImages[index]?.id ?? null;
      if (id) setOriginRect(readThumbRect(id));
      persistAlbumState({
        lightboxIndex: index,
        selectedImageId: id,
      });

      if (
        typeof window !== "undefined" &&
        window.history.state?.[LIGHTBOX_HISTORY_FLAG]
      ) {
        const prev =
          window.history.state && typeof window.history.state === "object"
            ? window.history.state
            : {};
        window.history.replaceState(
          { ...prev, [LIGHTBOX_HISTORY_FLAG]: true, index },
          ""
        );
      }
    },
    [galleryImages, persistAlbumState]
  );

  useLayoutEffect(() => {
    if (albumSlug) return;

    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const saved = readCategoryRestoreState();
    if (!saved) return;

    const slugs = categories.map((category) => category.slug);
    const focusIndex = resolveCategoryFocusTarget(saved, slugs);
    if (focusIndex <= 0 && saved.scrollY <= 0) return;

    if (saved.scrollY > 0) {
      scrollToY(saved.scrollY, { immediate: true });
    }
  }, [albumSlug, categories]);

  useEffect(() => {
    if (!albumSlug) return;

    const index = categories.findIndex((category) => category.slug === albumSlug);
    if (index < 0) return;

    savePhotoCategoryStackState({
      categorySlug: albumSlug,
      activeIndex: index,
      focus: index,
    });
  }, [albumSlug, categories]);

  // Restore album scroll on enter (do NOT always reset to 0 — that wiped
  // position when returning from lightbox / remounting the album route).
  useLayoutEffect(() => {
    if (!albumSlug) {
      albumScrollRestoredRef.current = null;
      return;
    }

    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    if (albumScrollRestoredRef.current === albumSlug) return;
    albumScrollRestoredRef.current = albumSlug;

    const saved = getPhotoAlbumState(albumSlug);
    if (saved && saved.scrollY > 0) {
      scrollToY(saved.scrollY, { immediate: true });
    } else {
      scrollToY(0, { immediate: true });
    }
  }, [albumSlug]);

  useEffect(() => {
    if (!albumSlug) return;

    const onScroll = () => schedulePersistAlbum();
    const unsubscribe = subscribeScroll(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });

    const onPageHide = () => persistAlbumState();
    window.addEventListener("pagehide", onPageHide);

    return () => {
      unsubscribe();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onPageHide);
      persistAlbumState();
    };
  }, [albumSlug, persistAlbumState, schedulePersistAlbum]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    persistAlbumState();
  }, [lightboxIndex, persistAlbumState]);

  useEffect(() => {
    const onPopState = () => {
      // Closing the lightbox via history.back() — stay on the album.
      if (lightboxOpenRef.current || closingLightboxRef.current) {
        closingLightboxRef.current = false;
        lightboxOpenRef.current = false;
        const selectedId =
          lightboxIndex !== null
            ? (galleryImages[lightboxIndex]?.id ?? null)
            : null;
        setLightboxIndex(null);
        setOriginRect(null);
        persistAlbumState({
          lightboxIndex: null,
          selectedImageId: selectedId,
        });
        // Unlock body then restore scroll on the next frame.
        requestAnimationFrame(() => restoreAlbumScroll(selectedId));
        return;
      }

      // Genuine back from the album route → category stack.
      if (albumSlug) {
        markReturningToCategories();
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [
    albumSlug,
    galleryImages,
    lightboxIndex,
    persistAlbumState,
    restoreAlbumScroll,
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[#081A12]">
      <PortfolioHero image={settings.heroImage} />

      <main className="flex-1">
        <section
          className={
            albumSlug
              ? "mx-auto max-w-7xl px-4 pb-20 pt-10 md:px-8 md:pt-12"
              : "pb-20"
          }
        >
          {!albumSlug ? (
            <>
              <div className="mx-auto max-w-7xl px-4 pt-6 min-[1200px]:mb-8 min-[1200px]:px-8 min-[1200px]:pt-12">
                <span className="mb-2 block text-xs uppercase tracking-[0.32em] text-gold/55 min-[1200px]:mb-3 min-[1200px]:text-[10px] min-[1200px]:tracking-[0.36em]">
                  Portfolio
                </span>
                <h2 className="font-display text-[clamp(2.625rem,10vw,3.25rem)] font-light leading-[1.05] text-soft-white min-[1200px]:text-5xl">
                  Photography
                </h2>

                <div
                  className={cn(
                    "sticky z-30 mt-6 min-[1200px]:hidden",
                    "top-[calc(max(env(safe-area-inset-top,0px),0.75rem)+3.75rem)]"
                  )}
                >
                  <PortfolioSecondaryNav variant="segmented" />
                </div>
              </div>

              <div className="mt-6 min-[1200px]:mt-0">
                <MobileCategoryCarousel
                  categories={categories}
                  images={images}
                  layouts={layouts}
                />
                <div className="hidden min-[1200px]:block">
                  <CategoryStack
                    categories={categories}
                    images={images}
                    layouts={layouts}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-10">
                <Link
                  href="/portfolio/photos"
                  scroll={false}
                  className="mb-4 block text-[10px] uppercase tracking-[0.22em] text-soft-white/40 transition-colors hover:text-gold"
                  onClick={() => {
                    markReturningToCategories();
                    persistAlbumState();
                  }}
                >
                  ← All Categories
                </Link>
                <h2 className="font-display text-3xl font-light text-soft-white md:text-4xl">
                  {formatCategoryName(albumSlug)}
                </h2>
              </div>
              {hasCustomLayout ? (
                <VisualGridGallery
                  images={galleryData.images}
                  layoutItems={galleryData.items}
                  layout={galleryData.layout}
                  onImageClick={openLightbox}
                />
              ) : (
                <MasonryGallery
                  images={galleryImages}
                  initialVisibleCount={initialVisibleCount}
                  onImageClick={openLightbox}
                  onVisibleCountChange={(count) =>
                    persistAlbumState({ visibleCount: count })
                  }
                />
              )}
            </>
          )}
        </section>
      </main>

      <MinimalFooter />

      {lightboxIndex !== null && (
        <Lightbox
          images={galleryImages}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
          originRect={originRect}
          categoryLabel={formatCategoryName(albumSlug || "")}
        />
      )}
    </div>
  );
}
