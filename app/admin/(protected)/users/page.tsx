import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import AdminCard from "@/components/admin/shared/AdminCard";
import { getAdminUsers } from "@/lib/services/cms";

export default async function AdminUsersPage() {
  const users = await getAdminUsers();

  return (
    <div>
      <AdminPageHeader
        title="Users"
        description="Admin accounts with access to this CMS. Credentials are managed via environment variables and admin-users.json."
      />

      <AdminCard>
        {users.length === 0 ? (
          <p className="text-sm text-soft-white/45">
            No admin users configured. Add entries to data/admin-users.json.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-white/[0.04]">
                    <td className="py-4 pr-4 text-soft-white">{user.name}</td>
                    <td className="py-4 pr-4 text-soft-white/70">{user.email}</td>
                    <td className="py-4 capitalize text-gold">{user.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
