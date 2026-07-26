"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { PORTFOLIO_NAV } from "@/lib/constants";

interface PortfolioSecondaryNavProps {
  className?: string;
  variant?: "pill" | "segmented";
}

let lastActiveIndex = -1;

export default function PortfolioSecondaryNav({
  className,
  variant = "pill",
}: PortfolioSecondaryNavProps) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;

    const activeIndex = PORTFOLIO_NAV.findIndex((item) => pathname === item.href);
    const resolvedIndex = activeIndex >= 0 ? activeIndex : 0;
    const activeLink = linkRefs.current[resolvedIndex];
    if (!activeLink) return;

    const navRect = nav.getBoundingClientRect();
    const targetRect = activeLink.getBoundingClientRect();
    const target = {
      left: targetRect.left - navRect.left,
      width: targetRect.width,
    };

    const cameFromOtherTab =
      lastActiveIndex >= 0 && lastActiveIndex !== resolvedIndex;
    const fromLink = linkRefs.current[lastActiveIndex];

    if (cameFromOtherTab && fromLink) {
      const fromRect = fromLink.getBoundingClientRect();
      gsap.set(indicator, {
        left: fromRect.left - navRect.left,
        width: fromRect.width,
        opacity: 1,
      });
      gsap.to(indicator, {
        left: target.left,
        width: target.width,
        opacity: 1,
        duration: 0.5,
        ease: "power4.inOut",
      });
    } else {
      gsap.set(indicator, { ...target, opacity: 1 });
    }

    lastActiveIndex = resolvedIndex;
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      className={cn(
        "glass-dark relative overflow-hidden border border-white/10 backdrop-blur-2xl",
        variant === "segmented"
          ? "w-full rounded-2xl px-1.5 py-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.35)]"
          : "max-w-[440px] rounded-full px-2 py-1.5 shadow-[0_22px_90px_rgba(0,0,0,0.35)]",
        className
      )}
      aria-label="Portfolio navigation"
    >
      <span
        ref={indicatorRef}
        className={cn(
          "pointer-events-none absolute bg-gold/14 shadow-[inset_0_0_0_1px_rgba(200,169,106,0.26)]",
          variant === "segmented"
            ? "top-1.5 bottom-1.5 rounded-xl"
            : "top-1.5 bottom-1.5 rounded-full"
        )}
        style={{ left: 0, width: 0, opacity: 0 }}
        aria-hidden
      />
      <ul className="relative flex items-stretch gap-1">
        {PORTFOLIO_NAV.map((item, index) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.id} className="flex-1">
              <Link
                ref={(el) => {
                  linkRefs.current[index] = el;
                }}
                href={item.href}
                className={cn(
                  "relative z-[1] flex min-h-12 items-center justify-center rounded-xl px-4 text-center text-[11px] uppercase tracking-[0.22em] font-light transition-all duration-500 ease-out min-[1200px]:min-h-0 min-[1200px]:rounded-full min-[1200px]:py-2.5 min-[1200px]:text-[10px]",
                  isActive
                    ? "text-gold [text-shadow:0_0_12px_rgba(200,169,106,0.35)]"
                    : "text-soft-white/50 hover:text-soft-white/90"
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
