import { jsonOk, parsePagination, requireApiAuth } from "@/lib/api/http";
import { listVideos, toGalleryVideos } from "@/lib/db";

export async function GET(request: Request) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams);

  const videos = await listVideos({
    categorySlug: searchParams.get("category") ?? undefined,
    albumSlug: searchParams.get("album") ?? undefined,
    search: searchParams.get("q") ?? undefined,
    sort: (searchParams.get("sort") as "newest" | "oldest" | "alpha") ?? "newest",
  });

  const slice = videos.slice(offset, offset + limit);
  return jsonOk({
    items: toGalleryVideos(slice),
    pagination: {
      page,
      limit,
      total: videos.length,
      totalPages: Math.ceil(videos.length / limit),
    },
  });
}
