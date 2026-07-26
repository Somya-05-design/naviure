import { getSettings } from "@/lib/services/content";
import HomepageEditor from "@/components/admin/HomepageEditor";

export default async function AdminHomepagePage() {
  const settings = await getSettings();
  return <HomepageEditor settings={settings} />;
}
