import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import AdminCard from "@/components/admin/shared/AdminCard";
import { formatDate } from "@/lib/format-date";
import { getBookings } from "@/lib/services/cms";

const statusColors = {
  pending: "text-amber-300",
  confirmed: "text-emerald",
  completed: "text-gold",
  cancelled: "text-red-300",
};

export default async function AdminBookingsPage() {
  const bookings = await getBookings();

  return (
    <div>
      <AdminPageHeader
        title="Bookings"
        description="Manage client bookings, packages, calendar dates, and payment status."
      />

      <AdminCard>
        {bookings.length === 0 ? (
          <p className="text-sm text-soft-white/45">
            No bookings yet. Contact form submissions appear in the Contact inbox.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
                  <th className="pb-3 pr-4">Customer</th>
                  <th className="pb-3 pr-4">Package</th>
                  <th className="pb-3 pr-4">Event Date</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Payment</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-white/[0.04]">
                    <td className="py-4 pr-4">
                      <p className="text-soft-white">{booking.customerName}</p>
                      <p className="text-xs text-soft-white/35">{booking.customerEmail}</p>
                    </td>
                    <td className="py-4 pr-4 text-soft-white/70">{booking.package}</td>
                    <td className="py-4 pr-4 text-soft-white/70">
                      {formatDate(booking.eventDate)}
                    </td>
                    <td className={`py-4 pr-4 capitalize ${statusColors[booking.status]}`}>
                      {booking.status}
                    </td>
                    <td className="py-4 capitalize text-soft-white/55">
                      {booking.paymentStatus}
                    </td>
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
