"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/hooks/useAppContext";
import { gsap } from "gsap";

export default function PageTransition() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { isTransitioning, setIsTransitioning } = useApp();

  useEffect(() => {
    if (!isTransitioning) return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    const tl = gsap.timeline({
      onComplete: () => setIsTransitioning(false),
    });

    tl.set(overlay, { display: "block", scaleY: 0, transformOrigin: "top" })
      .to(overlay, { scaleY: 1, duration: 0.6, ease: "power4.inOut" })
      .to(overlay, { scaleY: 0, transformOrigin: "bottom", duration: 0.6, ease: "power4.inOut", delay: 0.2 })
      .set(overlay, { display: "none" });

    return () => {
      tl.kill();
    };
  }, [isTransitioning, setIsTransitioning]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[10000] hidden bg-deep-emerald origin-top"
      aria-hidden="true"
    />
  );
}
