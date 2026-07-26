"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Captions,
  ChevronLeft,
  ChevronRight,
  Download,
  Gauge,
  HelpCircle,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  RotateCcw,
  RotateCw,
  Share2,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { formatDuration } from "@/lib/video-meta";
import {
  clearPlaybackPosition,
  loadPlaybackPosition,
  loadPlayerRate,
  loadPlayerVolume,
  pushRecentlyViewed,
  savePlaybackPosition,
  savePlayerRate,
  savePlayerVolume,
} from "@/lib/video-player-prefs";
import { cn, formatCategoryName } from "@/lib/utils";
import type { GalleryVideo } from "@/types";
import type { VideoAnalyticsMetrics } from "@/types/video-analytics";

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const SEEK_STEP = 5;
const JUMP_STEP = 10;
const CONTROLS_HIDE_MS = 2500;

type VideoOrientation = "landscape" | "portrait" | "square";

function resolveOrientation(
  width?: number | null,
  height?: number | null,
  fallback?: GalleryVideo["orientation"]
): VideoOrientation {
  if (fallback === "landscape" || fallback === "portrait" || fallback === "square") {
    return fallback;
  }
  if (!width || !height) return "landscape";
  if (width > height) return "landscape";
  if (height > width) return "portrait";
  return "square";
}

interface VideoLightboxProps {
  video: GalleryVideo | null;
  playlist?: GalleryVideo[];
  onClose: () => void;
  onNavigate?: (video: GalleryVideo) => void;
  categoryLabel?: string;
  /** Reserved for real analytics data; metrics are never fabricated. */
  analytics?: VideoAnalyticsMetrics;
}

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Space / K", action: "Play / Pause" },
  { keys: "← / →", action: "Seek ±5s" },
  { keys: "J / L", action: "Seek ±10s" },
  { keys: "↑ / ↓", action: "Volume" },
  { keys: "M", action: "Mute" },
  { keys: "F", action: "Fullscreen" },
  { keys: "T", action: "Theater mode" },
  { keys: "R / Shift+R", action: "Rotate clockwise / counterclockwise" },
  { keys: "P", action: "Picture in Picture" },
  { keys: "N / B", action: "Next / Previous" },
  { keys: "Esc", action: "Close" },
  { keys: "?", action: "Shortcuts" },
];

export default function VideoLightbox({
  video,
  playlist = [],
  onClose,
  onNavigate,
  categoryLabel,
}: VideoLightboxProps) {
  return (
    <AnimatePresence>
      {video && (
        <LightboxContent
          key={video.id}
          video={video}
          playlist={playlist}
          onClose={onClose}
          onNavigate={onNavigate}
          categoryLabel={categoryLabel}
        />
      )}
    </AnimatePresence>
  );
}

function LightboxContent({
  video,
  playlist,
  onClose,
  onNavigate,
  categoryLabel,
}: {
  video: GalleryVideo;
  playlist: GalleryVideo[];
  onClose: () => void;
  onNavigate?: (video: GalleryVideo) => void;
  categoryLabel?: string;
}) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const lastTap = useRef<{ t: number; x: number } | null>(null);
  const posSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(() => loadPlayerVolume());
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [rate, setRate] = useState(() => loadPlayerRate());
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [ended, setEnded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theater, setTheater] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [rateMenuOpen, setRateMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "shared" | "copied">(
    "idle"
  );
  const [ambient, setAmbient] = useState("rgba(15,61,46,0.22)");
  const [exiting, setExiting] = useState(false);
  const [mediaW, setMediaW] = useState(video.width ?? null);
  const [mediaH, setMediaH] = useState(video.height ?? null);
  const [pipSupported] = useState(
    () =>
      typeof document !== "undefined" &&
      "pictureInPictureEnabled" in document &&
      Boolean(document.pictureInPictureEnabled)
  );

  const playlistIndex = playlist.findIndex((v) => v.id === video.id);
  const hasPlaylist = playlist.length > 1 && playlistIndex >= 0;
  const prevVideo =
    hasPlaylist && onNavigate
      ? playlist[(playlistIndex - 1 + playlist.length) % playlist.length]
      : null;
  const nextVideo =
    hasPlaylist && onNavigate
      ? playlist[(playlistIndex + 1) % playlist.length]
      : null;

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const remaining = useMemo(
    () => formatDuration(Math.max(0, duration - current)) || "00:00",
    [duration, current]
  );
  const elapsed = formatDuration(current) || "00:00";
  const categoryName =
    categoryLabel || formatCategoryName(video.category || "Videos");
  const albumName = video.albumSlug
    ? formatCategoryName(video.albumSlug)
    : null;
  const quarterTurn = rotation === 90 || rotation === 270;
  const effectiveW = quarterTurn ? mediaH : mediaW;
  const effectiveH = quarterTurn ? mediaW : mediaH;
  const rotatedFallback =
    quarterTurn && video.orientation === "portrait"
      ? "landscape"
      : quarterTurn && video.orientation === "landscape"
        ? "portrait"
        : video.orientation;
  const orientation = resolveOrientation(
    effectiveW,
    effectiveH,
    rotatedFallback
  );
  const effectiveRatio =
    effectiveW && effectiveH ? effectiveW / effectiveH : 16 / 9;
  const resLabel =
    mediaW && mediaH ? `${mediaW}×${mediaH}` : null;
  const orientationLabel =
    orientation === "portrait"
      ? "Portrait"
      : orientation === "square"
        ? "Square"
        : "Landscape";
  const uploadedLabel = video.createdAt
    ? new Date(video.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;
  const posterSrc = video.poster || video.thumbnail || "";

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false);
        setRateMenuOpen(false);
      }
    }, CONTROLS_HIDE_MS);
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const requestClose = useCallback(() => {
    const el = videoRef.current;
    if (el && Number.isFinite(el.currentTime)) {
      if (el.ended || el.currentTime >= (el.duration || 0) - 1.5) {
        clearPlaybackPosition(video.id);
      } else {
        savePlaybackPosition(video.id, el.currentTime);
      }
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    if (reduceMotion) {
      onClose();
      return;
    }
    setExiting(true);
  }, [onClose, reduceMotion, video.id]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused || el.ended) {
      setEnded(false);
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
    if (!el.muted && el.volume === 0) {
      el.volume = 0.6;
      setVolume(0.6);
      savePlayerVolume(0.6);
    }
  }, []);

  const seekBy = useCallback((delta: number) => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.min(
      Math.max(0, el.currentTime + delta),
      el.duration
    );
    setEnded(false);
  }, []);

  const seekTo = useCallback((ratio: number) => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.min(Math.max(0, ratio), 1) * el.duration;
    setEnded(false);
  }, []);

  const changeVolume = useCallback((value: number) => {
    const el = videoRef.current;
    if (!el) return;
    const v = Math.min(1, Math.max(0, value));
    el.volume = v;
    el.muted = v === 0;
    setVolume(v);
    setMuted(v === 0);
    savePlayerVolume(v);
  }, []);

  const applyRate = useCallback((value: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.playbackRate = value;
    setRate(value);
    savePlayerRate(value);
    setRateMenuOpen(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    // Fullscreen the player shell so the video can occupy the entire screen.
    const node = shellRef.current ?? containerRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      setTheater(false);
      node.requestFullscreen?.().catch(() => {});
    }
  }, []);

  const toggleTheater = useCallback(() => {
    setTheater((t) => !t);
    revealControls();
  }, [revealControls]);

  const rotateBy = useCallback(
    (degrees: 90 | -90) => {
      setRotation((value) => (value + degrees + 360) % 360);
      revealControls();
    },
    [revealControls]
  );

  const resetRotation = useCallback(() => {
    setRotation(0);
    revealControls();
  }, [revealControls]);

  const togglePip = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await el.requestPictureInPicture();
      }
    } catch {
      /* denied */
    }
  }, []);

  const replay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    clearPlaybackPosition(video.id);
    setEnded(false);
    el.play().catch(() => {});
  }, [video.id]);

  const retry = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    setError(false);
    setLoading(true);
    el.load();
    el.play().catch(() => {});
  }, []);

  const downloadVideo = useCallback(() => {
    const a = document.createElement("a");
    a.href = video.src;
    a.download = video.title || "video";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }, [video]);

  const shareVideo = useCallback(async () => {
    const payload = {
      title: video.title,
      text: `Watch ${video.title}`,
      url: video.src,
    };

    try {
      if (typeof navigator.share === "function") {
        await navigator.share(payload);
        setShareStatus("shared");
        return;
      }
      await navigator.clipboard.writeText(video.src);
      setShareStatus("copied");
    } catch (error) {
      // User-cancelled native shares are not failures.
      if (error instanceof DOMException && error.name === "AbortError") return;

      // Clipboard API can be unavailable in older/non-secure contexts.
      const input = document.createElement("textarea");
      input.value = video.src;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      setShareStatus("copied");
    }
  }, [video.src, video.title]);

  const goPrev = useCallback(() => {
    if (prevVideo && onNavigate) onNavigate(prevVideo);
  }, [prevVideo, onNavigate]);

  const goNext = useCallback(() => {
    if (nextVideo && onNavigate) onNavigate(nextVideo);
  }, [nextVideo, onNavigate]);

  // Safari AirPlay affordance
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.setAttribute("x-webkit-airplay", "allow");
  }, []);

  // Apply saved volume/rate + resume position + autoplay
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = volume;
    el.playbackRate = rate;
    pushRecentlyViewed(video.id);

    const resume = loadPlaybackPosition(video.id);
    const onMeta = () => {
      if (resume > 2 && resume < el.duration - 2) {
        el.currentTime = resume;
      }
    };
    el.addEventListener("loadedmetadata", onMeta, { once: true });

    el.play().catch(() => {
      el.muted = true;
      setMuted(true);
      el.play().catch(() => {});
    });

    return () => el.removeEventListener("loadedmetadata", onMeta);
    // mount-only for this video key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (posSaveTimer.current) clearTimeout(posSaveTimer.current);
    };
  }, []);

  useEffect(() => {
    const onFsChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Rotation swaps the element's box dimensions. Track the stage so a
  // quarter-turn uses height×width before transform, preventing clipping.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = (width: number, height: number) => {
      stage.style.setProperty("--video-stage-width", `${width}px`);
      stage.style.setProperty("--video-stage-height", `${height}px`);
    };
    const observer = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Media Session API
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: video.title,
        artist: "Naviure",
        album: categoryName,
        artwork: posterSrc
          ? [{ src: posterSrc, sizes: "1280x720", type: "image/jpeg" }]
          : [],
      });
      navigator.mediaSession.setActionHandler("play", () => {
        videoRef.current?.play().catch(() => {});
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        videoRef.current?.pause();
      });
      navigator.mediaSession.setActionHandler("seekbackward", () =>
        seekBy(-SEEK_STEP)
      );
      navigator.mediaSession.setActionHandler("seekforward", () =>
        seekBy(SEEK_STEP)
      );
      navigator.mediaSession.setActionHandler("previoustrack", goPrev);
      navigator.mediaSession.setActionHandler("nexttrack", goNext);
    } catch {
      /* unsupported handlers */
    }
  }, [video.title, categoryName, posterSrc, seekBy, goPrev, goNext]);

  // Subtle ambient sample from a paused/playing frame (throttled)
  useEffect(() => {
    if (reduceMotion || !ready) return;
    const el = videoRef.current;
    if (!el) return;
    let cancelled = false;
    const sample = () => {
      try {
        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas");
        }
        const canvas = canvasRef.current;
        canvas.width = 16;
        canvas.height = 9;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx || el.readyState < 2) return;
        ctx.drawImage(el, 0, 0, 16, 9);
        const data = ctx.getImageData(0, 0, 16, 9).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let i = 0; i < data.length; i += 16) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
        if (!n || cancelled) return;
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        setAmbient(`rgba(${r},${g},${b},0.18)`);
      } catch {
        /* CORS / not ready — keep brand ambient */
      }
    };
    sample();
    const id = window.setInterval(sample, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [ready, reduceMotion, video.id]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
          return;
        }
        if (theater) {
          setTheater(false);
          return;
        }
        requestClose();
        return;
      }

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }

      if (e.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables && focusables.length > 0) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
        return;
      }

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const role = target?.getAttribute?.("role");
      if (
        tag === "BUTTON" ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        role === "slider"
      ) {
        return;
      }

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          togglePlay();
          revealControls();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(-SEEK_STEP);
          revealControls();
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(SEEK_STEP);
          revealControls();
          break;
        case "j":
        case "J":
          e.preventDefault();
          seekBy(-JUMP_STEP);
          revealControls();
          break;
        case "l":
        case "L":
          e.preventDefault();
          seekBy(JUMP_STEP);
          revealControls();
          break;
        case "ArrowUp":
          e.preventDefault();
          changeVolume(volume + 0.1);
          revealControls();
          break;
        case "ArrowDown":
          e.preventDefault();
          changeVolume(volume - 0.1);
          revealControls();
          break;
        case "m":
        case "M":
          toggleMute();
          revealControls();
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "t":
        case "T":
          toggleTheater();
          break;
        case "r":
        case "R":
          e.preventDefault();
          rotateBy(e.shiftKey ? -90 : 90);
          break;
        case "p":
        case "P":
          togglePip();
          break;
        case "n":
        case "N":
          goNext();
          break;
        case "b":
        case "B":
          goPrev();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    helpOpen,
    theater,
    requestClose,
    togglePlay,
    seekBy,
    changeVolume,
    toggleMute,
    toggleFullscreen,
    toggleTheater,
    rotateBy,
    togglePip,
    goNext,
    goPrev,
    revealControls,
    volume,
  ]);

  useEffect(() => {
    scheduleHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [scheduleHide]);

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    setCurrent(el.currentTime);
    if (el.buffered.length > 0) {
      try {
        setBuffered(el.buffered.end(el.buffered.length - 1));
      } catch {
        /* ignore */
      }
    }
    if (posSaveTimer.current) clearTimeout(posSaveTimer.current);
    posSaveTimer.current = setTimeout(() => {
      if (!el.paused && el.currentTime > 2) {
        savePlaybackPosition(video.id, el.currentTime);
      }
    }, 1500);
  };

  const onStageDoubleClick = (e: ReactMouseEvent) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - bounds.left) / bounds.width;
    if (rel < 0.33) seekBy(-JUMP_STEP);
    else if (rel > 0.66) seekBy(JUMP_STEP);
    else togglePlay();
    revealControls();
  };

  const onStagePointerUp = (e: ReactPointerEvent) => {
    if (e.pointerType !== "touch") return;
    const now = Date.now();
    const prev = lastTap.current;
    if (prev && now - prev.t < 320) {
      const bounds = e.currentTarget.getBoundingClientRect();
      const rel = (e.clientX - bounds.left) / bounds.width;
      if (rel < 0.4) seekBy(-JUMP_STEP);
      else if (rel > 0.6) seekBy(JUMP_STEP);
      else togglePlay();
      lastTap.current = null;
      revealControls();
      return;
    }
    lastTap.current = { t: now, x: e.clientX };
  };

  const onWheel = (e: ReactWheelEvent) => {
    e.preventDefault();
    if (e.shiftKey && duration > 0) {
      seekBy(e.deltaY > 0 ? SEEK_STEP : -SEEK_STEP);
    } else {
      changeVolume(volume + (e.deltaY > 0 ? -0.05 : 0.05));
    }
    revealControls();
  };

  const glassBtn =
    "inline-flex h-10 w-10 items-center justify-center rounded-full " +
    "bg-white/[0.07] text-soft-white/80 ring-1 ring-white/12 " +
    "backdrop-blur-xl transition-[transform,background-color,color,box-shadow] duration-300 " +
    "hover:bg-white/[0.14] hover:text-soft-white hover:scale-105 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 " +
    "active:scale-95 motion-reduce:hover:scale-100";

  const stageClass = cn(
    "relative flex items-center justify-center bg-black",
    isFullscreen
      ? "min-h-0 w-full flex-1"
      : "mx-auto max-w-full"
  );
  const reserveRem = hasPlaylist ? (theater ? 10 : 13) : theater ? 6 : 9;
  const stageStyle: CSSProperties | undefined = isFullscreen
    ? undefined
    : {
        aspectRatio: String(effectiveRatio),
        width: `min(100%, calc((100dvh - ${reserveRem}rem) * ${effectiveRatio}))`,
        transition: reduceMotion
          ? "none"
          : "width 420ms cubic-bezier(0.22, 1, 0.36, 1), aspect-ratio 420ms cubic-bezier(0.22, 1, 0.36, 1)",
      };

  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 z-[200] outline-none"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.35, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => {
        if (exiting) onClose();
      }}
      onMouseMove={revealControls}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      {/* Cinematic backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-[#090909]" />
      {posterSrc && (
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage: `url(${posterSrc})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(22px) saturate(1.1)",
            transform: "scale(1.12)",
          }}
          aria-hidden
        />
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            `radial-gradient(ellipse 55% 45% at 50% 40%, ${ambient} 0%, transparent 60%),` +
            "radial-gradient(ellipse 80% 70% at 20% 80%, rgba(200,169,106,0.08) 0%, transparent 50%)," +
            "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 35%, rgba(0,0,0,0.78) 100%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.045] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Video player — ${video.title}`}
        tabIndex={-1}
        className={cn(
          "relative z-10 mx-auto flex w-full flex-col outline-none",
          isFullscreen
            ? "h-full max-w-none justify-stretch px-0 py-0"
            : cn(
                "h-full justify-center px-3 sm:px-5",
                theater
                  ? "max-w-[min(98vw,1680px)]"
                  : orientation === "portrait"
                    ? "max-w-[min(96vw,560px)]"
                    : "max-w-[min(96vw,1320px)]"
              )
        )}
        initial={{ opacity: 0, scale: 0.94, y: 28 }}
        animate={{
          opacity: exiting ? 0 : 1,
          scale: exiting ? 0.96 : 1,
          y: exiting ? 20 : 0,
        }}
        transition={{
          duration: reduceMotion ? 0.01 : 0.42,
          ease: [0.22, 1, 0.36, 1],
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top chrome */}
        <AnimatePresence>
          {controlsVisible && !isFullscreen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-3 flex items-start justify-between gap-3 sm:mb-4"
            >
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.28em] text-gold/65">
                  {categoryName}
                  {albumName ? ` · ${albumName}` : ""}
                </p>
                <h3 className="mt-1 truncate font-display text-xl font-light text-soft-white sm:text-2xl">
                  {video.title}
                </h3>
                <p className="mt-1 text-[11px] tracking-wide text-soft-white/40">
                  {[
                    video.duration ||
                      (duration ? formatDuration(duration) : null),
                    resLabel,
                    orientationLabel,
                    uploadedLabel,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className={glassBtn}
                  aria-label={
                    shareStatus === "copied"
                      ? "Video link copied"
                      : "Share video"
                  }
                  title={
                    shareStatus === "copied" ? "Link copied" : "Share video"
                  }
                  onClick={shareVideo}
                >
                  <Share2 size={18} />
                </button>
                <button
                  type="button"
                  className={glassBtn}
                  aria-label="Keyboard shortcuts"
                  onClick={() => setHelpOpen(true)}
                >
                  <HelpCircle size={18} />
                </button>
                <span className="sr-only" aria-live="polite">
                  {shareStatus === "copied"
                    ? "Video link copied to clipboard"
                    : shareStatus === "shared"
                      ? "Video shared"
                      : ""}
                </span>
                <button
                  type="button"
                  className={glassBtn}
                  aria-label="Close video"
                  onClick={requestClose}
                >
                  <X size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Glass player shell — fullscreen target */}
        <div
          ref={shellRef}
          className={cn(
            "relative flex min-h-0 flex-1 flex-col overflow-hidden",
            isFullscreen
              ? "h-full w-full rounded-none bg-black"
              : cn(
                  "rounded-2xl sm:rounded-3xl",
                  "bg-black/40 ring-1 ring-white/12",
                  "shadow-[0_40px_120px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)]",
                  "backdrop-blur-md"
                ),
            "transition-[border-radius,box-shadow] duration-300"
          )}
        >
          {/* Fullscreen overlay chrome */}
          {isFullscreen && controlsVisible && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <div className="min-w-0 pointer-events-none">
                <p className="text-[10px] uppercase tracking-[0.28em] text-gold/65">
                  {categoryName}
                </p>
                <h3 className="mt-1 truncate font-display text-lg text-soft-white">
                  {video.title}
                </h3>
              </div>
              <div className="pointer-events-auto flex gap-2">
                <button
                  type="button"
                  className={glassBtn}
                  aria-label="Share video"
                  onClick={shareVideo}
                >
                  <Share2 size={18} />
                </button>
                <button
                  type="button"
                  className={glassBtn}
                  aria-label="Exit fullscreen"
                  onClick={toggleFullscreen}
                >
                  <Minimize size={18} />
                </button>
                <button
                  type="button"
                  className={glassBtn}
                  aria-label="Close video"
                  onClick={requestClose}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          <div
            ref={stageRef}
            className={stageClass}
            style={stageStyle}
            onDoubleClick={onStageDoubleClick}
            onPointerUp={onStagePointerUp}
            onWheel={onWheel}
          >
            {/* Loading: blurred poster + shimmer */}
            {loading && !error && (
              <div className="absolute inset-0 z-[5]">
                {posterSrc && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={posterSrc}
                    alt=""
                    className="h-full w-full object-cover blur-[18px] scale-105 opacity-80"
                    aria-hidden
                  />
                )}
                <div className="absolute inset-0 animate-[video-card-shimmer_1.6s_ease-in-out_infinite] bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.06)_50%,transparent_60%)] bg-[length:200%_100%]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="h-12 w-12 animate-spin rounded-full border-2 border-white/15 border-t-gold" />
                </div>
              </div>
            )}

            <div
              className="absolute left-1/2 top-1/2 flex items-center justify-center"
              style={{
                width:
                  quarterTurn ? "var(--video-stage-height, 100%)" : "100%",
                height:
                  quarterTurn ? "var(--video-stage-width, 100%)" : "100%",
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                transition: reduceMotion
                  ? "none"
                  : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1), width 420ms cubic-bezier(0.22, 1, 0.36, 1), height 420ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <video
                ref={videoRef}
                src={video.src}
                poster={posterSrc || undefined}
                playsInline
                preload="auto"
                className={cn(
                  "h-full w-full object-contain transition-opacity duration-700",
                  ready && !loading ? "opacity-100" : "opacity-0"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                onPlay={() => {
                  setPlaying(true);
                  setEnded(false);
                }}
                onPause={() => setPlaying(false)}
                onWaiting={() => setLoading(true)}
                onCanPlay={() => {
                  setLoading(false);
                  setReady(true);
                }}
                onPlaying={() => {
                  setLoading(false);
                  setReady(true);
                }}
                onLoadedMetadata={(e) => {
                  const el = e.currentTarget;
                  setDuration(el.duration);
                  if (el.videoWidth > 0 && el.videoHeight > 0) {
                    setMediaW(el.videoWidth);
                    setMediaH(el.videoHeight);
                  }
                  setLoading(false);
                }}
                onTimeUpdate={handleTimeUpdate}
                onProgress={handleTimeUpdate}
                onEnded={() => {
                  setPlaying(false);
                  setEnded(true);
                  setControlsVisible(true);
                  clearPlaybackPosition(video.id);
                }}
                onError={() => {
                  setError(true);
                  setLoading(false);
                }}
                onVolumeChange={(e) => {
                  setMuted(e.currentTarget.muted);
                  setVolume(e.currentTarget.volume);
                }}
              />
            </div>

            {error && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 text-center">
                <AlertTriangle className="text-gold" size={40} />
                <p className="max-w-xs text-sm text-soft-white/80">
                  This video couldn&apos;t be loaded. Check your connection and
                  try again.
                </p>
                <button
                  type="button"
                  onClick={retry}
                  className="rounded-full border border-gold/50 px-5 py-2 text-xs uppercase tracking-[0.2em] text-gold transition hover:bg-gold/10"
                >
                  Retry
                </button>
              </div>
            )}

            {!error && (ended || !playing) && !loading && controlsVisible && (
              <button
                type="button"
                onClick={ended ? replay : togglePlay}
                aria-label={ended ? "Replay video" : "Play video"}
                className="absolute inset-0 z-10 flex items-center justify-center"
              >
                <span
                  className={cn(
                    "flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full",
                    "bg-white/[0.1] text-soft-white ring-1 ring-white/30 backdrop-blur-xl",
                    "shadow-[0_16px_48px_rgba(0,0,0,0.45)] transition hover:scale-105"
                  )}
                >
                  {ended ? (
                    <RotateCcw size={28} />
                  ) : (
                    <Play size={30} className="ml-1" fill="currentColor" />
                  )}
                </span>
              </button>
            )}

            {/* Side nav for playlist */}
            {prevVideo && controlsVisible && (
              <button
                type="button"
                className={cn(
                  "absolute left-3 top-1/2 z-20 -translate-y-1/2",
                  "hidden sm:inline-flex",
                  glassBtn
                )}
                aria-label="Previous video"
                onClick={goPrev}
              >
                <ChevronLeft size={22} />
              </button>
            )}
            {nextVideo && controlsVisible && (
              <button
                type="button"
                className={cn(
                  "absolute right-3 top-1/2 z-20 -translate-y-1/2",
                  "hidden sm:inline-flex",
                  glassBtn
                )}
                aria-label="Next video"
                onClick={goNext}
              >
                <ChevronRight size={22} />
              </button>
            )}

            {/* Floating glass control bar */}
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 z-20 px-2 pb-2 pt-16 sm:px-4 sm:pb-4",
                "bg-gradient-to-t from-black/80 via-black/35 to-transparent",
                "transition-opacity duration-300",
                controlsVisible || !playing
                  ? "opacity-100"
                  : "pointer-events-none opacity-0"
              )}
            >
              <SeekBar
                progress={progress}
                buffered={bufferedPct}
                duration={duration}
                current={current}
                posterSrc={posterSrc}
                onSeek={seekTo}
              />

              <div
                className={cn(
                  "mt-2 flex flex-wrap items-center gap-1 rounded-2xl px-1.5 py-1.5 sm:gap-1.5 sm:px-2",
                  "bg-black/35 ring-1 ring-white/10 backdrop-blur-xl"
                )}
              >
                <ControlButton
                  onClick={togglePlay}
                  label={playing ? "Pause" : "Play"}
                >
                  {playing ? (
                    <Pause size={18} />
                  ) : (
                    <Play size={18} fill="currentColor" />
                  )}
                </ControlButton>
                <ControlButton
                  onClick={() => seekBy(-JUMP_STEP)}
                  label="Replay 10 seconds"
                >
                  <SkipBack size={18} />
                </ControlButton>
                <ControlButton
                  onClick={() => seekBy(JUMP_STEP)}
                  label="Forward 10 seconds"
                >
                  <SkipForward size={18} />
                </ControlButton>

                <div className="flex items-center gap-1">
                  <ControlButton
                    onClick={toggleMute}
                    label={muted ? "Unmute" : "Mute"}
                  >
                    {muted || volume === 0 ? (
                      <VolumeX size={18} />
                    ) : (
                      <Volume2 size={18} />
                    )}
                  </ControlButton>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(e) => changeVolume(Number(e.target.value))}
                    aria-label="Volume"
                    className="hidden h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/25 accent-gold sm:block sm:w-20"
                  />
                </div>

                <span className="ml-1 select-none font-mono text-[10px] tabular-nums text-soft-white/65 sm:text-[11px]">
                  {elapsed}
                  <span className="text-soft-white/25"> / -</span>
                  {remaining}
                </span>

                <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
                  <div className="relative">
                    <ControlButton
                      onClick={() => setRateMenuOpen((o) => !o)}
                      label="Playback speed"
                      active={rate !== 1}
                    >
                      <span className="flex items-center gap-1 text-[10px] font-medium sm:text-[11px]">
                        <Gauge size={16} />
                        {rate}x
                      </span>
                    </ControlButton>
                    {rateMenuOpen && (
                      <div className="absolute bottom-full right-0 mb-2 w-24 overflow-hidden rounded-xl border border-white/10 bg-black/90 py-1 backdrop-blur-xl">
                        {PLAYBACK_RATES.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => applyRate(r)}
                            className={cn(
                              "block w-full px-3 py-1.5 text-right text-xs transition hover:bg-white/10",
                              r === rate ? "text-gold" : "text-soft-white/80"
                            )}
                          >
                            {r}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <ControlButton
                    onClick={() => {}}
                    label="Quality (coming soon)"
                    disabled
                  >
                    <span className="text-[10px] opacity-50">HD</span>
                  </ControlButton>
                  <ControlButton
                    onClick={() => {}}
                    label="Subtitles (coming soon)"
                    disabled
                  >
                    <Captions size={17} className="opacity-45" />
                  </ControlButton>

                  {pipSupported && (
                    <ControlButton
                      onClick={togglePip}
                      label="Picture in picture"
                    >
                      <PictureInPicture2 size={17} />
                    </ControlButton>
                  )}

                  <ControlButton
                    onClick={toggleTheater}
                    label={theater ? "Exit theater mode" : "Theater mode"}
                    active={theater}
                  >
                    <RectangleHorizontal size={17} />
                  </ControlButton>

                  <ControlButton
                    onClick={toggleFullscreen}
                    label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  >
                    {isFullscreen ? (
                      <Minimize size={17} />
                    ) : (
                      <Maximize size={17} />
                    )}
                  </ControlButton>

                  <ControlButton
                    onClick={() => rotateBy(90)}
                    label={`Rotate clockwise to ${(rotation + 90) % 360} degrees`}
                    active={rotation !== 0}
                  >
                    <RotateCw size={17} />
                  </ControlButton>

                  {rotation !== 0 && (
                    <ControlButton
                      onClick={resetRotation}
                      label="Reset rotation"
                    >
                      <RotateCcw size={17} />
                    </ControlButton>
                  )}

                  <ControlButton onClick={downloadVideo} label="Download">
                    <Download size={17} />
                  </ControlButton>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between px-1 text-[10px] tracking-wide text-soft-white/35">
                <span>
                  {rate}x · {orientationLabel}
                </span>
                <span className="opacity-50">Stream · R2</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mini playlist filmstrip */}
        {hasPlaylist && controlsVisible && !isFullscreen && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex gap-2 rounded-2xl bg-black/30 p-2 ring-1 ring-white/8 backdrop-blur-xl">
              {playlist.map((item) => {
                const active = item.id === video.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate?.(item)}
                    aria-label={item.title}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "relative h-14 w-24 shrink-0 overflow-hidden rounded-lg sm:h-16 sm:w-28",
                      "ring-1 transition duration-300",
                      active
                        ? "ring-2 ring-gold/70 shadow-[0_0_20px_rgba(200,169,106,0.2)]"
                        : "ring-white/10 opacity-55 hover:opacity-90"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.poster || item.thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Shortcut help */}
      <AnimatePresence>
        {helpOpen && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setHelpOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-label="Keyboard shortcuts"
              className="w-full max-w-md rounded-2xl bg-[#0c1410]/95 p-5 ring-1 ring-white/12 backdrop-blur-xl"
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h4 className="font-display text-lg text-soft-white">
                  Shortcuts
                </h4>
                <button
                  type="button"
                  className={glassBtn}
                  aria-label="Close shortcuts"
                  onClick={() => setHelpOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <ul className="space-y-2">
                {SHORTCUTS.map((row) => (
                  <li
                    key={row.keys}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="text-soft-white/75">{row.action}</span>
                    <kbd className="rounded-md bg-white/8 px-2 py-1 font-mono text-[11px] text-gold/80 ring-1 ring-white/10">
                      {row.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ControlButton({
  onClick,
  label,
  active = false,
  disabled = false,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        "flex h-9 min-w-9 items-center justify-center rounded-full px-2 transition",
        "hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active ? "text-gold" : "text-soft-white/85"
      )}
    >
      {children}
    </button>
  );
}

function SeekBar({
  progress,
  buffered,
  duration,
  current,
  posterSrc,
  onSeek,
}: {
  progress: number;
  buffered: number;
  duration: number;
  current: number;
  posterSrc: string;
  onSeek: (ratio: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [hover, setHover] = useState<{ ratio: number; x: number } | null>(
    null
  );

  const ratioFromEvent = (clientX: number) => {
    const el = barRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  useEffect(() => {
    if (!scrubbing) return;
    const move = (e: PointerEvent) => onSeek(ratioFromEvent(e.clientX));
    const up = () => setScrubbing(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [scrubbing, onSeek]);

  const previewRatio = scrubbing
    ? progress / 100
    : hover
      ? hover.ratio
      : null;
  const previewTime =
    previewRatio != null && duration > 0 ? previewRatio * duration : null;

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration) || 0}
      aria-valuenow={Math.round(current) || 0}
      tabIndex={0}
      onPointerDown={(e) => {
        setScrubbing(true);
        onSeek(ratioFromEvent(e.clientX));
      }}
      onPointerMove={(e) => {
        const ratio = ratioFromEvent(e.clientX);
        const rect = barRef.current?.getBoundingClientRect();
        if (!rect) return;
        setHover({ ratio, x: e.clientX - rect.left });
      }}
      onPointerLeave={() => {
        if (!scrubbing) setHover(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onSeek((current - 5) / (duration || 1));
        if (e.key === "ArrowRight") onSeek((current + 5) / (duration || 1));
      }}
      className="group/seek relative h-5 cursor-pointer touch-none select-none"
    >
      {previewTime != null && hover && posterSrc && (
        <div
          className="pointer-events-none absolute bottom-full mb-3 -translate-x-1/2 overflow-hidden rounded-lg ring-1 ring-white/20 shadow-2xl"
          style={{ left: hover.x }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={posterSrc}
            alt=""
            className="h-16 w-28 object-cover sm:h-20 sm:w-36"
          />
          <div className="bg-black/75 px-2 py-1 text-center font-mono text-[10px] text-soft-white/90">
            {formatDuration(previewTime)}
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20 transition-[height] group-hover/seek:h-1.5">
        <div
          className="absolute inset-y-0 left-0 bg-white/25"
          style={{ width: `${buffered}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold/90 to-gold"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div
        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold opacity-0 shadow-[0_0_12px_rgba(200,169,106,0.55)] transition-opacity group-hover/seek:opacity-100"
        style={{ left: `${progress}%` }}
      />
    </div>
  );
}
