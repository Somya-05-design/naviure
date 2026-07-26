/**
 * Locked public portfolio category slugs.
 * Admin may still manage corporate / food / fashion / others.
 */
export const PUBLIC_CATEGORY_SLUGS = [
  "wedding",
  "pre-wedding",
  "portraits",
  "maternity",
  "club-photography",
] as const;

export type PublicCategorySlug = (typeof PUBLIC_CATEGORY_SLUGS)[number];

export const PUBLIC_CATEGORY_SLUG_SET = new Set<string>(PUBLIC_CATEGORY_SLUGS);

export function isPublicCategorySlug(slug: string): boolean {
  return PUBLIC_CATEGORY_SLUG_SET.has(slug);
}
