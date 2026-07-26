"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import {
  INTRO_VIDEO_PORTRAIT,
  INTRO_VIDEO_LANDSCAPE,
  INTRO_VIDEO_PORTRAIT_LOCAL,
  INTRO_VIDEO_LANDSCAPE_LOCAL,
} from "@/lib/constants";
import { useApp } from "@/hooks/useAppContext";

function pickIntroSources(): { primary: string; fallback: string | null } {
  if (typeof window === "undefined") {
    return {
      primary: INTRO_VIDEO_LANDSCAPE_LOCAL || INTRO_VIDEO_LANDSCAPE,
      fallback: INTRO_VIDEO_LANDSCAPE_LOCAL ? INTRO_VIDEO_LANDSCAPE : null,
    };
  }
  const { innerWidth, innerHeight } = window;
  const isPortrait = innerHeight > innerWidth || innerWidth < 768;
  if (isPortrait) {
    return {
      primary: INTRO_VIDEO_PORTRAIT_LOCAL || INTRO_VIDEO_PORTRAIT,
      fallback: INTRO_VIDEO_PORTRAIT_LOCAL ? INTRO_VIDEO_PORTRAIT : null,
    };
  }
  return {
    primary: INTRO_VIDEO_LANDSCAPE_LOCAL || INTRO_VIDEO_LANDSCAPE,
    fallback: INTRO_VIDEO_LANDSCAPE_LOCAL ? INTRO_VIDEO_LANDSCAPE : null,
  };
}

export default function CinematicIntro() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const [triedFallback, setTriedFallback] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const router = useRouter();
  const { setIntroComplete, setIsTransitioning } = useApp();

  useEffect(() => {
    // Client-only source pick (reads device/UA); must run after mount.
    const sources = pickIntroSources();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVideoSrc(sources.primary);
    setFallbackSrc(sources.fallback);
    setTriedFallback(false);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    setVideoEnded(false);
    setVideoFailed(false);

    const playVideo = async () => {
      try {
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.load();
        await video.play();
      } catch {
        // Autoplay blocked or load failed — show enter UI
        setVideoFailed(true);
        setVideoEnded(true);
      }
    };

    const fallbackTimer = window.setTimeout(() => {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        if (fallbackSrc && !triedFallback) {
          setTriedFallback(true);
          setVideoSrc(fallbackSrc);
          return;
        }
        setVideoFailed(true);
        setVideoEnded(true);
      }
    }, 2500);

    playVideo();

    return () => window.clearTimeout(fallbackTimer);
  }, [videoSrc, fallbackSrc, triedFallback]);

  useEffect(() => {
    if (!videoEnded || !buttonRef.current) return;

    gsap.fromTo(
      buttonRef.current,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", delay: 0.15 }
    );
  }, [videoEnded]);

  const handleVideoEnd = () => setVideoEnded(true);

  const handleSourceError = () => {
    // Local missing → try Cloudflare R2; R2 missing → brand fallback UI
    if (fallbackSrc && !triedFallback && videoSrc !== fallbackSrc) {
      setTriedFallback(true);
      setVideoSrc(fallbackSrc);
      return;
    }
    setVideoFailed(true);
    setVideoEnded(true);
  };

  const handleEnter = useCallback(() => {
    if (isEntering || !videoEnded) return;
    setIsEntering(true);
    setIsTransitioning(true);

    const container = containerRef.current;
    if (!container) return;

    gsap.timeline({
      onComplete: () => {
        setIntroComplete(true);
        router.push("/about");
      },
    }).to(container, {
      scale: 1.06,
      filter: "blur(16px)",
      opacity: 0,
      duration: 1.1,
      ease: "power4.inOut",
    });
  }, [isEntering, videoEnded, router, setIntroComplete, setIsTransitioning]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] overflow-hidden bg-[#030806]"
      onClick={videoEnded ? handleEnter : undefined}
      onKeyDown={(e) => videoEnded && e.key === "Enter" && handleEnter()}
      role={videoEnded ? "button" : undefined}
      tabIndex={videoEnded ? 0 : -1}
      aria-label={videoEnded ? "Enter the NAVIURE experience" : "NAVIURE brand introduction"}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,61,46,0.28),rgba(3,8,6,0.96)_62%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/60" />

      {videoSrc && (
        <video
          ref={videoRef}
          key={videoSrc}
          muted
          playsInline
          autoPlay
          preload="auto"
          onCanPlay={() => setVideoFailed(false)}
          onEnded={handleVideoEnd}
          onError={handleSourceError}
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      {videoFailed && (
        <div className="absolute inset-0 z-[1] flex items-center justify-center px-8 text-center">
          <div>
            <p className="font-display text-2xl tracking-[0.18em] text-soft-white/85">
              NAVIURE
            </p>
            <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-gold/70">
              Luxury Photography
            </p>
          </div>
        </div>
      )}

      {videoEnded && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center px-6 pb-[7vh] md:pb-[6.5vh] pointer-events-none">
          <button
            ref={buttonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleEnter();
            }}
            className={cn(
              "pointer-events-auto luxury-enter-button rounded-full",
              "px-8 py-3 md:px-12 md:py-4",
              "text-[10px] md:text-[11px] uppercase tracking-[0.34em] font-light text-soft-white/90",
              "bg-black/12 border border-white/18 shadow-2xl shadow-black/45",
              "backdrop-blur-2xl",
              "transition-all duration-500",
              "hover:text-soft-white",
              "active:scale-[0.98]"
            )}
            aria-label="Enter or touch to continue"
          >
            Enter or touch to continue
          </button>
        </div>
      )}
    </div>
  );
}
