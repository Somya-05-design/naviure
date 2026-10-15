"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useScrollTrigger } from "@/hooks/useAnimations";
import type { ContactSettings, SocialLinks } from "@/types";

interface FooterProps {
  footerImage?: string;
  contact: ContactSettings;
  social: SocialLinks;
}

export default function Footer({ contact, social }: FooterProps) {
  const footerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useScrollTrigger(() => {
    if (!contentRef.current) return;
    gsap.from(contentRef.current.children, {
      scrollTrigger: {
        trigger: footerRef.current,
        start: "top 85%",
        toggleActions: "play none none reverse",
      },
      y: 40,
      opacity: 0,
      duration: 0.9,
      stagger: 0.1,
      ease: "power3.out",
    });
  }, []);

  return (
    <footer ref={footerRef} className="relative mt-auto overflow-hidden border-t border-white/[0.06]">
      <div className="relative h-[clamp(28vh,32vh,36vh)] min-h-[240px] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 18% 15%, rgba(15, 61, 46, 0.38), transparent 52%), radial-gradient(circle at 82% 85%, rgba(15, 61, 46, 0.22), transparent 48%), radial-gradient(circle at 50% 120%, rgba(200, 169, 106, 0.05), transparent 45%), linear-gradient(180deg, #070e0a 0%, #081A12 50%, #030806 100%)",
          }}
        />

        <div
          ref={contentRef}
          className="absolute bottom-[clamp(1.25rem,3vh,1.75rem)] left-[clamp(1.25rem,4vw,3.5rem)] z-[2] text-left"
        >
          <p className="m-0 font-display text-[clamp(0.95rem,1.6vw,1.15rem)] font-medium tracking-[0.2em] text-soft-white/82">
            NAVIURE
          </p>
          <p className="mt-1 font-body text-[clamp(0.62rem,0.95vw,0.72rem)] uppercase tracking-[0.18em] text-soft-white/48">
            Capture by Navii
          </p>

          <a
            href={social.email}
            className="mt-[0.35rem] block text-[clamp(0.62rem,0.95vw,0.72rem)] tracking-[0.1em] text-soft-white/55 transition-colors duration-300 hover:text-gold/88"
          >
            {contact.email}
          </a>
          <a
            href={social.phone}
            className="mt-[0.35rem] block text-[clamp(0.62rem,0.95vw,0.72rem)] tracking-[0.1em] text-soft-white/55 transition-colors duration-300 hover:text-gold/88"
          >
            {contact.phone}
          </a>

          <a
            href={social.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-[0.35rem] block text-[clamp(0.62rem,0.95vw,0.72rem)] tracking-[0.1em] text-soft-white/55 transition-colors duration-300 hover:text-gold/88"
          >
            Instagram
          </a>
          <a
            href={social.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-[0.35rem] block text-[clamp(0.62rem,0.95vw,0.72rem)] tracking-[0.1em] text-soft-white/55 transition-colors duration-300 hover:text-gold/88"
          >
            WhatsApp
          </a>

          <p className="mt-[0.65rem] text-[clamp(0.65rem,1vw,0.75rem)] uppercase tracking-[0.14em] text-soft-white/42">
            © {new Date().getFullYear()} NAVIURE
          </p>
        </div>
      </div>
    </footer>
  );
}
