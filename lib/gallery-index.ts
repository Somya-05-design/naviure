import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const INDEX_FILE = path.join(DATA_DIR, "gallery-index.json");

export type GalleryDimensionIndex = Record<
  string,
  { width: number; height: number }
>;

let memoryIndex: GalleryDimensionIndex | null = null;

export async function loadGalleryDimensionIndex(): Promise<GalleryDimensionIndex> {
  if (memoryIndex) return memoryIndex;

  try {
    const raw = await fs.readFile(INDEX_FILE, "utf-8");
    memoryIndex = JSON.parse(raw) as GalleryDimensionIndex;
    return memoryIndex;
  } catch {
    memoryIndex = {};
    return memoryIndex;
  }
}

export async function saveGalleryDimensionIndex(
  index: GalleryDimensionIndex
): Promise<void> {
  memoryIndex = index;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
}

export function galleryIndexKey(
  categorySlug: string,
  relativeFilePath: string
): string {
  return `${categorySlug}/${relativeFilePath.replace(/\\/g, "/")}`;
}

export async function resolveImageDimensions(
  categorySlug: string,
  relativeFilePath: string,
  absolutePath: string,
  index: GalleryDimensionIndex
): Promise<{ width: number; height: number; index: GalleryDimensionIndex }> {
  const key = galleryIndexKey(categorySlug, relativeFilePath);
  const cached = index[key];

  if (cached) {
    return { ...cached, index };
  }

  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(absolutePath).metadata();
    const width = meta.width ?? 1200;
    const height = meta.height ?? 1600;
    index[key] = { width, height };
    return { width, height, index };
  } catch {
    const fallback = { width: 1200, height: 1600 };
    index[key] = fallback;
    return { ...fallback, index };
  }
}
