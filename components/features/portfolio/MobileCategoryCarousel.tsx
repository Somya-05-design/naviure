"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MediaImage from "@/components/ui/MediaImage";
import { useRouter } from "next/navigation";
import {
  savePhotoCategoryStackState,
  readCategoryRestoreState,
  resolveCategoryFocusTarget,
} from "@/lib/portfolio-navigation";
import { cn } from "@/lib/utils";
import { getCategoryCoverImage } from "@/lib/gallery-layout-cms";
import type { Category, GalleryImage } from "@/types";
import type { GalleryLayout } from "@/types/cms";

interface MobileCategoryCarouselProps {
  categories: Category[];
  images: GalleryImage[];
  layouts?: Record<string, GalleryLayout>;
}

function getCoverImage(
  category: Category,
  images: GalleryImage[],
  layouts?: Record<string, GalleryLayout>
) {
  return getCategoryCoverImage(category, images, layouts?.[category.slug]);
}

export default function MobileCategoryCarousel({
  categories,
  images,
  layouts,
}: MobileCategoryCarouselProps) {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  );

  const scrollToIndex = useCallback((index: number, smooth = true) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const child = scroller.children[index] as HTMLElement | undefined;
    if (!child) return;

    const target =
      child.offsetLeft - (scroller.clientWidth - child.clientWidth) / 2;

    isProgrammaticScroll.current = true;
    scroller.scrollTo({
      left: target,
      behavior: smooth ? "smooth" : "auto",
    });
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    const slugs = sortedCategories.map((c) => c.slug);
    const saved = readCategoryRestoreState();
    if (!saved) return;
    const focusIndex = resolveCategoryFocusTarget(saved, slugs);
    if (focusIndex > 0) {
      requestAnimationFrame(() => scrollToIndex(focusIndex, false));
    }
  }, [sortedCategories, scrollToIndex]);

  // Sync active index with drag/scroll position. Page indicator updates only
  // once a card has settled at center (scroll idle), matching native feel.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let frame = 0;
    let idleTimer = 0;

    const measureClosest = () => {
      const center = scroller.scrollLeft + scroller.clientWidth / 2;
      let closest = 0;
      let minDist = Number.POSITIVE_INFINITY;
      Array.from(scroller.children).forEach((child, index) => {
        const el = child as HTMLElement;
        const cardCenter = el.offsetLeft + el.clientWidth / 2;
        const dist = Math.abs(center - cardCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = index;
        }
      });
      return closest;
    };

    const onScroll = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Live update while the user is dragging (not during programmatic snap)
        if (!isProgrammaticScroll.current) {
          setActiveIndex(measureClosest());
        }
      });
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        isProgrammaticScroll.current = false;
        setActiveIndex(measureClosest());
      }, 120);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(idleTimer);
    };
  }, []);

  const openCategory = useCallback(
    (index: number) => {
      const category = sortedCategories[index];
      if (!category) return;

      savePhotoCategoryStackState({
        categorySlug: category.slug,
        activeIndex: index,
        focus: index,
        scrollY: typeof window !== "undefined" ? window.scrollY : 0,
      });

      router.push(`/portfolio/photos/${category.slug}`);
    },
    [router, sortedCategories]
  );

  const handleCardTap = (index: number) => {
    // Tap on a non-active (nearby) card: only select it — never open.
    if (index !== activeIndex) {
      scrollToIndex(index);
      return;
    }
    // Second tap on the already-active card opens the album.
    openCategory(index);
  };

  return (
    <section className="min-[1200px]:hidden" aria-label="Photography categories">
      <div
        ref={scrollerRef}
        className={cn(
          "flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain",
          "px-[10vw] pb-2 pt-1",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {sortedCategories.map((category, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={category.id}
              className="w-[80vw] max-w-[360px] shrink-0 snap-center"
              style={{ scrollSnapStop: "always" }}
            >
              <button
                type="button"
                onClick={() => handleCardTap(index)}
                className="block w-full cursor-pointer text-left"
                aria-label={
                  isActive
                    ? `Open ${category.name} gallery`
                    : `Select ${category.name}`
                }
                aria-current={isActive ? "true" : undefined}
              >
                <div
                  className={cn(
                    "relative overflow-hidden rounded-2xl ring-1 ring-inset transition-all duration-[400ms] ease-out will-change-transform",
                    isActive
                      ? "z-20 scale-100 opacity-100 ring-gold/25 shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
                      : "z-0 scale-[0.93] opacity-80 ring-white/10 shadow-[0_10px_28px_rgba(0,0,0,0.35)]"
                  )}
                  style={{ height: "clamp(280px, 44vh, 340px)" }}
                >
                  <div
                    className="absolute inset-0 transition-[filter] duration-[400ms] ease-out"
                    style={{
                      filter: isActive
                        ? "grayscale(0) brightness(1) blur(0px)"
                        : "grayscale(100%) brightness(0.75) blur(2px)",
                    }}
                  >
                    <MediaImage
                      src={getCoverImage(category, images, layouts)}
                      alt={category.name}
                      fill
                      className="scale-105 object-cover"
                      sizes="80vw"
                      priority={index <= 1}
                    />
                  </div>

                  <div
                    className={cn(
                      "absolute inset-0 transition-opacity duration-[400ms]",
                      isActive
                        ? "bg-gradient-to-t from-black/65 via-black/15 to-transparent"
                        : "bg-black/25"
                    )}
                  />

                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <p
                      className={cn(
                        "font-display font-light leading-tight text-soft-white transition-all duration-[400ms]",
                        isActive
                          ? "text-[clamp(1.625rem,5.5vw,2rem)]"
                          : "text-[clamp(1.25rem,4.5vw,1.5rem)] text-soft-white/85"
                      )}
                    >
                      {category.name}
                    </p>

                    <div
                      className={cn(
                        "grid transition-all duration-[400ms] ease-out",
                        isActive
                          ? "mt-2 grid-rows-[1fr] opacity-100"
                          : "mt-0 grid-rows-[0fr] opacity-0"
                      )}
                    >
                      <div className="overflow-hidden">
                        {category.description ? (
                          <p className="text-[13px] leading-snug text-soft-white/75">
                            {category.description}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[10px] uppercase tracking-[0.28em] text-gold/70">
                          Tap again to open
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)]">
        {sortedCategories.map((category, index) => (
          <button
            key={category.id}
            type="button"
            onClick={() => scrollToIndex(index)}
            className={cn(
              "rounded-full transition-all duration-300",
              index === activeIndex
                ? "h-1.5 w-8 bg-gold/80"
                : "h-1.5 w-1.5 bg-soft-white/25"
            )}
            aria-label={`Show ${category.name}`}
          />
        ))}
      </div>
    </section>
  );
}
