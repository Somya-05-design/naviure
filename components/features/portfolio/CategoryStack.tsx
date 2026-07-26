"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { gsap, useScrollTrigger, ScrollTrigger } from "@/hooks/useAnimations";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import CategoryCard from "@/components/features/portfolio/CategoryCard";
import { getInteractionStrength, layoutCoverflow } from "@/lib/coverflow";
import {
  clearReturningToCategories,
  getPhotoCategoryStackState,
  PORTFOLIO_RESTORE_DURATION,
  readCategoryRestoreState,
  resolveCategoryFocusTarget,
  savePhotoCategoryStackState,
  shouldRestorePortfolioState,
} from "@/lib/portfolio-navigation";
import {
  getScrollY,
  scrollToY,
  subscribeScroll,
  waitForCondition,
} from "@/lib/scroll-controller";
import { clamp, cn, prefersReducedMotion } from "@/lib/utils";
import { getCategoryCoverImage } from "@/lib/gallery-layout-cms";
import type { Category, GalleryImage } from "@/types";
import type { GalleryLayout } from "@/types/cms";

gsap.registerPlugin(ScrollToPlugin);

interface CategoryStackProps {
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

function getInitialSegmentVh() {
  if (typeof window === "undefined") return 100;
  const width = window.innerWidth;
  if (width < 640) return 80;
  if (width < 1024) return 90;
  return 100;
}

function computeCarouselScrollY(
  st: ScrollTrigger,
  focusIndex: number,
  categoryCount: number
) {
  const maxIndex = Math.max(categoryCount - 1, 1);
  const clampedFocus = clamp(focusIndex, 0, categoryCount - 1);
  const progress = clampedFocus / maxIndex;
  return st.start + progress * (st.end - st.start);
}

function hitTestCardByTap(
  clientX: number,
  clientY: number,
  cards: HTMLDivElement[]
): number | null {
  let bestIndex: number | null = null;
  let bestArea = 0;

  cards.forEach((el, index) => {
    const rect = el.getBoundingClientRect();
    const inBounds =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;
    if (!inBounds) return;

    const area = rect.width * rect.height;
    if (area > bestArea) {
      bestArea = area;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function hitTestInteractiveCard(
  clientX: number,
  clientY: number,
  cards: HTMLDivElement[],
  focus: number
): number | null {
  const candidates = cards
    .map((el, index) => ({
      el,
      index,
      strength: getInteractionStrength(index, focus),
    }))
    .filter((item) => item.strength > 0)
    .sort((a, b) => b.strength - a.strength);

  const elements = document.elementsFromPoint(clientX, clientY);

  for (const { el, index } of candidates) {
    const rect = el.getBoundingClientRect();
    const inBounds =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;
    const inStack = elements.some((node) => el === node || el.contains(node));

    if (inBounds || inStack) return index;
  }

  return null;
}

export default function CategoryStack({
  categories,
  images,
  layouts,
}: CategoryStackProps) {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const focusRef = useRef(0);
  const hoveredRef = useRef<number | null>(null);
  const wheelLock = useRef(false);
  const restoringRef = useRef(false);
  const persistReadyRef = useRef(false);
  const saveFrameRef = useRef<number | null>(null);
  const pendingRestoreRef = useRef<{ focus: number; scrollY: number } | null>(
    null
  );

  const savedOnMount = useRef<ReturnType<typeof readCategoryRestoreState>>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [focus, setFocus] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [segmentVh, setSegmentVh] = useState(100);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [canHover, setCanHover] = useState(false);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  );

  useLayoutEffect(() => {
    // Reads window size — client-only, must run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSegmentVh(getInitialSegmentVh());
  }, []);

  const persistStackState = useCallback(
    (overrides?: {
      categorySlug?: string;
      activeIndex?: number;
      focus?: number;
      scrollY?: number;
    }) => {
      const slug =
        overrides?.categorySlug ??
        sortedCategories[overrides?.activeIndex ?? activeIndex]?.slug ??
        sortedCategories[activeIndex]?.slug;

      if (!slug) return;

      savePhotoCategoryStackState({
        categorySlug: slug,
        activeIndex: overrides?.activeIndex ?? activeIndex,
        focus: overrides?.focus ?? focusRef.current,
        scrollY: overrides?.scrollY ?? getScrollY(),
      });
    },
    [activeIndex, sortedCategories]
  );

  const schedulePersist = useCallback(() => {
    if (!persistReadyRef.current || restoringRef.current) return;
    if (saveFrameRef.current !== null) cancelAnimationFrame(saveFrameRef.current);
    saveFrameRef.current = requestAnimationFrame(() => {
      saveFrameRef.current = null;
      persistStackState();
    });
  }, [persistStackState]);

  const relayout = useCallback(
    (focusValue: number, hovered: number | null = hoveredRef.current) => {
      const stage = stageRef.current;
      const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
      if (!stage || !cards.length) return;
      layoutCoverflow(cards, focusValue, stage.clientWidth, stage, hovered);
    },
    []
  );

  const applyFocus = useCallback(
    (focusValue: number) => {
      focusRef.current = focusValue;
      setFocus(focusValue);
      setActiveIndex(Math.round(focusValue));
      relayout(focusValue, hoveredRef.current);
    },
    [relayout]
  );

  useLayoutEffect(() => {
    const slugs = sortedCategories.map((category) => category.slug);
    const saved = savedOnMount.current ?? readCategoryRestoreState();
    savedOnMount.current = saved;

    if (saved) {
      const focusTarget = resolveCategoryFocusTarget(saved, slugs);
      pendingRestoreRef.current = {
        focus: focusTarget,
        scrollY: saved.scrollY ?? 0,
      };
      focusRef.current = focusTarget;
      setFocus(focusTarget);
      setActiveIndex(Math.round(focusTarget));
      restoringRef.current = true;
      relayout(focusTarget);
    } else {
      persistReadyRef.current = true;
    }
  }, [sortedCategories, relayout]);

  const finishCarouselRestore = useCallback(
    (clampedFocus: number) => {
      applyFocus(clampedFocus);
      restoringRef.current = false;
      persistReadyRef.current = true;
      pendingRestoreRef.current = null;
      clearReturningToCategories();
    },
    [applyFocus]
  );

  const scrollToFocus = useCallback(
    (
      targetFocus: number,
      options: {
        immediate?: boolean;
        smooth?: boolean;
        isRestore?: boolean;
        duration?: number;
      } = {}
    ) => {
      const st = ScrollTrigger.getById("category-coverflow");
      if (!st) return false;

      const maxIndex = Math.max(sortedCategories.length - 1, 1);
      const clampedFocus = clamp(targetFocus, 0, sortedCategories.length - 1);
      const progress = clampedFocus / maxIndex;
      const y = st.start + progress * (st.end - st.start);
      const immediate = options.immediate ?? !options.smooth;
      const duration = options.duration ?? PORTFOLIO_RESTORE_DURATION;

      if (options.isRestore) restoringRef.current = true;

      if (immediate) {
        scrollToY(y, { immediate: true });
        applyFocus(clampedFocus);
        if (options.isRestore) {
          restoringRef.current = false;
        } else {
          schedulePersist();
        }
        return true;
      }

      scrollToY(y, { duration });

      if (options.isRestore) {
        waitForCondition(
          () => Math.abs(getScrollY() - y) < 8,
          () => {
            applyFocus(clampedFocus);
            restoringRef.current = false;
            persistReadyRef.current = true;
          },
          120
        );
      }

      return true;
    },
    [applyFocus, schedulePersist, sortedCategories.length]
  );

  const scrollToIndex = useCallback(
    (index: number, immediate = false) => {
      pendingRestoreRef.current = null;
      scrollToFocus(index, {
        immediate,
        smooth: !immediate,
        duration: immediate ? 0 : 0.95,
      });
    },
    [scrollToFocus]
  );

  const applyPendingCarouselRestore = useCallback(() => {
    const pending = pendingRestoreRef.current;
    if (!pending) return false;

    const st = ScrollTrigger.getById("category-coverflow");
    if (!st) return false;

    restoringRef.current = true;

    const clampedFocus = clamp(pending.focus, 0, sortedCategories.length - 1);
    const y = computeCarouselScrollY(st, clampedFocus, sortedCategories.length);

    scrollToY(y, { immediate: true });
    ScrollTrigger.update();
    applyFocus(clampedFocus);

    waitForCondition(
      () => {
        const trigger = ScrollTrigger.getById("category-coverflow");
        if (!trigger) return false;

        const targetProgress =
          clampedFocus / Math.max(sortedCategories.length - 1, 1);
        const scrollOk = Math.abs(getScrollY() - y) < 48;
        const progressOk = Math.abs(trigger.progress - targetProgress) < 0.12;
        return scrollOk || progressOk;
      },
      () => {
        ScrollTrigger.refresh();
        finishCarouselRestore(clampedFocus);
      },
      180
    );

    window.setTimeout(() => {
      if (!pendingRestoreRef.current) return;
      scrollToY(y, { immediate: true });
      finishCarouselRestore(clampedFocus);
    }, 600);

    return true;
  }, [applyFocus, finishCarouselRestore, sortedCategories.length]);

  const activateCard = useCallback(
    (index: number) => {
      const category = sortedCategories[index];
      if (!category) return;

      const card = cardRefs.current[index];
      const surface = card?.querySelector<HTMLElement>("[data-card-interactive]");
      const href = `/portfolio/photos/${category.slug}`;

      const st = ScrollTrigger.getById("category-coverflow");
      const scrollY = st
        ? computeCarouselScrollY(st, index, sortedCategories.length)
        : getScrollY();

      persistStackState({
        categorySlug: category.slug,
        activeIndex: index,
        focus: index,
        scrollY,
      });

      const navigate = () => router.push(href);

      if (surface) {
        gsap.to(surface, {
          scale: 0.98,
          duration: 0.1,
          ease: "power2.inOut",
          yoyo: true,
          repeat: 1,
          onComplete: navigate,
        });
      } else {
        navigate();
      }
    },
    [persistStackState, router, sortedCategories]
  );

  useEffect(() => {
    // SSR-safe capability reads — must run post-mount to avoid hydration drift.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReducedMotion(prefersReducedMotion());
    setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  useEffect(() => {
    schedulePersist();
  }, [activeIndex, focus, schedulePersist]);

  useEffect(() => {
    if (reducedMotion) return;
    const unsubscribe = subscribeScroll(schedulePersist);
    return unsubscribe;
  }, [reducedMotion, schedulePersist]);

  useEffect(() => {
    if (reducedMotion) return;
    const onPageHide = () => persistStackState();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [persistStackState, reducedMotion]);

  useEffect(() => {
    hoveredRef.current = hoveredIndex;
    relayout(focusRef.current, hoveredIndex);
  }, [hoveredIndex, relayout]);

  useEffect(() => {
    const updateSegment = () => {
      const width = window.innerWidth;
      if (width < 640) setSegmentVh(80);
      else if (width < 1024) setSegmentVh(90);
      else setSegmentVh(100);
    };

    updateSegment();
    window.addEventListener("resize", updateSegment);
    return () => window.removeEventListener("resize", updateSegment);
  }, []);

  useScrollTrigger(() => {
    if (reducedMotion) return;

    const section = sectionRef.current;
    const pin = pinRef.current;
    const stage = stageRef.current;
    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!section || !pin || !stage || !cards.length) return;

    const saved = pendingRestoreRef.current;
    const initialFocus = saved?.focus ?? focusRef.current;
    relayout(initialFocus);

    const scrollDistance =
      Math.max(sortedCategories.length - 1, 1) *
      segmentVh *
      (window.innerHeight / 100);

    ScrollTrigger.create({
      id: "category-coverflow",
      trigger: section,
      start: "top top",
      end: `+=${scrollDistance}`,
      pin: pin,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        if (restoringRef.current || pendingRestoreRef.current) return;

        const focusValue =
          self.progress * Math.max(sortedCategories.length - 1, 0);
        focusRef.current = focusValue;
        setFocus(focusValue);
        relayout(focusValue, hoveredRef.current);
        setActiveIndex(Math.round(focusValue));
      },
    });

    if (pendingRestoreRef.current) {
      applyPendingCarouselRestore();
      requestAnimationFrame(() => {
        applyPendingCarouselRestore();
      });
    } else {
      persistReadyRef.current = true;
    }
  }, [
    sortedCategories.length,
    segmentVh,
    reducedMotion,
    relayout,
    applyPendingCarouselRestore,
  ]);

  useEffect(() => {
    if (reducedMotion) return;

    const stage = stageRef.current;
    if (!stage) return;

    const onResize = () => {
      ScrollTrigger.refresh();
      if (pendingRestoreRef.current) {
        applyPendingCarouselRestore();
      } else {
        relayout(focusRef.current, hoveredRef.current);
      }
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(stage);
    window.addEventListener("resize", onResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [reducedMotion, relayout, applyPendingCarouselRestore]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || reducedMotion || !canHover) return;

    const onMove = (event: MouseEvent) => {
      const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
      const hit = hitTestInteractiveCard(
        event.clientX,
        event.clientY,
        cards,
        focusRef.current
      );
      setHoveredIndex((prev) => (prev === hit ? prev : hit));
    };

    const onLeave = () => setHoveredIndex(null);

    stage.addEventListener("mousemove", onMove);
    stage.addEventListener("mouseleave", onLeave);

    return () => {
      stage.removeEventListener("mousemove", onMove);
      stage.removeEventListener("mouseleave", onLeave);
    };
  }, [canHover, reducedMotion, sortedCategories.length]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || reducedMotion) return;

    const resolveCardHit = (clientX: number, clientY: number) => {
      const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
      if (!canHover) {
        return hitTestCardByTap(clientX, clientY, cards);
      }
      return hitTestInteractiveCard(clientX, clientY, cards, focusRef.current);
    };

    const onClick = (event: MouseEvent) => {
      if (!canHover) return;
      const hit = resolveCardHit(event.clientX, event.clientY);
      if (hit === null) return;
      event.preventDefault();
      activateCard(hit);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (wheelLock.current) return;

      const delta =
        Math.abs(event.deltaY) > Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;
      if (Math.abs(delta) < 8) return;

      wheelLock.current = true;
      if (delta > 0) scrollToIndex(activeIndex + 1);
      else scrollToIndex(activeIndex - 1);

      window.setTimeout(() => {
        wheelLock.current = false;
      }, 480);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") scrollToIndex(activeIndex + 1);
      if (event.key === "ArrowLeft") scrollToIndex(activeIndex - 1);
    };

    let touchStartX = 0;
    let touchStartY = 0;

    const onTouchStart = (event: TouchEvent) => {
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    };

    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;

      if (Math.abs(dx) >= 40 && Math.abs(dx) >= Math.abs(dy)) {
        if (dx < 0) scrollToIndex(activeIndex + 1);
        else scrollToIndex(activeIndex - 1);
        return;
      }

      if (Math.abs(dx) < 14 && Math.abs(dy) < 14) {
        const hit = resolveCardHit(touch.clientX, touch.clientY);
        if (hit === null) return;
        event.preventDefault();

        if (canHover) {
          activateCard(hit);
          return;
        }

        if (hit === activeIndex) {
          activateCard(hit);
        } else {
          scrollToIndex(hit, false);
        }
      }
    };

    stage.addEventListener("click", onClick);
    stage.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      stage.removeEventListener("click", onClick);
      stage.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchend", onTouchEnd);
    };
  }, [activeIndex, scrollToIndex, reducedMotion, activateCard, canHover]);

  useEffect(() => {
    if (!reducedMotion) return;

    const saved = shouldRestorePortfolioState()
      ? getPhotoCategoryStackState()
      : null;
    if (!saved) return;

    waitForCondition(
      () => Boolean(document.getElementById(`portfolio-category-${saved.categorySlug}`)),
      () => {
        document
          .getElementById(`portfolio-category-${saved.categorySlug}`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      },
      60
    );
  }, [reducedMotion, sortedCategories]);

  if (reducedMotion) {
    return (
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 sm:grid-cols-2 md:px-8 lg:grid-cols-3">
        {sortedCategories.map((category) => (
          <div
            key={category.id}
            id={`portfolio-category-${category.slug}`}
            className="relative mx-auto w-full"
          >
            <CategoryCard
              category={category}
              coverImage={getCoverImage(category, images, layouts)}
              interactionStrength={1}
              isHovered
              canHover={false}
              layout="grid"
              onOpenGallery={(slug) => {
                const index = sortedCategories.findIndex((item) => item.slug === slug);
                persistStackState({
                  categorySlug: slug,
                  activeIndex: index >= 0 ? index : 0,
                  focus: index >= 0 ? index : 0,
                });
                router.push(`/portfolio/photos/${slug}`);
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="relative"
      style={{ height: `${sortedCategories.length * segmentVh}vh` }}
      aria-label="Photography categories"
    >
      <div
        ref={pinRef}
        className="relative h-dvh w-full overflow-hidden"
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 z-10 px-[clamp(0.75rem,3vw,2rem)]",
            "top-[clamp(3.5rem,8vh,5rem)]"
          )}
        >
          <span className="block text-[10px] uppercase tracking-[0.36em] text-gold/55">
            Scroll · Swipe · Arrow keys
          </span>
        </div>

        <div className="flex h-full w-full items-center justify-center px-[clamp(0.5rem,2.5vw,1.5rem)]">
          <div
            ref={stageRef}
            className="relative h-[clamp(420px,72vh,760px)] w-[min(96vw,100%)] overflow-hidden"
            style={{
              perspectiveOrigin: "50% 50%",
              transformStyle: "preserve-3d",
              cursor: canHover && hoveredIndex !== null ? "pointer" : "default",
            }}
          >
            {sortedCategories.map((category, index) => (
              <CategoryCard
                key={category.id}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                category={category}
                coverImage={getCoverImage(category, images, layouts)}
                interactionStrength={getInteractionStrength(index, focus)}
                isHovered={hoveredIndex === index}
                isActive={!canHover && index === activeIndex}
                canHover={canHover}
              />
            ))}
          </div>
        </div>

        <div
          className={cn(
            "absolute left-1/2 z-10 flex -translate-x-1/2 gap-2",
            "bottom-[clamp(1.25rem,4vh,2.5rem)]"
          )}
        >
          {sortedCategories.map((category, index) => (
            <button
              key={category.id}
              type="button"
              onClick={() => scrollToIndex(index)}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                index === activeIndex
                  ? "w-8 bg-gold/80"
                  : "w-1.5 bg-soft-white/25 hover:bg-soft-white/45"
              }`}
              aria-label={`Show ${category.name}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
