import { getAssetUrl, getVideoAssetUrl, getLocalVideoFallback } from "@/lib/assets";

export const COLORS = {
  black: "#0A0A0A",
  matteBlack: "#08100c",
  deepEmerald: "#081A12",
  forestGreen: "#0D2218",
  emerald: "#0F3D2E",
  glassWhite: "rgba(255, 255, 255, 0.08)",
  softWhite: "#F8F7F2",
  gold: "#C8A96A",
} as const;

export const NAV_ITEMS = [
  { id: "about", label: "About", href: "/about" },
  { id: "portfolio", label: "Portfolio", href: "/portfolio" },
  { id: "contact", label: "Contact", href: "/contact" },
] as const;

export const PORTFOLIO_NAV = [
  { id: "photos", label: "Photos", href: "/portfolio/photos" },
  { id: "videos", label: "Videos", href: "/portfolio/videos" },
] as const;

export const PHOTO_CATEGORIES = [
  { slug: "wedding", name: "Wedding" },
  { slug: "pre-wedding", name: "Pre Wedding" },
  { slug: "portraits", name: "Portrait" },
  { slug: "club-photography", name: "Club Photography" },
  { slug: "maternity", name: "Maternity" },
] as const;

export const VIDEO_CATEGORIES = [
  { slug: "wedding", name: "Wedding Films" },
  { slug: "pre-wedding", name: "Pre Wedding Films" },
  { slug: "portraits", name: "Portrait Films" },
  { slug: "maternity", name: "Maternity Films" },
  { slug: "club-events", name: "Club Events" },
] as const;

export const CURSOR_LABELS = {
  default: "",
  view: "View",
  open: "Open",
  play: "Play",
  explore: "Explore",
  drag: "Drag",
} as const;

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://naviure.in";

/** Logo reveal intro — portrait (mobile). R2 primary; local path for fallback. */
export const INTRO_VIDEO_PORTRAIT = getVideoAssetUrl("logo-reveal-intro");
export const INTRO_VIDEO_PORTRAIT_LOCAL = getLocalVideoFallback("logo-reveal-intro");

/** Logo reveal intro — landscape (desktop). R2 primary; local path for fallback. */
export const INTRO_VIDEO_LANDSCAPE = getVideoAssetUrl("logo-reveal-transition");
export const INTRO_VIDEO_LANDSCAPE_LOCAL = getLocalVideoFallback("logo-reveal-transition");

/** Global hero — served LOCAL for critical UI reliability */
export const GLOBAL_HERO_IMAGE = getAssetUrl("hero-cinematic");

/** Global footer — served LOCAL for critical UI reliability */
export const GLOBAL_FOOTER_IMAGE = getAssetUrl("footer-wedding");
