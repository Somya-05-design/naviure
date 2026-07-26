import { gsap } from "gsap";

export const COVERFLOW_INTERACTION_ZONE = 0.72;

export type DeviceTier = "mobile" | "tablet" | "desktop";

export function getDeviceTier(viewportWidth?: number): DeviceTier {
  const vw =
    viewportWidth ??
    (typeof window !== "undefined" ? window.innerWidth : 1280);
  if (vw < 640) return "mobile";
  if (vw < 1024) return "tablet";
  return "desktop";
}

/** 0–1 strength: 1 at center, fades to 0 at zone edge. Overlapping zones keep scroll transitions alive. */
export function getInteractionStrength(cardIndex: number, focus: number): number {
  const offset = Math.abs(cardIndex - focus);
  if (offset >= COVERFLOW_INTERACTION_ZONE) return 0;
  return 1 - offset / COVERFLOW_INTERACTION_ZONE;
}

export function isInInteractionZone(cardIndex: number, focus: number): boolean {
  return getInteractionStrength(cardIndex, focus) > 0;
}

export interface CoverflowTransform {
  x: number;
  z: number;
  rotateY: number;
  scale: number;
  opacity: number;
  blur: number;
  zIndex: number;
}

export interface CoverflowSpacing {
  side1: number;
  side2: number;
}

export interface CoverflowMetrics {
  spacing: CoverflowSpacing;
  cardWidth: number;
  perspective: number;
  tier: DeviceTier;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Responsive metrics derived from viewport — no fixed pixel layouts */
export function getCoverflowMetrics(stageWidth?: number): CoverflowMetrics {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const width = stageWidth && stageWidth > 0 ? stageWidth : vw;
  const tier = getDeviceTier(vw);

  if (tier === "mobile") {
    const cardWidth = clamp(width * 0.84, 260, 380);
    const peek = 0.17;
    const side1 = cardWidth * (1 - peek);
    const side2 = side1 * 1.06;
    return {
      spacing: { side1, side2 },
      cardWidth,
      perspective: clamp(vw * 0.88, 800, 1200),
      tier,
    };
  }

  if (tier === "tablet") {
    const cardWidth = clamp(width * 0.7, 280, 420);
    const peek = 0.15;
    const side1 = cardWidth * (1 - peek);
    const side2 = side1 * 1.08;
    return {
      spacing: { side1, side2 },
      cardWidth,
      perspective: clamp(vw * 0.9, 950, 1600),
      tier,
    };
  }

  let cardWidth: number;
  let side1Ratio: number;
  let side2Ratio: number;

  if (vw < 1440) {
    cardWidth = clamp(width * 0.32, 300, 420);
    side1Ratio = 0.34;
    side2Ratio = 0.46;
  } else if (vw < 1920) {
    cardWidth = clamp(width * 0.28, 320, 460);
    side1Ratio = 0.32;
    side2Ratio = 0.44;
  } else {
    cardWidth = clamp(width * 0.24, 340, 480);
    side1Ratio = 0.3;
    side2Ratio = 0.42;
  }

  const side1 = cardWidth * 0.56 + width * side1Ratio * 0.42;
  const side2 = cardWidth * 0.88 + width * side2Ratio * 0.48;
  const perspective = clamp(vw * 0.92, 1100, 2200);

  return {
    spacing: { side1, side2 },
    cardWidth,
    perspective,
    tier: "desktop",
  };
}

/** @deprecated use getCoverflowMetrics */
export function getCoverflowSpacing(stageWidth?: number): CoverflowSpacing {
  return getCoverflowMetrics(stageWidth).spacing;
}

function getTouchCoverflowTransform(
  cardIndex: number,
  focus: number,
  spacing: CoverflowSpacing,
  tier: DeviceTier
): CoverflowTransform {
  const offset = cardIndex - focus;
  const abs = Math.abs(offset);
  const sign = offset === 0 ? 0 : Math.sign(offset);

  if (abs < 0.001) {
    return {
      x: 0,
      z: 0,
      rotateY: 0,
      scale: 1,
      opacity: 1,
      blur: 0,
      zIndex: 50,
    };
  }

  const maxRotate = tier === "mobile" ? 20 : 28;
  const inactiveScale = tier === "mobile" ? 0.92 : 0.88;

  if (abs <= 1) {
    const t = abs;
    return {
      x: sign * lerp(0, spacing.side1, t),
      z: lerp(0, -50, t),
      rotateY: sign * lerp(0, maxRotate, t),
      scale: lerp(1, inactiveScale, t),
      opacity: lerp(1, 0.72, t),
      blur: 0,
      zIndex: Math.round(50 - abs * 10),
    };
  }

  const t = Math.min(abs - 1, 1);
  return {
    x: sign * lerp(spacing.side1, spacing.side2, t),
    z: lerp(-50, -90, t),
    rotateY: sign * lerp(maxRotate, maxRotate + 8, t),
    scale: lerp(inactiveScale, inactiveScale - 0.08, t),
    opacity: lerp(0.72, 0.45, t),
    blur: 0,
    zIndex: Math.round(40 - abs * 8),
  };
}

export function getCoverflowTransform(
  cardIndex: number,
  focus: number,
  spacing: CoverflowSpacing,
  tier: DeviceTier = "desktop"
): CoverflowTransform {
  if (tier !== "desktop") {
    return getTouchCoverflowTransform(cardIndex, focus, spacing, tier);
  }

  const offset = cardIndex - focus;
  const abs = Math.abs(offset);
  const sign = offset === 0 ? 0 : Math.sign(offset);

  if (abs < 0.001) {
    return {
      x: 0,
      z: 0,
      rotateY: 0,
      scale: 1,
      opacity: 1,
      blur: 0,
      zIndex: 50,
    };
  }

  let rotateY: number;
  let scale: number;
  let z: number;
  let opacity: number;
  let blur: number;
  let x: number;

  if (abs <= 1) {
    const t = abs;
    rotateY = sign * lerp(0, 40, t);
    scale = lerp(1, 0.82, t);
    z = lerp(0, -150, t);
    opacity = lerp(1, 0.8, t);
    blur = lerp(0, 4, t);
    x = sign * lerp(0, spacing.side1, t);
  } else if (abs <= 2) {
    const t = abs - 1;
    rotateY = sign * lerp(40, 60, t);
    scale = lerp(0.82, 0.65, t);
    z = lerp(-150, -250, t);
    opacity = lerp(0.8, 0.58, t);
    blur = lerp(4, 8, t);
    x = sign * lerp(spacing.side1, spacing.side2, t);
  } else {
    const t = Math.min(abs - 2, 1);
    rotateY = sign * lerp(60, 68, t);
    scale = lerp(0.65, 0.52, t);
    z = lerp(-250, -320, t);
    opacity = lerp(0.58, 0.28, t);
    blur = lerp(8, 11, t);
    x = sign * lerp(spacing.side2, spacing.side2 * 1.1, t);
  }

  return {
    x,
    z,
    rotateY,
    scale,
    opacity: Math.max(0.22, opacity),
    blur: blur * (1 - getInteractionStrength(cardIndex, focus)),
    zIndex: Math.round(50 - abs * 10),
  };
}

export function applyCoverflowTransform(
  element: HTMLElement,
  transform: CoverflowTransform,
  options: { skipBlur?: boolean } = {}
) {
  gsap.set(element, {
    xPercent: -50,
    yPercent: -50,
    x: transform.x,
    z: transform.z,
    rotateY: transform.rotateY,
    scale: transform.scale,
    opacity: transform.opacity,
    filter: options.skipBlur ? "none" : `blur(${transform.blur}px)`,
    zIndex: transform.zIndex,
    transformOrigin: "center center",
    force3D: true,
  });
}

export function applyCoverflowMetrics(stage: HTMLElement, metrics: CoverflowMetrics) {
  stage.style.setProperty("--coverflow-card-width", `${metrics.cardWidth}px`);
  stage.style.perspective = `${metrics.perspective}px`;
}

export function layoutCoverflow(
  cards: HTMLElement[],
  focus: number,
  stageWidth?: number,
  stage?: HTMLElement | null,
  hoveredIndex: number | null = null
) {
  const metrics = getCoverflowMetrics(stageWidth);
  if (stage) applyCoverflowMetrics(stage, metrics);

  const skipBlur = metrics.tier !== "desktop";

  cards.forEach((card, index) => {
    const transform = getCoverflowTransform(
      index,
      focus,
      metrics.spacing,
      metrics.tier
    );
    if (hoveredIndex === index) {
      transform.zIndex = Math.max(transform.zIndex, 80);
    }
    if (metrics.tier !== "desktop" && Math.abs(index - focus) < 0.35) {
      transform.zIndex = Math.max(transform.zIndex, 70);
    }
    applyCoverflowTransform(card, transform, { skipBlur });
  });

  return metrics;
}
