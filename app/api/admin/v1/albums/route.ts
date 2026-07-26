import { jsonOk, requireApiAuth } from "@/lib/api/http";
import { getAlbumStatsMap, listAlbums } from "@/lib/db";

export async function GET(request: Request) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const categorySlug = searchParams.get("category") ?? undefined;

  const [albums, statsMap] = await Promise.all([
    listAlbums({ categorySlug, includeHidden: true }),
    getAlbumStatsMap(),
  ]);

  return jsonOk({
    albums: albums.map((album) => ({
      ...album,
      stats: statsMap[album.id] ?? { photoCount: 0, videoCount: 0 },
    })),
  });
}
