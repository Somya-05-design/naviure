import { getCMSCategories } from "@/lib/services/cms";
import { getCategoryStatsMap } from "@/lib/db";
import LibraryBrowser from "@/components/admin/library/LibraryBrowser";

export default async function AdminLibraryPage() {
  const [categories, categoryStats] = await Promise.all([
    getCMSCategories(),
    getCategoryStatsMap(),
  ]);

  return (
    <LibraryBrowser
      mode="categories"
      categories={categories.filter((c) => !c.hidden)}
      categoryStats={categoryStats}
    />
  );
}
