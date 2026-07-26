"use client";

import { useRef } from "react";
import MediaImage from "@/components/ui/MediaImage";
import { gsap } from "gsap";
import { useScrollTrigger } from "@/hooks/useAnimations";

interface HeroSectionProps {
  image: string;
}

export default function HeroSection({ image }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useScrollTrigger(() => {
    if (!sectionRef.current || !imageRef.current) return;

    gsap.fromTo(
      imageRef.current,
      { y: -12, scale: 1.06, filter: "blur(3.5px)" },
      {
        y: 24,
        scale: 1.02,
        filter: "blur(3.5px)",
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
    <section
      ref={sectionRef}
      className="relative h-[clamp(35vh,38vh,40vh)] min-h-[280px] max-h-[480px] overflow-hidden pt-[calc(max(env(safe-area-inset-top,0px),0.75rem)+3.5rem)] md:pt-0"
    >
      <div ref={imageRef} className="absolute inset-0">
        <MediaImage
          src={image}
          alt="NAVIURE Photography"
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

      <div className="absolute inset-0 bottom-[clamp(4.5rem,12vh,6rem)] flex items-center justify-center pointer-events-none">
        <span className="font-display text-[clamp(1.4rem,3.2vw,2rem)] font-medium tracking-[0.2em] text-soft-white/82">
          NAVIURE
        </span>
      </div>
    </section>
  );
}
