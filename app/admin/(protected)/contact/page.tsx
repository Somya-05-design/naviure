import { getSettings } from "@/lib/services/content";
import { getContactMessages } from "@/lib/services/cms";
import ContactInboxClient from "@/components/admin/contact/ContactInboxClient";

export default async function AdminContactPage() {
  const [settings, messages] = await Promise.all([
    getSettings(),
    getContactMessages(),
  ]);
  return <ContactInboxClient messages={messages} settings={settings} />;
}
