import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import DashboardClient from "@/components/admin/dashboard/DashboardClient";
import {
  getCMSStats,
  getRecentUploads,
  getActivityLogs,
  getMonthlyUploadStats,
} from "@/lib/services/cms";
import { getRecentProjects } from "@/lib/db";

export default async function AdminDashboardPage() {
  const [stats, uploads, activity, monthly, recentProjects] = await Promise.all([
    getCMSStats(),
    getRecentUploads(16),
    getActivityLogs(),
    getMonthlyUploadStats(),
    getRecentProjects(8),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        description="Overview of your photography portfolio — projects, uploads, storage, and activity at a glance."
      />
      <DashboardClient
        stats={stats}
        uploads={uploads.map((item) => ({
          id: item.id,
          src: item.src,
          alt: "alt" in item ? item.alt : item.title,
          mediaType: item.mediaType,
          createdAt: item.createdAt,
        }))}
        activity={activity}
        monthly={monthly}
        recentProjects={recentProjects}
      />
    </div>
  );
}
