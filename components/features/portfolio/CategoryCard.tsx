"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import MediaImage from "@/components/ui/MediaImage";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

interface CategoryCardProps {
  category: Category;
  coverImage: string;
  interactionStrength: number;
  isHovered: boolean;
  isActive?: boolean;
  canHover: boolean;
  layout?: "coverflow" | "grid";
  onOpenGallery?: (category: string) => void;
}

const CategoryCard = forwardRef<HTMLDivElement, CategoryCardProps>(
  (
    {
      category,
      coverImage,
      interactionStrength,
      isHovered,
      isActive = false,
      canHover,
      layout = "coverflow",
      onOpenGallery,
    },
    ref
  ) => {
    const liftRef = useRef<HTMLDivElement>(null);
    const tiltRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [spotlightPos, setSpotlightPos] = useState<{ x: number; y: number } | null>(null);

    const isInteractive = interactionStrength > 0;
    const isTouchLayout = layout === "coverflow" && !canHover;

    const revealAmount = useMemo(() => {
      if (layout === "grid") return 1;
      if (!isInteractive && !isTouchLayout) return 0;
      if (canHover) {
        return isHovered ? Math.min(1, 0.55 + interactionStrength * 0.45) : 0;
      }
      return isActive ? 1 : 0;
    }, [
      interactionStrength,
      isHovered,
      isInteractive,
      canHover,
      layout,
      isActive,
      isTouchLayout,
    ]);

    useEffect(() => {
      const lift = liftRef.current;
      if (!lift) return;

      if (canHover) {
        gsap.to(lift, {
          y: isHovered ? -10 : 0,
          duration: 0.42,
          ease: "power4.out",
        });
        return;
      }

      gsap.to(lift, {
        y: isActive ? 0 : 12,
        duration: 0.62,
        ease: "power3.out",
      });
    }, [isHovered, canHover, isActive]);

    useEffect(() => {
      if (canHover || layout === "grid") return;

      const imageWrap = imageRef.current;
      const content = contentRef.current;
      if (!imageWrap) return;

      gsap.to(imageWrap, {
        scale: isActive ? 1 : 0.92,
        filter: isActive
          ? "blur(0px) grayscale(0) brightness(1)"
          : "blur(1px) grayscale(1) brightness(0.7)",
        opacity: isActive ? 1 : 0.7,
        duration: 0.62,
        ease: "power3.out",
        force3D: true,
      });

      if (content) {
        gsap.to(content, {
          y: isActive ? 0 : 20,
          opacity: isActive ? 1 : 0,
          duration: 0.62,
          ease: "power3.out",
        });
      }
    }, [isActive, canHover, layout]);

    const handleMouseMove = (e: React.MouseEvent) => {
      const tilt = tiltRef.current;
      if (!tilt || !canHover || !isHovered) return;

      const rect = tilt.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      // Update spotlight position (percentage within the card element)
      const cardEl = tilt.querySelector<HTMLElement>("[data-card-interactive]");
      if (cardEl) {
        const cardRect = cardEl.getBoundingClientRect();
        const pctX = ((e.clientX - cardRect.left) / cardRect.width) * 100;
        const pctY = ((e.clientY - cardRect.top) / cardRect.height) * 100;
        setSpotlightPos({ x: pctX, y: pctY });
      }

      gsap.to(tilt, {
        rotateY: x * 8,
        rotateX: -y * 6,
        duration: 0.35,
        ease: "power2.out",
        transformPerspective: 1200,
      });
    };

    const handleMouseLeave = () => {
      const tilt = tiltRef.current;
      if (!tilt) return;
      gsap.to(tilt, {
        rotateY: 0,
        rotateX: 0,
        duration: 0.45,
        ease: "power2.out",
      });
      setSpotlightPos(null);
    };

    const handleClick = () => {
      if (!isInteractive || !onOpenGallery) return;
      onOpenGallery(category.slug);
    };

    const isCoverflow = layout === "coverflow";

    const blurPx = canHover ? 1.5 * (1 - revealAmount) : 0;
    const grayscaleAmt = isCoverflow && canHover ? 1 : 1 - revealAmount;
    const brightness = canHover ? 0.72 + revealAmount * 0.28 : 1;
    const hoverScale = canHover ? 1 + revealAmount * 0.04 : 1;

    return (
      <div
        ref={ref}
        className={cn(
          layout === "coverflow" &&
            "absolute left-1/2 top-1/2 w-[var(--coverflow-card-width,clamp(240px,78vw,480px))]",
          layout === "grid" && "relative w-full max-w-[480px]",
          "will-change-transform"
        )}
        style={{
          transformStyle: "preserve-3d",
          pointerEvents: isCoverflow ? "none" : isInteractive ? "auto" : "none",
        }}
      >
        <div ref={liftRef} className="h-full w-full">
          <div
            ref={tiltRef}
            className={cn(
              "h-full w-full",
              !isCoverflow && isInteractive ? "cursor-pointer" : "cursor-default"
            )}
            style={{ transformStyle: "preserve-3d" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={isCoverflow ? undefined : handleClick}
            role={isCoverflow ? undefined : "button"}
            tabIndex={!isCoverflow && isInteractive ? 0 : -1}
            onKeyDown={
              isCoverflow
                ? undefined
                : (e) => {
                    if (e.key === "Enter" && isInteractive) handleClick();
                  }
            }
            aria-label={
              isInteractive || isActive
                ? `View ${category.name} gallery`
                : `${category.name} category`
            }
          >
            <div
              data-card-interactive=""
              className={cn(
                "group relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#081A12]",
                "shadow-[0_36px_110px_rgba(0,0,0,0.55)]",
                "transition-[box-shadow] duration-[400ms] ease-out",
                revealAmount > 0.35 &&
                  "shadow-[0_48px_140px_rgba(0,0,0,0.68),0_0_70px_rgba(15,61,46,0.32)]",
                revealAmount > 0.6 && "ring-1 ring-emerald/25",
                isTouchLayout && isActive && "ring-1 ring-gold/20"
              )}
            >
              <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl ring-1 ring-inset ring-white/10" />

              <div
                ref={imageRef}
                className="absolute inset-0"
                style={
                  isTouchLayout
                    ? {
                        transform: isActive ? "scale(1)" : "scale(0.92)",
                        filter: isActive
                          ? "blur(0px) grayscale(0) brightness(1)"
                          : "blur(1px) grayscale(1) brightness(0.7)",
                        opacity: isActive ? 1 : 0.7,
                        willChange: "transform, filter, opacity",
                      }
                    : undefined
                }
              >
                <MediaImage
                  src={coverImage}
                  alt=""
                  fill
                  className={cn(
                    "object-cover",
                    canHover &&
                      "transition-[transform,filter] duration-[420ms] ease-out"
                  )}
                  style={
                    canHover
                      ? {
                          transform: `scale(${hoverScale})`,
                          filter: `blur(${blurPx}px) grayscale(${grayscaleAmt}) brightness(${brightness})`,
                        }
                      : undefined
                  }
                  sizes="(max-width: 640px) 84vw, (max-width: 1024px) 70vw, 28vw"
                  priority={revealAmount > 0.5}
                />
                {/* Spotlight will be rendered outside this wrapper to avoid filter inheritance */}
              </div>

              <div
                className="pointer-events-none absolute inset-0 transition-opacity duration-[400ms] ease-out"
                style={{
                  background:
                    revealAmount > 0.4
                      ? "linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.15) 45%, rgba(15,61,46,0.1) 100%)"
                      : "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.15) 100%)",
                  opacity: isTouchLayout ? (isActive ? 1 : 0.85) : 1,
                }}
              />

              <div
                className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-[400ms] ease-out"
                style={{
                  opacity: revealAmount * 0.85,
                  background:
                    "radial-gradient(ellipse at 50% 80%, rgba(15,61,46,0.45) 0%, transparent 65%)",
                }}
              />

              <div
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl transition-opacity duration-[400ms] ease-out"
                style={{ opacity: revealAmount > 0.55 ? revealAmount : 0 }}
              >
                {revealAmount > 0.55 && (
                  <div className="absolute -inset-y-8 -left-full w-1/2 skew-x-[-16deg] bg-gradient-to-r from-transparent via-white/18 to-transparent animate-[coverflow-sweep_1.1s_ease-out_forwards]" />
                )}
              </div>

              {/* Spotlight: clear + color circle following cursor, isolated from any parent filter */}
              {canHover && isHovered && spotlightPos && (
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
                    className="object-cover"
                    style={{
                      transform: `scale(${hoverScale})`,
                      filter: "none",
                    }}
                    sizes="(max-width: 640px) 84vw, (max-width: 1024px) 70vw, 28vw"
                  />
                  {/* Soft vignette at edge of spotlight */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `radial-gradient(circle at ${spotlightPos.x}% ${spotlightPos.y}%, transparent 55%, rgba(0,0,0,0.5) 100%)`,
                    }}
                  />
                </div>
              )}

              <div
                ref={contentRef}
                className={cn(
                  "absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center",
                  canHover && "transition-all duration-[400ms] ease-out"
                )}
                style={
                  canHover
                    ? {
                        opacity: revealAmount,
                        transform: `translateY(${(1 - revealAmount) * 12}px)`,
                        pointerEvents: "none",
                      }
                    : {
                        opacity: isActive ? 1 : 0,
                        transform: isActive ? "translateY(0)" : "translateY(20px)",
                        pointerEvents: "none",
                      }
                }
              >
                <h3 className="font-display text-[clamp(1.5rem,3.5vw,2.4rem)] font-light tracking-[0.05em] text-soft-white">
                  {category.name}
                </h3>
                <p
                  className={cn(
                    "mt-3 text-[10px] uppercase tracking-[0.32em] text-gold/75",
                    canHover && "transition-opacity duration-[400ms]"
                  )}
                  style={
                    canHover
                      ? { opacity: revealAmount > 0.45 ? revealAmount : 0 }
                      : undefined
                  }
                >
                  Explore Collection
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

CategoryCard.displayName = "CategoryCard";
export default CategoryCard;
