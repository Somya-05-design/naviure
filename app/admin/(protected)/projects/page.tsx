import { getCMSCategories } from "@/lib/services/cms";
import { listProjects, getProjectStatsMap } from "@/lib/db";
import ProjectsManager from "@/components/admin/projects/ProjectsManager";

export default async function AdminProjectsPage() {
  const [projects, categories, statsMap] = await Promise.all([
    listProjects({ includeHidden: true }),
    getCMSCategories(),
    getProjectStatsMap(),
  ]);

  return (
    <ProjectsManager
      projects={projects}
      categories={categories.filter((c) => !c.hidden)}
      statsMap={statsMap}
    />
  );
}
