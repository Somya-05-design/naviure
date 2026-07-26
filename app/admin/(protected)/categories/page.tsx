import { getCMSCategories } from "@/lib/services/cms";
import { getCategoryStatsMap } from "@/lib/db";
import CategoryManager from "@/components/admin/categories/CategoryManager";

export default async function AdminCategoriesPage() {
  const [categories, statsMap] = await Promise.all([
    getCMSCategories(),
    getCategoryStatsMap(),
  ]);
  return (
    <CategoryManager initialCategories={categories} statsMap={statsMap} />
  );
}
