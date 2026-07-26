import { incrementVisitors } from "@/lib/db/stats";

export async function POST() {
  const total = await incrementVisitors();
  return Response.json({ totalVisitors: total });
}
