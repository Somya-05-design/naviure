import { notFound } from "next/navigation";
import { getCMSCategories } from "@/lib/services/cms";
import { listProjects, getProjectStatsMap } from "@/lib/db";
import LibraryBrowser from "@/components/admin/library/LibraryBrowser";

export default async function AdminLibraryCategoryPage({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const { categorySlug } = await params;
  const categories = await getCMSCategories();
  const category = categories.find((c) => c.slug === categorySlug);
  if (!category) notFound();

  const [projects, projectStats] = await Promise.all([
    listProjects({ categorySlug, includeHidden: true }),
    getProjectStatsMap(),
  ]);

  return (
    <LibraryBrowser
      mode="projects"
      category={category}
      projects={projects}
      projectStats={projectStats}
    />
  );
}
