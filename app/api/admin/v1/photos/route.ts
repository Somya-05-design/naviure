import { jsonError, jsonOk, parsePagination, requireApiAuth } from "@/lib/api/http";
import { listPhotos, toGalleryImages } from "@/lib/db";

export async function GET(request: Request) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams);

  const photos = await listPhotos({
    categorySlug: searchParams.get("category") ?? undefined,
    albumSlug: searchParams.get("album") ?? undefined,
    search: searchParams.get("q") ?? undefined,
    sort: (searchParams.get("sort") as "newest" | "oldest" | "alpha") ?? "newest",
  });

  const slice = photos.slice(offset, offset + limit);
  return jsonOk({
    items: toGalleryImages(slice),
    pagination: {
      page,
      limit,
      total: photos.length,
      totalPages: Math.ceil(photos.length / limit),
    },
  });
}

export async function POST() {
  return jsonError("Use server upload action for photo creation", 405);
}
