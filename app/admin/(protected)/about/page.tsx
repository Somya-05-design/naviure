import { getAboutContent } from "@/lib/services/content";
import AboutEditor from "@/components/admin/AboutEditor";

export default async function AdminAboutPage() {
  const content = await getAboutContent();
  return <AboutEditor content={content} />;
}
