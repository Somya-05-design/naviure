"use client";

import { useRef } from "react";
import MediaImage from "@/components/ui/MediaImage";
import { gsap } from "gsap";
import { useScrollTrigger } from "@/hooks/useAnimations";
import type { AboutContent } from "@/types";

export default function AboutContent({ content }: { content: AboutContent }) {
  const sectionRef = useRef<HTMLElement>(null);

  useScrollTrigger(() => {
    const section = sectionRef.current;
    if (!section) return;

    gsap.from(".editorial-reveal", {
      scrollTrigger: {
        trigger: section,
        start: "top 74%",
        toggleActions: "play none none reverse",
      },
      y: 48,
      opacity: 0,
      duration: 1.15,
      stagger: 0.12,
      ease: "power3.out",
    });

    gsap.from(".editorial-image", {
      scrollTrigger: {
        trigger: ".editorial-image-wrap",
        start: "top 75%",
        toggleActions: "play none none reverse",
      },
      y: 42,
      scale: 1.06,
      opacity: 0,
      duration: 1.4,
      ease: "power3.out",
    });

    gsap.to(".floating-portrait", {
      scrollTrigger: {
        trigger: ".intro-editorial",
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
      y: -34,
      ease: "none",
    });
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative mx-auto max-w-[1280px] px-5 pb-20 pt-24 md:px-10 md:pb-28 md:pt-32 lg:px-16"
    >
      <div className="intro-editorial grid grid-cols-1 items-center gap-14 md:grid-cols-[1.05fr_0.95fr] lg:gap-24">
        <div className="max-w-[620px]">
          <p className="editorial-reveal mb-10 text-[10px] uppercase tracking-[0.34em] text-soft-white/32">
            NAVIURE — ABOUT
          </p>
          <h1 className="editorial-reveal font-display text-[clamp(3.2rem,7vw,6.9rem)] font-light leading-[0.92] tracking-[-0.045em] text-soft-white">
            Memories Become Timeless Art
          </h1>
          <div className="mt-9 space-y-5">
            <p className="editorial-reveal max-w-[560px] text-[15px] font-light leading-[1.85] text-soft-white/64 md:text-base">
              Every photograph holds a feeling that words often fail to capture. At NAVIURE, we believe photography is more than preserving memories — it is about preserving emotions, connections, and the fleeting moments that define our lives.
            </p>
            <p className="editorial-reveal max-w-[560px] text-[15px] font-light leading-[1.85] text-soft-white/56 md:text-base">
              With a cinematic eye and a quiet editorial approach, each frame is shaped with intention, softness, and timeless restraint.
            </p>
          </div>
        </div>

        <div className="editorial-image-wrap floating-portrait relative mx-auto w-full max-w-[420px] overflow-hidden rounded-[2px] shadow-[0_34px_110px_rgba(0,0,0,0.42)] md:max-w-[470px]">
          <div className="relative aspect-[0.72]">
            <MediaImage
              src={content.photographerImage}
              alt={content.name}
              fill
              className="editorial-image object-cover"
              sizes="(max-width: 768px) 90vw, 42vw"
            />
          </div>
          <div className="absolute inset-0 border border-white/8" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#081A12]/18 to-transparent" />
        </div>
      </div>

      <div className="mt-28 grid grid-cols-1 items-start gap-14 md:mt-40 md:grid-cols-[0.95fr_1.05fr] lg:gap-24">
        <div className="editorial-image-wrap relative w-full overflow-hidden rounded-[2px] shadow-[0_30px_95px_rgba(0,0,0,0.34)]">
          <div className="relative aspect-[0.86] md:aspect-[0.78]">
            <MediaImage
              src={content.photographerImage}
              alt={`${content.name} portrait`}
              fill
              className="editorial-image object-cover object-top"
              sizes="(max-width: 768px) 100vw, 46vw"
            />
          </div>
          <div className="absolute inset-0 border border-white/8" />
        </div>

        <div className="max-w-[650px] pt-2 md:pt-8">
          <p className="editorial-reveal mb-8 text-[10px] uppercase tracking-[0.36em] text-gold/58">
            About Us
          </p>
          <div className="space-y-7 text-[15px] font-light leading-[1.88] text-soft-white/62 md:text-base">
            <p className="editorial-reveal">
              {content.story}
            </p>
            <p className="editorial-reveal">
              Our approach is built on authenticity. We do not simply document events; we observe, anticipate, and tell stories through carefully crafted imagery. Whether it is a wedding, an intimate portrait, a maternity session, or a cinematic celebration, every frame is created with purpose, elegance, and timeless artistry.
            </p>
            <p className="editorial-reveal">
              Using a professional full-frame workflow, we focus on natural emotions, refined compositions, and cinematic lighting to create photographs that remain meaningful for generations.
            </p>
            <p className="editorial-reveal">
              Every project is personal. We take the time to understand your story, your vision, and the moments that matter most, ensuring every image reflects who you truly are — not just how the day looked, but how it felt.
            </p>
            <p className="editorial-reveal text-soft-white/72">
              Welcome to NAVIURE — where memories become timeless, emotions become art, and every photograph tells a story worth remembering.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
