"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import PortfolioHero from "@/components/features/portfolio/PortfolioHero";
import MinimalFooter from "@/components/layout/MinimalFooter";
import PortfolioSecondaryNav from "@/components/layout/PortfolioSecondaryNav";
import VideoCategoryGrid from "@/components/features/portfolio/VideoCategoryGrid";
import VideoCard from "@/components/features/portfolio/VideoCard";
import VideoLightbox from "@/components/features/portfolio/VideoLightbox";
import VisualVideoGridGallery from "@/components/features/portfolio/VisualVideoGridGallery";
import { cn, formatCategoryName } from "@/lib/utils";
import { savePortfolioVideoCategory } from "@/lib/portfolio-navigation";
import { getScrollY, scrollToY } from "@/lib/scroll-controller";
import type { GalleryVideo, Category, SiteSettings } from "@/types";
import type { GalleryLayout } from "@/types/cms";

interface VideosClientProps {
  settings: SiteSettings;
  categories: Category[];
  videos: GalleryVideo[];
  albumSlug?: string;
  layout?: GalleryLayout | null;
}

const LIGHTBOX_HISTORY_FLAG = "naviureVideoLightbox";
const ALBUM_SCROLL_PREFIX = "naviure:portfolio:video-album-scroll:";

function getRandomPreviewDuration() {
  return 4000 + Math.random() * 2000;
}

function saveAlbumScroll(slug: string, y: number) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${ALBUM_SCROLL_PREFIX}${slug}`, String(y));
  } catch {
    /* ignore */
  }
}

function readAlbumScroll(slug: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(`${ALBUM_SCROLL_PREFIX}${slug}`);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export default function VideosClient({
  settings,
  categories,
  videos,
  albumSlug,
  layout = null,
}: VideosClientProps) {
  const [playingVideo, setPlayingVideo] = useState<GalleryVideo | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const lightboxOpenRef = useRef(false);
  const closingLightboxRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const albumScrollRestoredRef = useRef<string | null>(null);

  // Reset the auto-rotating preview when the category changes (render-phase
  // pattern — avoids a post-commit setState / extra render).
  const [trackedAlbumSlug, setTrackedAlbumSlug] = useState(albumSlug);
  if (albumSlug !== trackedAlbumSlug) {
    setTrackedAlbumSlug(albumSlug);
    setActiveIndex(0);
  }

  useEffect(() => {
    if (albumSlug) savePortfolioVideoCategory(albumSlug);
  }, [albumSlug]);

  const filteredVideos = albumSlug
    ? videos.filter((video) => video.category === albumSlug)
    : videos;

  useEffect(() => {
    if (!albumSlug || filteredVideos.length <= 1 || playingVideo || layout)
      return;

    let timer: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      timer = setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % filteredVideos.length);
        scheduleNext();
      }, getRandomPreviewDuration());
    };

    scheduleNext();
    return () => clearTimeout(timer);
  }, [albumSlug, filteredVideos.length, playingVideo, layout]);

  // Restore album scroll on enter
  useEffect(() => {
    if (!albumSlug) {
      albumScrollRestoredRef.current = null;
      return;
    }
    if (albumScrollRestoredRef.current === albumSlug) return;
    albumScrollRestoredRef.current = albumSlug;
    const y = readAlbumScroll(albumSlug);
    if (y > 0) scrollToY(y, { immediate: true });
  }, [albumSlug]);

  useEffect(() => {
    if (!albumSlug) return;
    const onScroll = () => saveAlbumScroll(albumSlug, getScrollY());
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      saveAlbumScroll(albumSlug, getScrollY());
    };
  }, [albumSlug]);

  const restoreSelection = useCallback((id: string | null) => {
    if (!id || typeof document === "undefined") return;
    requestAnimationFrame(() => {
      const safe =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(id)
          : id.replace(/"/g, '\\"');
      const el = document.querySelector(
        `[data-video-id="${safe}"]`
      ) as HTMLElement | null;
      el?.scrollIntoView({ block: "nearest", inline: "nearest" });
      el?.focus?.({ preventScroll: true });
    });
  }, []);

  const openPlayer = useCallback(
    (video: GalleryVideo) => {
      if (albumSlug) saveAlbumScroll(albumSlug, getScrollY());
      selectedIdRef.current = video.id;

      if (typeof window !== "undefined") {
        const prev =
          window.history.state && typeof window.history.state === "object"
            ? window.history.state
            : {};
        window.history.pushState(
          { ...prev, [LIGHTBOX_HISTORY_FLAG]: true, videoId: video.id },
          ""
        );
      }

      lightboxOpenRef.current = true;
      setPlayingVideo(video);
    },
    [albumSlug]
  );

  const closePlayer = useCallback(() => {
    lightboxOpenRef.current = false;
    const selectedId = selectedIdRef.current;

    if (
      typeof window !== "undefined" &&
      window.history.state?.[LIGHTBOX_HISTORY_FLAG]
    ) {
      closingLightboxRef.current = true;
      window.history.back();
      return;
    }

    setPlayingVideo(null);
    if (albumSlug) {
      const y = readAlbumScroll(albumSlug);
      scrollToY(y, { immediate: true });
    }
    restoreSelection(selectedId);
  }, [albumSlug, restoreSelection]);

  useEffect(() => {
    const onPopState = () => {
      if (lightboxOpenRef.current || closingLightboxRef.current) {
        closingLightboxRef.current = false;
        lightboxOpenRef.current = false;
        const selectedId = selectedIdRef.current;
        setPlayingVideo(null);
        requestAnimationFrame(() => {
          if (albumSlug) {
            scrollToY(readAlbumScroll(albumSlug), { immediate: true });
          }
          restoreSelection(selectedId);
        });
        return;
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [albumSlug, restoreSelection]);

  const useCustomLayout = Boolean(layout?.items?.length);

  const albumCategory = albumSlug
    ? categories.find((category) => category.slug === albumSlug)
    : null;

  const categoryLabel =
    albumCategory?.name ||
    (albumSlug ? formatCategoryName(albumSlug) : undefined);

  return (
    <div className="flex min-h-screen flex-col bg-[#081A12]">
      <PortfolioHero image={settings.heroImage} />

      <main className="flex-1">
        <section className="mx-auto max-w-[1400px] px-4 pb-20 pt-6 min-[1200px]:px-8 min-[1200px]:pt-12">
          {!albumSlug ? (
            <>
              <div className="mb-6 min-[1200px]:mb-14">
                <span className="mb-2 block text-xs uppercase tracking-[0.32em] text-gold/55 min-[1200px]:mb-3 min-[1200px]:text-[10px] min-[1200px]:tracking-[0.36em]">
                  Portfolio
                </span>
                <h2 className="font-display text-[clamp(2.625rem,10vw,3.25rem)] font-light leading-[1.05] text-soft-white min-[1200px]:text-5xl">
                  Videos
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
              <VideoCategoryGrid categories={categories} videos={videos} />
            </>
          ) : (
            <>
              <div className="mb-10 md:mb-12">
                <Link
                  href="/portfolio/videos"
                  className="mb-4 block text-[10px] uppercase tracking-[0.22em] text-soft-white/40 transition-colors hover:text-gold"
                >
                  ← All Categories
                </Link>
                <h2 className="font-display text-3xl font-light text-soft-white md:text-4xl">
                  {albumCategory?.name || formatCategoryName(albumSlug)}
                </h2>
                {albumCategory?.description && (
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-soft-white/45">
                    {albumCategory.description}
                  </p>
                )}
              </div>

              {useCustomLayout ? (
                <VisualVideoGridGallery
                  videos={filteredVideos}
                  layoutItems={layout!.items}
                  layout={layout}
                  onVideoClick={openPlayer}
                />
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                  {filteredVideos.map((video, index) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      onPlay={openPlayer}
                      active={!playingVideo && index === activeIndex}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <MinimalFooter />

      <VideoLightbox
        video={playingVideo}
        playlist={albumSlug ? filteredVideos : []}
        onClose={closePlayer}
        onNavigate={(v) => {
          selectedIdRef.current = v.id;
          setPlayingVideo(v);
        }}
        categoryLabel={categoryLabel}
      />
    </div>
  );
}
