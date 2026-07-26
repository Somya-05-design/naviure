"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  Share2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import MediaImage from "@/components/ui/MediaImage";
import {
  getGalleryThumbUrl,
  getGalleryOriginalUrl,
} from "@/lib/media-urls";
import { cn, formatCategoryName, clamp } from "@/lib/utils";
import type { GalleryImage } from "@/types";

const CONTROLS_HIDE_MS = 3200;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const SWIPE_THRESHOLD = 56;
const EDGE_NAV_RATIO = 0.18;

export interface LightboxOriginRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LightboxProps {
  images: GalleryImage[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  /** Bounding box of the clicked thumbnail — drives open/close FLIP. */
  originRect?: LightboxOriginRect | null;
  /** Category / album label for the info overlay. */
  categoryLabel?: string;
}

function formatBytes(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCaptureDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function orientationLabel(w: number, h: number): string {
  if (w > h) return "Landscape";
  if (h > w) return "Portrait";
  return "Square";
}

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

export default function Lightbox({
  images,
  currentIndex,
  onClose,
  onNavigate,
  originRect = null,
  categoryLabel,
}: LightboxProps) {
  const image = images[currentIndex];
  if (!image) return null;

  return (
    <LightboxStage
      key="photo-lightbox"
      images={images}
      currentIndex={currentIndex}
      image={image}
      onClose={onClose}
      onNavigate={onNavigate}
      originRect={originRect}
      categoryLabel={categoryLabel}
    />
  );
}

function LightboxStage({
  images,
  currentIndex,
  image,
  onClose,
  onNavigate,
  originRect,
  categoryLabel,
}: {
  images: GalleryImage[];
  currentIndex: number;
  image: GalleryImage;
  onClose: () => void;
  onNavigate: (index: number) => void;
  originRect: LightboxOriginRect | null;
  categoryLabel?: string;
}) {
  const reduceMotion = useReducedMotion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    swiping: boolean;
  } | null>(null);
  const pinchRef = useRef<{
    startDist: number;
    startZoom: number;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [filmstripVisible, setFilmstripVisible] = useState(true);
  const [hiResLoaded, setHiResLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [exitRect, setExitRect] = useState<LightboxOriginRect | null>(null);
  const [exiting, setExiting] = useState(false);
  const [magnetic, setMagnetic] = useState({ left: { x: 0, y: 0 }, right: { x: 0, y: 0 } });

  const thumbSrc = getGalleryThumbUrl(image.src, image.thumbnail);
  // Lightbox always uses the original R2 asset — never thumb/web derivatives.
  const originalSrc = getGalleryOriginalUrl(image.src);
  const categoryName =
    categoryLabel || formatCategoryName(image.category || "Portfolio");
  const albumName = image.albumSlug
    ? formatCategoryName(image.albumSlug)
    : image.title || null;
  const metaBits = [
    image.width && image.height
      ? `${image.width}×${image.height}`
      : null,
    image.width && image.height
      ? orientationLabel(image.width, image.height)
      : null,
    formatBytes(image.size),
    formatCaptureDate(image.createdAt),
  ].filter(Boolean) as string[];

  const natW = Math.max(image.width || 1, 1);
  const natH = Math.max(image.height || 1, 1);

  const zoomed = zoom > 1.02;

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setControlsVisible(false);
      setFilmstripVisible(false);
    }, CONTROLS_HIDE_MS);
  }, []);

  const revealChrome = useCallback(() => {
    setControlsVisible(true);
    setFilmstripVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Reset load/zoom when the active image changes
  const [activeKey, setActiveKey] = useState(image.id);
  if (activeKey !== image.id) {
    setActiveKey(image.id);
    setHiResLoaded(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  const requestClose = useCallback(() => {
    if (exiting) return;
    const rect = readThumbRect(image.id) ?? originRect;
    setExitRect(rect);
    if (reduceMotion || !rect) {
      onClose();
      return;
    }
    setExiting(true);
  }, [exiting, image.id, onClose, originRect, reduceMotion]);

  const goPrev = useCallback(() => {
    if (zoomed || currentIndex <= 0) return;
    onNavigate(currentIndex - 1);
    revealChrome();
  }, [zoomed, currentIndex, onNavigate, revealChrome]);

  const goNext = useCallback(() => {
    if (zoomed || currentIndex >= images.length - 1) return;
    onNavigate(currentIndex + 1);
    revealChrome();
  }, [zoomed, currentIndex, images.length, onNavigate, revealChrome]);

  const toggleFullscreen = useCallback(async () => {
    const root = overlayRef.current;
    if (!root) return;
    try {
      if (!document.fullscreenElement) {
        await root.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore — browser may deny
    }
  }, []);

  const toggleZoom = useCallback(() => {
    setZoom((z) => {
      if (z < 1.5) return 2;
      if (z < 2.5) return 3;
      queueMicrotask(() => setPan({ x: 0, y: 0 }));
      return 1;
    });
    revealChrome();
  }, [revealChrome]);

  const downloadImage = useCallback(() => {
    const a = document.createElement("a");
    a.href = getGalleryOriginalUrl(image.src);
    a.download = image.title || image.alt || "photo";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }, [image]);

  // Focus trap + body lock + chrome auto-hide (mount only).
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    overlayRef.current?.focus();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setControlsVisible(false);
      setFilmstripVisible(false);
    }, CONTROLS_HIDE_MS);

    return () => {
      document.body.style.overflow = "";
      if (hideTimer.current) clearTimeout(hideTimer.current);
      previouslyFocused.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Preload adjacent originals only (±1)
  useEffect(() => {
    const neighbors = [currentIndex - 1, currentIndex + 1].filter(
      (i) => i >= 0 && i < images.length
    );
    const loaders: HTMLImageElement[] = [];
    for (const i of neighbors) {
      const img = new window.Image();
      img.decoding = "async";
      img.src = getGalleryOriginalUrl(images[i].src);
      loaders.push(img);
    }
    return () => {
      for (const img of loaders) {
        img.src = "";
      }
    };
  }, [currentIndex, images]);

  // Auto-center filmstrip selection
  useEffect(() => {
    const strip = filmstripRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLElement>(
      `[data-strip-index="${currentIndex}"]`
    );
    active?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [currentIndex, reduceMotion, filmstripVisible]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (zoomed) {
          resetZoom();
          return;
        }
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
          return;
        }
        requestClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => clamp(z + 0.35, MIN_ZOOM, MAX_ZOOM));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => {
          const next = clamp(z - 0.35, MIN_ZOOM, MAX_ZOOM);
          if (next <= 1) setPan({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === "0") {
        e.preventDefault();
        resetZoom();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }

      // Focus trap
      if (e.key === "Tab" && overlayRef.current) {
        const focusable = overlayRef.current.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    goNext,
    goPrev,
    requestClose,
    resetZoom,
    toggleFullscreen,
    zoomed,
  ]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    revealChrome();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pan.x,
      originY: pan.y,
      swiping: !zoomed,
    };
    setIsDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (zoomed) {
      setPan({ x: drag.originX + dx, y: drag.originY + dy });
      return;
    }

    if (drag.swiping && Math.abs(dx) > 12) {
      // visual feedback via CSS variable on stage
      stageRef.current?.style.setProperty("--swipe-x", `${dx}px`);
      stageRef.current?.style.setProperty(
        "--swipe-o",
        String(clamp(1 - Math.abs(dx) / 400, 0.55, 1))
      );
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    dragRef.current = null;
    setIsDragging(false);
    stageRef.current?.style.setProperty("--swipe-x", "0px");
    stageRef.current?.style.setProperty("--swipe-o", "1");

    if (zoomed) return;

    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext();
      else goPrev();
      return;
    }

    // Edge click navigation (desktop)
    const bounds = stageRef.current?.getBoundingClientRect();
    if (bounds && Math.hypot(dx, dy) < 8) {
      const rel = (e.clientX - bounds.left) / bounds.width;
      if (rel < EDGE_NAV_RATIO) goPrev();
      else if (rel > 1 - EDGE_NAV_RATIO) goNext();
    }
  };

  const onWheel = (e: ReactWheelEvent) => {
    revealChrome();
    // Pinch-to-zoom on trackpads often comes as ctrl+wheel
    if (e.ctrlKey || zoomed) {
      e.preventDefault();
      const delta = -e.deltaY * 0.01;
      setZoom((z) => {
        const next = clamp(z + delta, MIN_ZOOM, MAX_ZOOM);
        if (next <= 1) setPan({ x: 0, y: 0 });
        return next;
      });
      return;
    }
    // Optional wheel navigation when not zoomed
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 24) {
      e.preventDefault();
      if (e.deltaX > 0) goNext();
      else goPrev();
    } else if (Math.abs(e.deltaY) > 48) {
      e.preventDefault();
      if (e.deltaY > 0) goNext();
      else goPrev();
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const a = e.touches[0];
      const b = e.touches[1];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchRef.current = { startDist: dist, startZoom: zoom };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const a = e.touches[0];
      const b = e.touches[1];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const next = clamp(
        pinchRef.current.startZoom * (dist / pinchRef.current.startDist),
        MIN_ZOOM,
        MAX_ZOOM
      );
      setZoom(next);
      if (next <= 1) setPan({ x: 0, y: 0 });
    }
  };

  const onTouchEnd = () => {
    pinchRef.current = null;
  };

  const openFrom = originRect;
  const closeTo = exitRect ?? originRect;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const stageBasis = Math.min(vw * 0.72, vh * 0.72);

  // Fit inside the viewport without upscaling past native resolution.
  const fitMaxW = Math.min(vw * 0.94, natW);
  const fitMaxH = Math.min(vh * 0.72, natH);
  const fitScale = Math.min(fitMaxW / natW, fitMaxH / natH, 1);
  const displayW = Math.max(1, Math.round(natW * fitScale));
  const displayH = Math.max(1, Math.round(natH * fitScale));

  // Open/close motion — opacity + scale only. Never blur the photo itself.
  const frameEnter =
    openFrom && !reduceMotion
      ? {
          opacity: 0.9,
          scale: Math.min(openFrom.width, openFrom.height) / stageBasis,
          x: openFrom.x + openFrom.width / 2 - vw / 2,
          y: openFrom.y + openFrom.height / 2 - vh / 2,
        }
      : { opacity: 0, scale: 0.97, x: 0, y: 0 };

  const frameCenter = {
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
  };

  const frameExit =
    closeTo && !reduceMotion
      ? {
          opacity: 0.85,
          scale: Math.min(closeTo.width, closeTo.height) / stageBasis,
          x: closeTo.x + closeTo.width / 2 - vw / 2,
          y: closeTo.y + closeTo.height / 2 - vh / 2,
        }
      : { opacity: 0, scale: 0.97, x: 0, y: 0 };

  const glassBtn =
    "inline-flex h-11 w-11 items-center justify-center rounded-full " +
    "bg-white/[0.06] text-soft-white/75 ring-1 ring-white/10 " +
    "backdrop-blur-xl shadow-[0_8px_28px_rgba(0,0,0,0.35)] " +
    "transition-[transform,background-color,color,box-shadow] duration-300 " +
    "hover:bg-white/[0.12] hover:text-soft-white hover:shadow-[0_12px_36px_rgba(0,0,0,0.45)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 " +
    "active:scale-95";

  return (
    <motion.div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${image.alt || "Photo"} — ${currentIndex + 1} of ${images.length}`}
      tabIndex={-1}
      className="fixed inset-0 z-[200] outline-none"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => {
        if (exiting) onClose();
      }}
      onMouseMove={revealChrome}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      {/* Layered luxury backdrop — blur lives ONLY here, never on the photo */}
      <div className="pointer-events-none absolute inset-0 bg-[#090909]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: `url(${thumbSrc})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(24px) saturate(1.05)",
          transform: "scale(1.12)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 42%, rgba(255,255,255,0.05) 0%, transparent 55%), " +
            "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(0,0,0,0.78) 100%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-black/45"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />

      {/* Top-left info */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
            className="pointer-events-none absolute left-4 top-4 z-20 max-w-[min(70vw,22rem)] md:left-7 md:top-7"
          >
            <p className="text-[10px] uppercase tracking-[0.28em] text-soft-white/45">
              {categoryName}
            </p>
            {albumName && (
              <p className="mt-1 font-display text-lg font-light leading-tight text-soft-white/90 md:text-xl">
                {albumName}
              </p>
            )}
            <p className="mt-2 text-xs tracking-wider text-soft-white/40">
              {currentIndex + 1} / {images.length}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top-right toolbar */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute right-4 top-4 z-30 flex items-center gap-2 md:right-7 md:top-7"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={glassBtn}
              aria-label={zoomed ? "Reset zoom" : "Zoom in"}
              onClick={toggleZoom}
            >
              {zoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
            </button>
            <button
              type="button"
              className={glassBtn}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              type="button"
              className={glassBtn}
              aria-label="Download image"
              onClick={downloadImage}
            >
              <Download size={18} />
            </button>
            <button
              type="button"
              className={cn(glassBtn, "opacity-50")}
              aria-label="Share (coming soon)"
              title="Share — coming soon"
              disabled
            >
              <Share2 size={18} />
            </button>
            <button
              type="button"
              className={glassBtn}
              aria-label="Close photo viewer"
              onClick={requestClose}
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav arrows */}
      <AnimatePresence>
        {controlsVisible && currentIndex > 0 && !zoomed && (
          <motion.button
            type="button"
            initial={{ opacity: 0, x: -12 }}
            animate={{
              opacity: 1,
              x: magnetic.left.x,
              y: magnetic.left.y,
            }}
            exit={{ opacity: 0, x: -12 }}
            className={cn(
              "absolute left-3 top-1/2 z-20 -translate-y-1/2 md:left-6",
              "hidden h-14 w-14 sm:inline-flex",
              glassBtn
            )}
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const mx = ((e.clientX - r.left) / r.width - 0.5) * 10;
              const my = ((e.clientY - r.top) / r.height - 0.5) * 10;
              setMagnetic((m) => ({ ...m, left: { x: mx, y: my } }));
            }}
            onMouseLeave={() =>
              setMagnetic((m) => ({ ...m, left: { x: 0, y: 0 } }))
            }
          >
            <ChevronLeft size={26} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {controlsVisible && currentIndex < images.length - 1 && !zoomed && (
          <motion.button
            type="button"
            initial={{ opacity: 0, x: 12 }}
            animate={{
              opacity: 1,
              x: magnetic.right.x,
              y: magnetic.right.y,
            }}
            exit={{ opacity: 0, x: 12 }}
            className={cn(
              "absolute right-3 top-1/2 z-20 -translate-y-1/2 md:right-6",
              "hidden h-14 w-14 sm:inline-flex",
              glassBtn
            )}
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const mx = ((e.clientX - r.left) / r.width - 0.5) * 10;
              const my = ((e.clientY - r.top) / r.height - 0.5) * 10;
              setMagnetic((m) => ({ ...m, right: { x: mx, y: my } }));
            }}
            onMouseLeave={() =>
              setMagnetic((m) => ({ ...m, right: { x: 0, y: 0 } }))
            }
          >
            <ChevronRight size={26} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main image stage */}
      <div
        ref={stageRef}
        className="absolute inset-0 flex items-center justify-center px-3 pb-[5.5rem] pt-16 sm:px-10 sm:pb-28 sm:pt-20"
        style={
          {
            "--swipe-x": "0px",
            "--swipe-o": "1",
          } as CSSProperties
        }
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={(e) => {
          e.stopPropagation();
          toggleZoom();
        }}
      >
        <div
          className="relative flex max-h-full max-w-full items-center justify-center will-change-transform"
          style={{
            transform: "translateX(var(--swipe-x))",
            opacity: "var(--swipe-o)" as unknown as number,
          }}
        >
          <motion.div
            className="relative flex max-h-full max-w-full items-center justify-center"
            initial={frameEnter}
            animate={exiting ? frameExit : frameCenter}
            transition={{
              duration: reduceMotion ? 0.01 : exiting ? 0.38 : 0.55,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
          <div
            className={cn(
              "relative overflow-hidden",
              "rounded-[6px] sm:rounded-[8px]",
              "shadow-[0_30px_90px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.06)]",
              "transition-shadow duration-500"
            )}
            style={{
              width: displayW,
              height: displayH,
              maxWidth: "94vw",
              maxHeight: "72vh",
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isDragging
                ? "none"
                : "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
              cursor: zoomed ? "grab" : "zoom-in",
            }}
          >
            {/* Thumb placeholder while original loads — never the final display */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbSrc}
              alt=""
              aria-hidden
              className={cn(
                "absolute inset-0 h-full w-full object-contain",
                "transition-opacity duration-500",
                hiResLoaded ? "opacity-0" : "opacity-100"
              )}
              draggable={false}
            />
            {/* Sharp original — no blur, no filters, object-contain, unoptimized */}
            <MediaImage
              src={originalSrc}
              alt={image.alt}
              width={natW}
              height={natH}
              className={cn(
                "relative h-full w-full object-contain",
                "transition-opacity duration-500 ease-out",
                hiResLoaded ? "opacity-100" : "opacity-0"
              )}
              sizes={`${displayW}px`}
              quality={100}
              unoptimized
              priority
              onLoad={() => setHiResLoaded(true)}
            />
          </div>
          </motion.div>
        </div>
      </div>

      {/* Metadata — bottom left */}
      <AnimatePresence>
        {controlsVisible && metaBits.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-none absolute bottom-[5.25rem] left-4 z-20 hidden text-[10px] tracking-[0.18em] text-soft-white/35 uppercase sm:block md:bottom-28 md:left-7"
          >
            {metaBits.join("  ·  ")}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filmstrip */}
      <AnimatePresence>
        {filmstripVisible && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 bottom-0 z-30 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={revealChrome}
          >
            <div className="mx-auto max-w-5xl px-3">
              <div
                ref={filmstripRef}
                className={cn(
                  "flex gap-2 overflow-x-auto scroll-smooth py-3",
                  "rounded-2xl bg-black/35 px-3 ring-1 ring-white/8 backdrop-blur-xl",
                  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                )}
                role="listbox"
                aria-label="Photo filmstrip"
              >
                {images.map((img, i) => {
                  const active = i === currentIndex;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      data-strip-index={i}
                      aria-label={`Photo ${i + 1}`}
                      className={cn(
                        "relative h-14 w-14 shrink-0 overflow-hidden rounded-md sm:h-16 sm:w-16",
                        "ring-1 transition-[transform,box-shadow,opacity] duration-300",
                        active
                          ? "scale-105 ring-2 ring-gold/70 shadow-[0_0_24px_rgba(200,169,106,0.25)]"
                          : "ring-white/10 opacity-55 hover:opacity-90"
                      )}
                      onClick={() => {
                        onNavigate(i);
                        revealChrome();
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getGalleryThumbUrl(img.src, img.thumbnail)}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
