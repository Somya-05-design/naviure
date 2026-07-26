import { getSettings } from "@/lib/services/content";
import SEOEditor from "@/components/admin/SEOEditor";

export default async function AdminSEOPage() {
  const settings = await getSettings();
  return <SEOEditor settings={settings} />;
}
