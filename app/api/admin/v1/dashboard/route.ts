import { jsonOk, requireApiAuth } from "@/lib/api/http";
import {
  getDashboardStats,
  getMonthlyUploadStats,
  getRecentMediaUploads,
  listActivity,
} from "@/lib/db";

export async function GET() {
  const { error } = await requireApiAuth();
  if (error) return error;

  const [stats, monthly, activity, recentUploads] = await Promise.all([
    getDashboardStats(),
    getMonthlyUploadStats(6),
    listActivity(12),
    getRecentMediaUploads(8),
  ]);

  return jsonOk({ stats, monthly, activity, recentUploads });
}
