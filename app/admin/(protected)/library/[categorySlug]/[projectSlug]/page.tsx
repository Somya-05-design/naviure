import { notFound } from "next/navigation";
import { getCMSCategories } from "@/lib/services/cms";
import { getProjectBySlug, listAlbums, getAlbumStatsMap } from "@/lib/db";
import LibraryBrowser from "@/components/admin/library/LibraryBrowser";

export default async function AdminLibraryProjectPage({
  params,
}: {
  params: Promise<{ categorySlug: string; projectSlug: string }>;
}) {
  const { categorySlug, projectSlug } = await params;
  const categories = await getCMSCategories();
  const category = categories.find((c) => c.slug === categorySlug);
  const project = await getProjectBySlug(categorySlug, projectSlug);
  if (!category || !project) notFound();

  const [albums, albumStats] = await Promise.all([
    listAlbums({ categorySlug, projectId: project.id, includeHidden: true }),
    getAlbumStatsMap(),
  ]);

  return (
    <LibraryBrowser
      mode="albums"
      category={category}
      project={project}
      albums={albums}
      albumStats={albumStats}
    />
  );
}
