"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
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
  const isEnteringRef = useRef(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const [triedFallback, setTriedFallback] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const router = useRouter();
  const { introComplete, setIntroComplete } = useApp();

  const handleEnter = useCallback(() => {
    if (isEnteringRef.current) return;
    isEnteringRef.current = true;

    const container = containerRef.current;
    if (!container) {
      setIntroComplete(true);
      router.push("/about", { scroll: false });
      return;
    }

    gsap.timeline({
      onComplete: () => {
        setIntroComplete(true);
        router.push("/about", { scroll: false });
      },
    }).to(container, {
      scale: 1.08,
      filter: "blur(28px) brightness(0.85)",
      opacity: 0,
      duration: 1.0,
      ease: "power3.inOut",
    });
  }, [router, setIntroComplete]);

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

    setVideoFailed(false);

    const playVideo = async () => {
      try {
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.load();
        await video.play();
      } catch {
        // Autoplay blocked or load failed — fallback to brand screen then enter
        setVideoFailed(true);
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
      }
    }, 2500);

    playVideo();

    return () => window.clearTimeout(fallbackTimer);
  }, [videoSrc, fallbackSrc, triedFallback]);

  // If video playback fails, automatically transition to site after a brief brand screen
  useEffect(() => {
    if (!videoFailed) return;
    const timer = window.setTimeout(() => {
      handleEnter();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [videoFailed, handleEnter]);

  const handleSourceError = () => {
    // Local missing → try Cloudflare R2; R2 missing → brand fallback UI
    if (fallbackSrc && !triedFallback && videoSrc !== fallbackSrc) {
      setTriedFallback(true);
      setVideoSrc(fallbackSrc);
      return;
    }
    setVideoFailed(true);
  };

  if (introComplete) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] overflow-hidden bg-[#030806] cursor-pointer"
      onClick={handleEnter}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " " || e.key === "Escape") && handleEnter()}
      role="button"
      tabIndex={0}
      aria-label="NAVIURE brand introduction"
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
          onEnded={handleEnter}
          onError={handleSourceError}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      {videoFailed && (
        <div className="absolute inset-0 z-[1] flex items-center justify-center px-8 text-center pointer-events-none">
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
    </div>
  );
}
