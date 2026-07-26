import path from "path";

/** Default local gallery folder (sibling of naviure.in repo). Override with NAVIURE_GALLERY_PATH. */
export const DEFAULT_NAVIURE_GALLERY_PATH = path.resolve(
  process.cwd(),
  "../Naviure Gallery"
);

export function resolveNaviureGalleryPath() {
  return process.env.NAVIURE_GALLERY_PATH || DEFAULT_NAVIURE_GALLERY_PATH;
}

/** Source folder names inside Naviure Gallery → photo category slugs */
export const PHOTO_GALLERY_FOLDER_MAP: Record<string, string> = {
  Weddings: "wedding",
  "Pre Weddings": "pre-wedding",
  Portraits: "portraits",
  "Maternity Shoots": "maternity",
  Clubs: "club-photography",
};

/** Source folder names inside Naviure Gallery → video category slugs */
export const VIDEO_GALLERY_FOLDER_MAP: Record<string, string> = {
  Weddings: "wedding",
  "Pre Wedding": "pre-wedding",
  Clubs: "club-events",
  Fashion: "portraits",
  Other: "maternity",
};

export const PHOTO_GALLERY_SLUGS = Object.values(PHOTO_GALLERY_FOLDER_MAP);
export const VIDEO_GALLERY_SLUGS = [
  "wedding",
  "pre-wedding",
  "portraits",
  "maternity",
  "club-events",
];

export function encodePublicPath(...segments: string[]) {
  return `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}
