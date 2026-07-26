import { revalidatePath } from "next/cache";

/** Invalidate all admin routes after CMS mutations. */
export function revalidateAdminSurfaces() {
  revalidatePath("/admin", "layout");
}

/** Invalidate public portfolio and optional category album pages. */
export function revalidatePublicPortfolio(categorySlug?: string) {
  revalidatePath("/portfolio");
  revalidatePath("/portfolio/photos");
  revalidatePath("/portfolio/videos");

  if (categorySlug) {
    revalidatePath(`/portfolio/photos/${categorySlug}`);
    revalidatePath(`/portfolio/videos/${categorySlug}`);
  } else {
    revalidatePath("/portfolio/photos", "layout");
    revalidatePath("/portfolio/videos", "layout");
  }
}

/** Invalidate site-wide content pages (home, about, contact, SEO). */
export function revalidatePublicContent() {
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/contact");
  revalidatePath("/sitemap.xml");
}

export function revalidateAfterMediaChange(categorySlug?: string) {
  revalidateAdminSurfaces();
  revalidatePublicPortfolio(categorySlug);
}

export function revalidateAfterHierarchyChange(categorySlug?: string) {
  revalidateAdminSurfaces();
  revalidatePublicPortfolio(categorySlug);
}

export function revalidateAfterContentChange() {
  revalidateAdminSurfaces();
  revalidatePublicContent();
}

export function revalidateAfterLayoutChange(categorySlug?: string) {
  revalidateAdminSurfaces();
  revalidatePublicPortfolio(categorySlug);
}
