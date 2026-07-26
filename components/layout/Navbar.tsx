"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import PrimaryNavPill from "@/components/layout/PrimaryNavPill";
import { useMainNavExpand } from "@/hooks/useMainNavExpand";
import { useApp } from "@/hooks/useAppContext";
import { setPortfolioEntranceComplete } from "@/lib/portfolioNavState";

export default function Navbar() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLElement>(null);
  const { setPortfolioMode } = useApp();
  const isPortfolio = pathname.startsWith("/portfolio");

  useEffect(() => {
    setPortfolioMode(isPortfolio);
    if (!isPortfolio) setPortfolioEntranceComplete(false);
  }, [isPortfolio, setPortfolioMode]);

  useMainNavExpand(headerRef, pillRef, {
    compact: false,
    enabled: !isPortfolio && pathname !== "/",
  });

  useEffect(() => {
    const header = headerRef.current;
    if (!header || isPortfolio) return;

    gsap.fromTo(
      header,
      { y: 20, opacity: 0.85 },
      { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
    );
  }, [isPortfolio]);

  if (pathname === "/" || isPortfolio) return null;

  return (
    <header
      ref={headerRef}
      className={cn(
        "fixed left-0 right-0 z-50 flex justify-center",
        "top-0 px-2 pt-[max(env(safe-area-inset-top,0px),0.75rem)]",
        "md:top-[calc(38vh-2.2rem)] md:px-4 md:pt-0"
      )}
    >
      <PrimaryNavPill ref={pillRef} className="w-full md:w-auto" />
    </header>
  );
}
