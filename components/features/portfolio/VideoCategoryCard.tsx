"use client";

import { useRef, useState } from "react";
import MediaImage from "@/components/ui/MediaImage";
import Link from "next/link";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { savePortfolioVideoCategory } from "@/lib/portfolio-navigation";
import type { Category } from "@/types";

interface VideoCategoryCardProps {
  category: Category;
  coverImage: string;
  priority?: boolean;
}

export default function VideoCategoryCard({
  category,
  coverImage,
  priority = false,
}: VideoCategoryCardProps) {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [spotlightPos, setSpotlightPos] = useState<{ x: number; y: number } | null>(null);

  const handleEnter = () => {
    setIsHovered(true);
  };

  const handleLeave = () => {
    setIsHovered(false);
    setSpotlightPos(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const article = articleRef.current;
    if (!article || !isHovered) return;
    const rect = article.getBoundingClientRect();
    setSpotlightPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  const handleClick = () => {
    savePortfolioVideoCategory(category.slug);

    const surface = surfaceRef.current;
    if (!surface) return;

    gsap.fromTo(
      surface,
      { scale: 1 },
      {
        scale: 0.98,
        duration: 0.1,
        ease: "power2.inOut",
        yoyo: true,
        repeat: 1,
      }
    );
  };

  return (
    <Link
      ref={cardRef}
      href={`/portfolio/videos/${category.slug}`}
      className="group block h-full cursor-pointer outline-none"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      aria-label={`Explore ${category.name}`}
    >
      <div
        ref={surfaceRef}
        className={cn(
          "relative h-full will-change-transform",
          "transition-[transform,box-shadow] duration-[450ms] ease-out",
          "group-hover:-translate-y-2 group-hover:scale-[1.03]",
          isHovered
            ? "shadow-[0_48px_120px_rgba(0,0,0,0.65),0_0_60px_rgba(15,61,46,0.35)]"
            : "shadow-[0_28px_80px_rgba(0,0,0,0.45)]"
        )}
      >
        <article
          ref={articleRef}
          className={cn(
            "relative aspect-[3/4] overflow-hidden rounded-[26px] bg-[#081A12]",
            "ring-1 ring-inset transition-[box-shadow,ring-color] duration-[450ms] ease-out",
            isHovered
              ? "ring-gold/40 shadow-[inset_0_0_0_1px_rgba(200,169,106,0.18)]"
              : "ring-white/10"
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-20 rounded-[26px] transition-opacity duration-[450ms]",
              isHovered
                ? "opacity-100 shadow-[0_0_40px_rgba(15,61,46,0.45)]"
                : "opacity-0"
            )}
          />

          <MediaImage
            src={coverImage}
            alt=""
            fill
            loading={priority ? "eager" : "lazy"}
            priority={priority}
            className={cn(
              "object-cover transition-[transform,filter] duration-[450ms] ease-out will-change-transform",
              isHovered
                ? "scale-105 blur-0 brightness-[0.88] contrast-[1.08] grayscale"
                : "scale-100 blur-[1.5px] brightness-[0.7] contrast-[0.96] grayscale"
            )}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />

          {/* Spotlight: clear + colored circle following cursor */}
          {isHovered && spotlightPos && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                zIndex: 5,
                clipPath: `circle(90px at ${spotlightPos.x}% ${spotlightPos.y}%)`,
                transition: "clip-path 0.06s linear",
                willChange: "clip-path",
              }}
            >
              <MediaImage
                src={coverImage}
                alt=""
                fill
                unoptimized
                placeholder="empty"
                priority
                className="object-cover scale-105"
                style={{ filter: "none" }}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              {/* Soft vignette edge */}
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(circle at ${spotlightPos.x}% ${spotlightPos.y}%, transparent 55%, rgba(0,0,0,0.6) 100%)`,
                }}
              />
            </div>
          )}


          <div
            className={cn(
              "pointer-events-none absolute inset-0 transition-opacity duration-[450ms] ease-out",
              isHovered
                ? "bg-gradient-to-t from-black/55 via-black/15 to-emerald/10 opacity-100"
                : "bg-gradient-to-t from-black/70 via-black/35 to-emerald/20 opacity-100"
            )}
          />

          <div
            className={cn(
              "pointer-events-none absolute inset-0 rounded-[26px] transition-opacity duration-[450ms]",
              isHovered ? "bg-white/[0.03] opacity-60" : "bg-white/[0.06] opacity-100"
            )}
          />

          <div
            className={cn(
              "absolute inset-0 z-10 flex items-center justify-center px-6 text-center",
              "pointer-events-none"
            )}
          >
            <h3
              className={cn(
                "font-display text-[clamp(1.35rem,2.8vw,2rem)] font-light tracking-[0.04em] text-soft-white",
                "transition-all duration-[450ms] ease-out",
                isHovered
                  ? "translate-y-0 opacity-100"
                  : "translate-y-5 opacity-0"
              )}
            >
              {category.name}
            </h3>
          </div>
        </article>
      </div>
    </Link>
  );
}
