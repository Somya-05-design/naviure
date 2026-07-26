/** Upload validation for admin media (photos / videos). */

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

export const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".gif",
]);

export const ALLOWED_VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const UNSAFE_NAME = /[<>:"|?*\x00-\x1f]|^\.|\.\./;

export function getFileExtension(filename: string): string {
  const match = filename.match(/(\.[a-z0-9]{2,8})$/i);
  return match ? match[1].toLowerCase() : "";
}

export function validateUploadInput(input: {
  file: File | null;
  category: string;
  projectSlug: string;
  albumSlug: string;
  mediaType: "photo" | "video" | null;
}): asserts input is {
  file: File;
  category: string;
  projectSlug: string;
  albumSlug: string;
  mediaType: "photo" | "video";
} {
  if (!input.file) throw new Error("No file provided.");
  if (!input.category?.trim()) throw new Error("Category is required.");
  if (!input.projectSlug?.trim()) throw new Error("Project is required.");
  if (!input.albumSlug?.trim()) throw new Error("Album is required.");
  if (input.mediaType !== "photo" && input.mediaType !== "video") {
    throw new Error('Media type must be "photo" or "video".');
  }

  const name = input.file.name?.trim();
  if (!name) throw new Error("Invalid filename.");
  if (UNSAFE_NAME.test(name) || name.includes("/") || name.includes("\\")) {
    throw new Error("Invalid filename. Remove special characters and path segments.");
  }

  const ext = getFileExtension(name);
  if (!ext) throw new Error("File must include a valid extension.");

  const mime = input.file.type || "";
  if (input.mediaType === "photo") {
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      throw new Error(`Unsupported image extension "${ext}". Allowed: JPG, PNG, WebP, AVIF, GIF.`);
    }
    if (!ALLOWED_IMAGE_TYPES.has(mime)) {
      throw new Error(
        `Unsupported image type "${mime || "unknown"}". Allowed: JPEG, PNG, WebP, AVIF, GIF.`
      );
    }
    if (input.file.size > MAX_PHOTO_BYTES) {
      throw new Error(`Photo exceeds maximum size of ${MAX_PHOTO_BYTES / (1024 * 1024)} MB.`);
    }
  } else {
    if (!ALLOWED_VIDEO_EXTENSIONS.has(ext)) {
      throw new Error(`Unsupported video extension "${ext}". Allowed: MP4, WebM, MOV.`);
    }
    if (!ALLOWED_VIDEO_TYPES.has(mime)) {
      throw new Error(
        `Unsupported video type "${mime || "unknown"}". Allowed: MP4, WebM, MOV.`
      );
    }
    if (input.file.size > MAX_VIDEO_BYTES) {
      throw new Error(`Video exceeds maximum size of ${MAX_VIDEO_BYTES / (1024 * 1024)} MB.`);
    }
  }
}
