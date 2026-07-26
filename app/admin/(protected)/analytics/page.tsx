import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import AdminCard from "@/components/admin/shared/AdminCard";
import { getCMSStats, getMonthlyUploadStats } from "@/lib/services/cms";

export default async function AdminAnalyticsPage() {
  const [stats, monthly] = await Promise.all([
    getCMSStats(),
    getMonthlyUploadStats(),
  ]);

  const maxTotal = Math.max(...monthly.map((m) => m.total), 1);

  return (
    <div>
      <AdminPageHeader
        title="Analytics"
        description="Live visitor and upload metrics from site analytics and CMS metadata."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
            Visitors
          </p>
          <p className="mt-2 font-display text-4xl text-soft-white">
            {stats.visitors.toLocaleString()}
          </p>
        </AdminCard>
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
            Total Photos
          </p>
          <p className="mt-2 font-display text-4xl text-soft-white">{stats.photos}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
            Total Videos
          </p>
          <p className="mt-2 font-display text-4xl text-soft-white">{stats.videos}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
            Storage
          </p>
          <p className="mt-2 font-display text-4xl text-soft-white">
            {stats.storageUsedMb} MB
          </p>
        </AdminCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
            Uploads Today
          </p>
          <p className="mt-2 font-display text-3xl text-soft-white">{stats.uploadsToday}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
            Uploads This Month
          </p>
          <p className="mt-2 font-display text-3xl text-soft-white">
            {stats.uploadsThisMonth}
          </p>
        </AdminCard>
      </div>

      <AdminCard className="mt-6">
        <h2 className="mb-6 text-lg font-light text-soft-white">Upload Trends</h2>
        <div className="flex h-56 items-end gap-4">
          {monthly.map((item) => (
            <div key={item.month} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full min-h-[4px] rounded-t-md bg-gradient-to-t from-emerald/25 to-gold/40"
                style={{ height: `${Math.max(4, (item.total / maxTotal) * 100)}%` }}
                title={`${item.photos} photos · ${item.videos} videos`}
              />
              <span className="text-[10px] uppercase tracking-[0.2em] text-soft-white/35">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}
