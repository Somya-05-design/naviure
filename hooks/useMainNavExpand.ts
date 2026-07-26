"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Pill cap radius — kept at full width so edges stay curved */
const MAIN_NAV_RADIUS = 9999;
const EXPANDED_SIDE_GAP = 8;
const DESKTOP_NAV_QUERY = "(min-width: 768px)";

function isDesktopNavLayout() {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_NAV_QUERY).matches;
}

function applyMobileNavLayout(
  headerRef: HTMLElement | null,
  pillRef: HTMLElement | null
) {
  if (pillRef) {
    gsap.set(pillRef, { clearProps: "width,maxWidth,borderRadius" });
  }
  if (headerRef) {
    gsap.set(headerRef, { clearProps: "top,paddingLeft,paddingRight" });
  }
}

interface UseMainNavExpandOptions {
  compact?: boolean;
  enabled?: boolean;
  /** Pin to top of viewport when expanded (About/Contact) */
  pinToTop?: boolean;
  /** Hero bottom offset when collapsed — e.g. calc(38vh - 2.2rem) */
  collapsedTop?: string;
}

export function useMainNavExpand(
  headerRef: RefObject<HTMLElement | null>,
  pillRef: RefObject<HTMLElement | null>,
  {
    compact = false,
    enabled = true,
    pinToTop = true,
    collapsedTop = "calc(38vh - 2.2rem)",
  }: UseMainNavExpandOptions = {}
) {
  useEffect(() => {
    if (!enabled) return;

    const header = headerRef.current;
    const pill = pillRef.current;
    if (!header || !pill) return;

    if (!isDesktopNavLayout()) {
      applyMobileNavLayout(header, pill);
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const collapsedWidth = compact ? 440 : 520;

    if (reducedMotion) {
      gsap.set(pill, { width: "100%", borderRadius: MAIN_NAV_RADIUS });
      if (pinToTop) {
        gsap.set(header, {
          top: 0,
          paddingLeft: EXPANDED_SIDE_GAP,
          paddingRight: EXPANDED_SIDE_GAP,
        });
      }
      return;
    }

    gsap.set(pill, { width: collapsedWidth, maxWidth: "none", borderRadius: MAIN_NAV_RADIUS });
    if (pinToTop) gsap.set(header, { top: collapsedTop, paddingLeft: 16, paddingRight: 16 });

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: document.documentElement,
          start: "top top",
          end: "+=140",
          scrub: 0.45,
        },
      });

      tl.to(
        pill,
        {
          width: "100%",
          ease: "power2.out",
        },
        0
      );

      if (pinToTop) {
        tl.to(
          header,
          {
            top: 0,
            paddingLeft: EXPANDED_SIDE_GAP,
            paddingRight: EXPANDED_SIDE_GAP,
            ease: "power2.out",
          },
          0
        );
      }
    });

    return () => ctx.revert();
  }, [headerRef, pillRef, compact, enabled, pinToTop, collapsedTop]);
}

/** Expand main nav to full width (portfolio sticky state) */
export function expandMainNavToFull(
  headerRef: HTMLElement | null,
  pillRef: HTMLElement | null,
  duration = 0.55
) {
  if (!pillRef) return;

  gsap.to(pillRef, {
    width: "100%",
    duration,
    ease: "power3.out",
  });

  if (headerRef) {
    gsap.to(headerRef, {
      paddingLeft: EXPANDED_SIDE_GAP,
      paddingRight: EXPANDED_SIDE_GAP,
      duration,
      ease: "power3.out",
    });
  }
}

export function setMainNavExpanded(
  headerRef: HTMLElement | null,
  pillRef: HTMLElement | null
) {
  if (pillRef) {
    gsap.set(pillRef, { width: "100%", maxWidth: "none", borderRadius: MAIN_NAV_RADIUS });
  }
  if (headerRef) {
    gsap.set(headerRef, {
      top: 0,
      paddingLeft: EXPANDED_SIDE_GAP,
      paddingRight: EXPANDED_SIDE_GAP,
    });
  }
}

/** Portfolio page entry — main nav expands to full width, secondary nav rises into place */
export function runPortfolioNavEntrance(
  headerRef: HTMLElement | null,
  pillRef: HTMLElement | null,
  secondaryRef: HTMLElement | null,
  compact = true,
  mobileSecondaryRef: HTMLElement | null = null
) {
  if (!pillRef || !headerRef) return;

  if (!isDesktopNavLayout()) {
    applyMobileNavLayout(headerRef, pillRef);
    if (secondaryRef) gsap.set(secondaryRef, { y: 0, opacity: 1 });
    if (mobileSecondaryRef) gsap.set(mobileSecondaryRef, { y: 0, opacity: 1 });
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const collapsedWidth = compact ? 440 : 520;
  const collapsedTop = "calc(38vh - 2.2rem)";

  if (reducedMotion) {
    setMainNavExpanded(headerRef, pillRef);
    if (secondaryRef) gsap.set(secondaryRef, { y: 0, opacity: 1 });
    return;
  }

  gsap.set(pillRef, { width: collapsedWidth, maxWidth: "none", borderRadius: MAIN_NAV_RADIUS });
  gsap.set(headerRef, { top: collapsedTop, paddingLeft: 16, paddingRight: 16 });
  if (secondaryRef) gsap.set(secondaryRef, { y: 88, opacity: 0 });

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  tl.to(
    pillRef,
    { width: "100%", duration: 0.72 },
    0
  ).to(
    headerRef,
    {
      top: 0,
      paddingLeft: EXPANDED_SIDE_GAP,
      paddingRight: EXPANDED_SIDE_GAP,
      duration: 0.72,
    },
    0
  );

  if (secondaryRef) {
    tl.to(
      secondaryRef,
      { y: 0, opacity: 1, duration: 0.85, ease: "power3.out" },
      0.22
    );
  }

  return tl;
}

export function collapseMainNav(
  headerRef: HTMLElement | null,
  pillRef: HTMLElement | null,
  compact = false
) {
  if (!pillRef) return;
  const collapsedWidth = compact ? 440 : 520;

  gsap.to(pillRef, {
    width: collapsedWidth,
    borderRadius: MAIN_NAV_RADIUS,
    duration: 0.45,
    ease: "power2.out",
  });

  if (headerRef) {
    gsap.to(headerRef, {
      paddingLeft: 16,
      paddingRight: 16,
      duration: 0.45,
      ease: "power2.out",
    });
  }
}
