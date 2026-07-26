import { jsonOk, parsePagination, requireApiAuth } from "@/lib/api/http";
import { listActivity } from "@/lib/db";

export async function GET(request: Request) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const { limit } = parsePagination(searchParams);
  const activity = await listActivity(limit);

  return jsonOk({ items: activity });
}
