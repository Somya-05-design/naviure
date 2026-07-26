"use client";

import { useEffect, useRef } from "react";
import MediaImage from "@/components/ui/MediaImage";
import { gsap } from "gsap";
import PrimaryNavPill from "@/components/layout/PrimaryNavPill";
import PortfolioSecondaryNav from "@/components/layout/PortfolioSecondaryNav";
import { useScrollTrigger } from "@/hooks/useAnimations";
import {
  runPortfolioNavEntrance,
  setMainNavExpanded,
} from "@/hooks/useMainNavExpand";
import { useApp } from "@/hooks/useAppContext";
import {
  isPortfolioEntranceComplete,
  setPortfolioEntranceComplete,
} from "@/lib/portfolioNavState";
import { cn } from "@/lib/utils";

interface PortfolioHeroProps {
  image: string;
}

export default function PortfolioHero({ image }: PortfolioHeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const primaryHeaderRef = useRef<HTMLDivElement>(null);
  const primaryPillRef = useRef<HTMLElement>(null);
  const secondaryRef = useRef<HTMLDivElement>(null);
  const { setPortfolioMode } = useApp();

  useEffect(() => {
    setPortfolioMode(true);
    return () => setPortfolioMode(false);
  }, [setPortfolioMode]);

  useEffect(() => {
    const header = primaryHeaderRef.current;
    const pill = primaryPillRef.current;
    const secondary = secondaryRef.current;
    if (!header || !pill) return;

    if (isPortfolioEntranceComplete()) {
      setMainNavExpanded(header, pill);
      if (secondary) gsap.set(secondary, { y: 0, opacity: 1 });
      return;
    }

    const tl = runPortfolioNavEntrance(header, pill, secondary, true);
    tl?.eventCallback("onComplete", () => setPortfolioEntranceComplete(true));
  }, []);

  useScrollTrigger(() => {
    if (!sectionRef.current || !imageRef.current) return;

    gsap.fromTo(
      imageRef.current,
      { y: -12, scale: 1.06 },
      {
        y: 24,
        scale: 1.02,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      }
    );
  }, []);

  return (
    <>
      <div
        ref={primaryHeaderRef}
        className={cn(
          "fixed left-0 right-0 z-50 flex justify-center",
          "top-0 px-3 pt-[max(env(safe-area-inset-top,0px),0.75rem)]",
          "min-[1200px]:top-[calc(38vh-2.2rem)] min-[1200px]:px-4 min-[1200px]:pt-0"
        )}
      >
        <PrimaryNavPill ref={primaryPillRef} compact className="w-full min-[1200px]:w-auto" />
      </div>

      <section
        ref={sectionRef}
        className={cn(
          "relative overflow-hidden",
          "h-[clamp(28vh,32vh,35vh)] min-h-[200px] max-h-[320px]",
          "pt-[calc(max(env(safe-area-inset-top,0px),0.75rem)+3.5rem)]",
          "min-[768px]:h-[45vh] min-[768px]:min-h-[240px] min-[768px]:max-h-[400px]",
          "min-[1200px]:h-[clamp(38vh,42vh,45vh)] min-[1200px]:min-h-[300px] min-[1200px]:max-h-[520px] min-[1200px]:pt-0"
        )}
      >
        <div ref={imageRef} className="absolute inset-0">
          <MediaImage
            src={image}
            alt="NAVIURE Portfolio"
            fill
            priority
            className="object-cover object-[center_30%] blur-[3.5px]"
            sizes="100vw"
          />
        </div>

        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,16,13,0.22) 0%, rgba(15,23,18,0.38) 55%, rgba(10,16,13,0.55) 100%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#081A12] to-transparent min-[1200px]:h-32" />

        <div className="pointer-events-none absolute inset-0 z-10 hidden items-center justify-center min-[1200px]:flex">
          <span className="font-display text-[clamp(1.35rem,3vw,1.85rem)] font-medium tracking-[0.2em] text-soft-white/82">
            NAVIURE
          </span>
        </div>

        <div
          ref={secondaryRef}
          className={cn(
            "absolute bottom-5 left-0 right-0 z-20 hidden justify-center px-4 opacity-0",
            "min-[1200px]:flex min-[1200px]:bottom-[clamp(1rem,2.5vh,1.25rem)]"
          )}
        >
          <PortfolioSecondaryNav />
        </div>
      </section>
    </>
  );
}
