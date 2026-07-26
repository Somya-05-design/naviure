import { getScrollY } from "@/lib/scroll-controller";

const PHOTO_CATEGORY_STACK_KEY = "naviure:portfolio:photo-category-stack";
const PHOTO_ALBUM_KEY_PREFIX = "naviure:portfolio:photo-album:";
const VIDEO_CATEGORY_KEY = "naviure:portfolio-video-category";

export interface PhotoCategoryStackState {
  version: 1;
  categorySlug: string;
  activeIndex: number;
  focus: number;
  scrollY: number;
  updatedAt: number;
}

export interface PhotoAlbumState {
  version: 1;
  categorySlug: string;
  scrollY: number;
  lightboxIndex: number | null;
  selectedImageId: string | null;
  visibleCount: number;
  updatedAt: number;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

export function savePhotoCategoryStackState(
  partial: Partial<Omit<PhotoCategoryStackState, "version" | "updatedAt">> &
    Pick<PhotoCategoryStackState, "categorySlug">
) {
  const current = getPhotoCategoryStackState();
  const hasScrollY = Object.prototype.hasOwnProperty.call(partial, "scrollY");
  const next: PhotoCategoryStackState = {
    version: 1,
    categorySlug: partial.categorySlug,
    activeIndex: partial.activeIndex ?? current?.activeIndex ?? 0,
    focus: partial.focus ?? current?.focus ?? 0,
    scrollY: hasScrollY
      ? (partial.scrollY ?? 0)
      : (current?.scrollY ?? getScrollY()),
    updatedAt: Date.now(),
  };
  writeJson(PHOTO_CATEGORY_STACK_KEY, next);
}

export function getPhotoCategoryStackState(): PhotoCategoryStackState | null {
  const state = readJson<PhotoCategoryStackState>(PHOTO_CATEGORY_STACK_KEY);
  if (!state || state.version !== 1) return null;
  return state;
}

export function clearPhotoCategoryStackState() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PHOTO_CATEGORY_STACK_KEY);
  } catch {
    // ignore
  }
}

export function savePhotoAlbumState(
  categorySlug: string,
  partial: Partial<Omit<PhotoAlbumState, "version" | "categorySlug" | "updatedAt">>
) {
  const key = `${PHOTO_ALBUM_KEY_PREFIX}${categorySlug}`;
  const current = getPhotoAlbumState(categorySlug);
  const next: PhotoAlbumState = {
    version: 1,
    categorySlug,
    scrollY: partial.scrollY ?? current?.scrollY ?? getScrollY(),
    lightboxIndex:
      partial.lightboxIndex !== undefined
        ? partial.lightboxIndex
        : (current?.lightboxIndex ?? null),
    selectedImageId:
      partial.selectedImageId !== undefined
        ? partial.selectedImageId
        : (current?.selectedImageId ?? null),
    visibleCount: partial.visibleCount ?? current?.visibleCount ?? 0,
    updatedAt: Date.now(),
  };
  writeJson(key, next);
}

export function getPhotoAlbumState(categorySlug: string): PhotoAlbumState | null {
  const state = readJson<PhotoAlbumState>(`${PHOTO_ALBUM_KEY_PREFIX}${categorySlug}`);
  if (!state || state.version !== 1 || state.categorySlug !== categorySlug) return null;
  return state;
}

export function clearPhotoAlbumState(categorySlug: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(`${PHOTO_ALBUM_KEY_PREFIX}${categorySlug}`);
  } catch {
    // ignore
  }
}

/** @deprecated Use savePhotoCategoryStackState */
export function savePortfolioPhotoCategory(slug: string): void {
  savePhotoCategoryStackState({ categorySlug: slug });
}

/** @deprecated Use getPhotoCategoryStackState */
export function getPortfolioPhotoCategory(): string | null {
  return getPhotoCategoryStackState()?.categorySlug ?? null;
}

export function savePortfolioVideoCategory(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(VIDEO_CATEGORY_KEY, slug);
  } catch {
    // ignore
  }
}

export function getPortfolioVideoCategory(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(VIDEO_CATEGORY_KEY);
  } catch {
    return null;
  }
}

export const PORTFOLIO_RESTORE_DURATION = 0.45;

const RETURNING_TO_CATEGORIES_KEY = "naviure:returning-to-categories";

function isBrowserReload() {
  if (typeof window === "undefined") return false;
  const entry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return entry?.type === "reload";
}

export function shouldRestorePortfolioState() {
  return !isBrowserReload();
}

/** @deprecated Use readCategoryRestoreState */
export function readPhotoCategoryStackStateForRestore(): PhotoCategoryStackState | null {
  return readCategoryRestoreState();
}

export function markReturningToCategories(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(RETURNING_TO_CATEGORIES_KEY, "1");
  } catch {
    // ignore
  }
}

export function shouldForceCategoryRestore(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(RETURNING_TO_CATEGORIES_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearReturningToCategories(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(RETURNING_TO_CATEGORIES_KEY);
  } catch {
    // ignore
  }
}

export function resolveCategoryFocusTarget(
  saved: PhotoCategoryStackState,
  categorySlugs: string[]
): number {
  const index = categorySlugs.indexOf(saved.categorySlug);
  if (index >= 0) return index;
  if (saved.activeIndex >= 0 && saved.activeIndex < categorySlugs.length) {
    return saved.activeIndex;
  }
  return saved.focus ?? 0;
}

export function readCategoryRestoreState(): PhotoCategoryStackState | null {
  if (typeof window === "undefined") return null;
  if (!shouldRestorePortfolioState() && !shouldForceCategoryRestore()) return null;
  return getPhotoCategoryStackState();
}
