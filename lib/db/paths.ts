/**
 * R2 / local object key layout:
 *   {category}/{project}/{album}/photos|videos/{timestamp}-{uuid}-{name}.ext
 *
 * RENAME SAFETY
 * -------------
 * Storage paths use immutable slugs frozen at upload time.
 * Renaming category / project / album in admin updates JSON only —
 * existing R2 objects are not moved.
 */

import { randomUUID } from "@/lib/uuid";

export function buildMediaStorageKey(
  categorySlug: string,
  projectSlug: string,
  albumSlug: string,
  mediaType: "photo" | "video",
  filename: string
) {
  const safeCategory = slugify(categorySlug);
  const safeProject = slugify(projectSlug);
  const safeAlbum = slugify(albumSlug);
  if (!safeCategory) throw new Error("Invalid category slug for storage path.");
  if (!safeProject) throw new Error("Invalid project slug for storage path.");
  if (!safeAlbum) throw new Error("Invalid album slug for storage path.");

  const folder = mediaType === "photo" ? "photos" : "videos";
  const ext = extractExtension(filename);
  const base = slugify(filename.replace(/\.[^.]+$/, "")) || "file";
  const unique = `${Date.now()}-${randomUUID().slice(0, 8)}-${base}${ext}`;

  return `${safeCategory}/${safeProject}/${safeAlbum}/${folder}/${unique}`;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractExtension(filename: string) {
  const match = filename.match(/(\.[a-z0-9]{2,8})$/i);
  return match ? match[1].toLowerCase() : "";
}
