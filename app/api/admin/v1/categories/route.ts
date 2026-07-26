import { jsonOk, requireApiAuth } from "@/lib/api/http";
import { getCategoryStatsMap, listCategories } from "@/lib/db";

export async function GET() {
  const { error } = await requireApiAuth();
  if (error) return error;

  const [categories, statsMap] = await Promise.all([
    listCategories(),
    getCategoryStatsMap(),
  ]);

  return jsonOk({
    categories: categories.map((cat) => ({
      ...cat,
      stats: statsMap[cat.id] ?? { albumCount: 0, photoCount: 0, videoCount: 0 },
    })),
  });
}
