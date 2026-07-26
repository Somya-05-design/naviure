import { getSettings } from "@/lib/services/content";
import SettingsEditor from "@/components/admin/SettingsEditor";

export default async function AdminSettingsPage() {
  const settings = await getSettings();
  return <SettingsEditor settings={settings} />;
}
