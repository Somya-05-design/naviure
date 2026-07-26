import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import AdminCard from "@/components/admin/shared/AdminCard";
import { formatDateTime } from "@/lib/format-date";
import { getActivityLogs } from "@/lib/services/cms";

export default async function AdminActivityPage() {
  const logs = await getActivityLogs();

  return (
    <div>
      <AdminPageHeader
        title="Activity Logs"
        description="Audit trail of CMS changes — layouts, categories, uploads, and settings."
      />

      <AdminCard>
        <div className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-sm text-soft-white/45">No activity recorded yet.</p>
          ) : (
            logs.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm text-soft-white">{entry.action}</p>
                  <p className="text-xs text-soft-white/35">
                    {entry.entity} · {entry.entityId}
                  </p>
                </div>
                <div className="text-xs text-soft-white/35">
                  {entry.user} · {formatDateTime(entry.createdAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </AdminCard>
    </div>
  );
}
