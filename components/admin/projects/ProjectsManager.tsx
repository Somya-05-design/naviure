"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Briefcase } from "lucide-react";
import AdminCard from "@/components/admin/shared/AdminCard";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import { persistProject, persistProjectUpdate, removeProject } from "@/app/actions/admin";
import type { CategoryCMS } from "@/types/cms";
import type { ProjectRecord, ProjectStats, ProjectStatus } from "@/lib/db/schema";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  upcoming: "Upcoming",
  in_progress: "In Progress",
  editing: "Editing",
  completed: "Completed",
  delivered: "Delivered",
  archived: "Archived",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectsManager({
  projects,
  categories,
  statsMap,
}: {
  projects: ProjectRecord[];
  categories: CategoryCMS[];
  statsMap: Record<string, ProjectStats>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [name, setName] = useState("");
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? "wedding");
  const [clientName, setClientName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    let list = projects;
    if (categoryFilter !== "all") {
      list = list.filter((p) => p.categorySlug === categoryFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q) ||
          p.categorySlug.includes(q) ||
          p.location.toLowerCase().includes(q)
      );
    }
    return list;
  }, [projects, search, statusFilter, categoryFilter]);

  const create = () => {
    if (!name.trim() || !categorySlug) return;
    setError("");
    startTransition(async () => {
      try {
        await persistProject({
          categorySlug,
          name: name.trim(),
          clientName: clientName.trim() || name.trim(),
          status: "upcoming",
        });
        setName("");
        setClientName("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Create failed");
      }
    });
  };

  return (
    <div>
      <AdminPageHeader
        title="Projects"
        description="Every booking is a project (job). Client details live on the project — open one to manage albums and media."
      />

      <AdminCard className="mb-6 space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative md:col-span-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-soft-white/30"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search project, client, location…"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-soft-white outline-none focus:border-gold/35"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-soft-white outline-none focus:border-gold/35"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | ProjectStatus)
            }
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-soft-white outline-none focus:border-gold/35"
          >
            <option value="all">All statuses</option>
            {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-soft-white outline-none focus:border-gold/35"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="min-w-[180px] flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-soft-white outline-none focus:border-gold/35"
          />
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Client name"
            className="min-w-[160px] flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-soft-white outline-none focus:border-gold/35"
          />
          <button
            type="button"
            onClick={create}
            disabled={isPending || !name.trim()}
            className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-gold disabled:opacity-40"
          >
            <Plus size={14} />
            Add Project
          </button>
        </div>
        {error && <p className="text-xs text-red-300/90">{error}</p>}
      </AdminCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {filtered.map((project) => {
          const stats = statsMap[project.id];
          const category = categories.find((c) => c.slug === project.categorySlug);
          return (
            <div
              key={project.id}
              className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]"
            >
              <Link
                href={`/admin/library/${project.categorySlug}/${project.slug}`}
                className="block"
              >
                <div className="relative aspect-[21/9] bg-white/[0.03]">
                  {project.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.coverImage}
                      alt={project.name}
                      className="h-full w-full object-cover opacity-80"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Briefcase size={28} className="text-gold/40" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xl text-soft-white">
                        {project.name}
                      </p>
                      <p className="mt-1 text-xs text-soft-white/40">
                        {category?.name ?? project.categorySlug} ·{" "}
                        {project.clientName || "No client name"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-gold/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-gold/80">
                      {STATUS_LABELS[project.status]}
                    </span>
                  </div>
                  <p className="mt-4 text-xs text-soft-white/40">
                    Shoot {project.shootDate?.slice(0, 10) || "—"} ·{" "}
                    {stats?.albumCount ?? 0} albums · {stats?.photoCount ?? 0} photos ·{" "}
                    {stats?.videoCount ?? 0} videos ·{" "}
                    {formatBytes(stats?.storageUsedBytes ?? 0)}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-soft-white/28">
                    Created {project.createdAt.slice(0, 10)}
                  </p>
                </div>
              </Link>
              <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] px-5 py-3">
                <Link
                  href={`/admin/library/${project.categorySlug}/${project.slug}`}
                  className="text-[10px] uppercase tracking-[0.18em] text-gold/80 hover:text-gold"
                >
                  Open
                </Link>
                <select
                  value={project.status}
                  disabled={isPending}
                  onChange={(e) => {
                    const status = e.target.value as ProjectStatus;
                    startTransition(async () => {
                      try {
                        await persistProjectUpdate(project.id, { status });
                        router.refresh();
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : "Status update failed"
                        );
                      }
                    });
                  }}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-soft-white/70 outline-none focus:border-gold/35"
                  aria-label={`Status for ${project.name}`}
                >
                  {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-[10px] uppercase tracking-[0.18em] text-red-300/70 hover:text-red-300"
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Delete project "${project.name}" and all albums/media?`
                      )
                    )
                      return;
                    startTransition(async () => {
                      try {
                        await removeProject(project.id);
                        router.refresh();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Delete failed");
                      }
                    });
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-soft-white/40">No projects match your filters.</p>
        )}
      </div>
    </div>
  );
}
