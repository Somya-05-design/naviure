import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import AdminCard from "@/components/admin/shared/AdminCard";
import { getTestimonials } from "@/lib/services/cms";

export default async function AdminTestimonialsPage() {
  const testimonials = await getTestimonials();

  return (
    <div>
      <AdminPageHeader
        title="Testimonials"
        description="Manage client quotes, featured reviews, and publish status."
      />

      <div className="grid gap-4">
        {testimonials.length === 0 ? (
          <AdminCard>
            <p className="text-sm text-soft-white/45">
              No testimonials yet. Add client quotes to showcase on the homepage and about page.
            </p>
          </AdminCard>
        ) : (
          testimonials.map((item) => (
            <AdminCard key={item.id}>
              <p className="font-display text-lg text-soft-white">&ldquo;{item.quote}&rdquo;</p>
              <p className="mt-3 text-sm text-gold/80">{item.clientName}</p>
              <p className="text-xs text-soft-white/35">{item.eventType}</p>
            </AdminCard>
          ))
        )}
      </div>
    </div>
  );
}
