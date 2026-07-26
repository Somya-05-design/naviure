import type Lenis from "lenis";

let lenisInstance: Lenis | null = null;
const scrollListeners = new Set<() => void>();

export function registerLenis(lenis: Lenis | null) {
  lenisInstance = lenis;
}

export function subscribeScroll(listener: () => void) {
  scrollListeners.add(listener);
  return () => {
    scrollListeners.delete(listener);
  };
}

export function notifyScrollListeners() {
  scrollListeners.forEach((listener) => listener());
}

export function getScrollY(): number {
  if (lenisInstance) return lenisInstance.scroll;
  return window.scrollY;
}

export function scrollToY(
  y: number,
  options: { immediate?: boolean; duration?: number } = {}
) {
  const { immediate = false, duration = 0.45 } = options;

  if (immediate) {
    window.scrollTo({ top: y, left: 0, behavior: "auto" });
  }

  if (lenisInstance) {
    lenisInstance.scrollTo(y, {
      immediate,
      duration: immediate ? 0 : duration,
      force: true,
    });
    return;
  }

  if (!immediate) {
    window.scrollTo({ top: y, behavior: "smooth" });
  }
}

/** Wait until a DOM/layout condition is true (rAF polling, no setTimeout). */
export function waitForCondition(
  test: () => boolean,
  onReady: () => void,
  maxFrames = 80
) {
  let frames = 0;

  const tick = () => {
    if (test()) {
      onReady();
      return;
    }
    frames += 1;
    if (frames < maxFrames) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}
