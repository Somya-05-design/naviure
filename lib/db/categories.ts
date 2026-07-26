import type { CategoryCMS } from "@/types/cms";
import type { CategoryRecord, EntityStatus } from "@/lib/db/schema";
import { readTable, writeTable } from "@/lib/db/client";

const FILE = "categories-cms.json";

function toStatus(hidden: boolean): EntityStatus {
  return hidden ? "hidden" : "active";
}

export function categoryRecordFromCMS(cat: CategoryCMS): CategoryRecord {
  const now = new Date().toISOString();
  return {
    id: cat.id,
    slug: cat.slug,
    name: cat.name,
    description: cat.description,
    coverImage: cat.coverImage,
    order: cat.order,
    featured: cat.featured,
    hidden: cat.hidden,
    status: toStatus(cat.hidden),
    color: cat.color,
    seoTitle: cat.seoTitle,
    seoDescription: cat.seoDescription,
    createdAt: (cat as CategoryCMS & { createdAt?: string }).createdAt ?? now,
    updatedAt: (cat as CategoryCMS & { updatedAt?: string }).updatedAt ?? now,
  };
}

export function categoryCMSToRecord(cat: CategoryRecord): CategoryCMS {
  return {
    id: cat.id,
    slug: cat.slug,
    name: cat.name,
    description: cat.description,
    coverImage: cat.coverImage,
    order: cat.order,
    featured: cat.featured,
    hidden: cat.hidden,
    color: cat.color,
    seoTitle: cat.seoTitle,
    seoDescription: cat.seoDescription,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
  } as CategoryCMS & { createdAt: string; updatedAt: string };
}

export async function listCategories(): Promise<CategoryRecord[]> {
  const raw = await readTable<CategoryCMS[]>(FILE, []);
  return raw
    .map((cat) => categoryRecordFromCMS(cat))
    .sort((a, b) => a.order - b.order);
}

export async function saveCategories(records: CategoryRecord[]): Promise<CategoryRecord[]> {
  const sorted = [...records]
    .sort((a, b) => a.order - b.order)
    .map((cat) => ({
      ...categoryCMSToRecord(cat),
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));

  await writeTable(FILE, sorted);

  await writeTable(
    "categories.json",
    sorted.map(
      // Intentionally strip admin-only fields from the public categories file.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ hidden, color, seoTitle, seoDescription, createdAt, updatedAt, ...cat }) => ({
        ...cat,
        description: seoDescription || cat.description,
      })
    )
  );

  return sorted.map((cat) => categoryRecordFromCMS(cat as CategoryCMS));
}

export async function getCategoryBySlug(slug: string) {
  const categories = await listCategories();
  return categories.find((cat) => cat.slug === slug) ?? null;
}

export async function getCategoryById(id: string) {
  const categories = await listCategories();
  return categories.find((cat) => cat.id === id) ?? null;
}
