/**
 * Future-facing video engagement metrics.
 *
 * This is intentionally a frontend contract only. No persistence, API, or CMS
 * behavior is attached until real analytics data exists.
 */
export interface VideoAnalyticsMetrics {
  likes?: number | null;
  views?: number | null;
  shares?: number | null;
  favorites?: number | null;
  downloads?: number | null;
  watchTime?: number | null;
  completionRate?: number | null;
  lastViewed?: string | null;
}

export const EMPTY_VIDEO_ANALYTICS: Readonly<VideoAnalyticsMetrics> =
  Object.freeze({
    likes: null,
    views: null,
    shares: null,
    favorites: null,
    downloads: null,
    watchTime: null,
    completionRate: null,
    lastViewed: null,
  });
