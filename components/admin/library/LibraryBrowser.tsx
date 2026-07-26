"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Briefcase, FolderOpen, Images } from "lucide-react";
import AdminCard from "@/components/admin/shared/AdminCard";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import LibraryBreadcrumb from "@/components/admin/library/LibraryBreadcrumb";
import {
  persistProject,
  persistProjectUpdate,
  removeProject,
  persistAlbum,
  persistAlbumUpdate,
  removeAlbum,
} from "@/app/actions/admin";
import type { CategoryCMS } from "@/types/cms";
import type {
  ProjectRecord,
  ProjectStats,
  AlbumRecord,
  AlbumStats,
} from "@/lib/db/schema";

type Mode = "categories" | "projects" | "albums";

export default function LibraryBrowser({
  mode,
  categories = [],
  projects = [],
  albums = [],
  category,
  project,
  categoryStats = {},
  projectStats = {},
  albumStats = {},
}: {
  mode: Mode;
  categories?: CategoryCMS[];
  projects?: ProjectRecord[];
  albums?: AlbumRecord[];
  category?: CategoryCMS | null;
  project?: ProjectRecord | null;
  categoryStats?: Record<
    string,
    { projectCount: number; albumCount: number; photoCount: number; videoCount: number }
  >;
  projectStats?: Record<string, ProjectStats>;
  albumStats?: Record<string, AlbumStats>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const crumbs = useMemo(() => {
    const items: { label: string; href?: string }[] = [
      { label: "Library", href: "/admin/library" },
    ];
    if (category) {
      items.push({
        label: category.name,
        href: mode === "projects" ? undefined : `/admin/library/${category.slug}`,
      });
    }
    if (project && category) {
      items.push({ label: project.name });
    }
    return items;
  }, [category, project, mode]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.includes(q)
    );
  }, [categories, search]);

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.includes(q) ||
        p.clientName.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const filteredAlbums = useMemo(() => {
    if (!search.trim()) return albums;
    const q = search.toLowerCase();
    return albums.filter(
      (a) => a.name.toLowerCase().includes(q) || a.slug.includes(q)
    );
  }, [albums, search]);

  const create = () => {
    if (!name.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        if (mode === "projects" && category) {
          await persistProject({
            categorySlug: category.slug,
            name: name.trim(),
            clientName: name.trim(),
          });
        }
        if (mode === "albums" && category && project) {
          await persistAlbum({
            categorySlug: category.slug,
            projectId: project.id,
            projectSlug: project.slug,
            name: name.trim(),
          });
        }
        setName("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Create failed");
      }
    });
  };

  const title =
    mode === "categories"
      ? "Media Library"
      : mode === "projects"
        ? category?.name ?? "Projects"
        : project?.name ?? "Albums";

  const description =
    mode === "categories"
      ? "Category → Project → Album → Media. Open a category to manage projects."
      : mode === "projects"
        ? "Projects (jobs) in this category. Each project holds client details and custom albums."
        : "Albums for this project. Names are fully customizable. Open an album to manage photos & videos.";

  return (
    <div>
      <AdminPageHeader title={title} description={description} />
      <LibraryBreadcrumb items={crumbs} />

      <AdminCard className="mb-6 space-y-4">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-soft-white/30"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              mode === "categories"
                ? "Search categories…"
                : mode === "projects"
                  ? "Search projects or clients…"
                  : "Search albums…"
            }
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-soft-white outline-none focus:border-gold/35"
          />
        </div>

        {mode !== "categories" && (
          <div className="flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                mode === "projects"
                  ? "New project name (e.g. Rahul & Priya Wedding)"
                  : "New album name (e.g. Haldi)"
              }
              className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-soft-white outline-none focus:border-gold/35"
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
            <button
              type="button"
              onClick={create}
              disabled={isPending || !name.trim()}
              className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-gold disabled:opacity-40"
            >
              <Plus size={14} />
              {mode === "projects" ? "Add Project" : "Add Album"}
            </button>
          </div>
        )}
        {error && <p className="text-xs text-red-300/90">{error}</p>}
      </AdminCard>

      {mode === "categories" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredCategories.map((cat) => {
            const stats = categoryStats[cat.id];
            return (
              <Link
                key={cat.id}
                href={`/admin/library/${cat.slug}`}
                className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-gold/30 hover:bg-gold/[0.04]"
              >
                <div className="mb-3 flex items-center gap-3">
                  <FolderOpen size={18} className="text-gold/80" />
                  <p className="font-display text-xl text-soft-white">{cat.name}</p>
                </div>
                <p className="text-xs text-soft-white/40">
                  {stats?.projectCount ?? 0} projects · {stats?.albumCount ?? 0} albums ·{" "}
                  {stats?.photoCount ?? 0} photos · {stats?.videoCount ?? 0} videos
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {mode === "projects" && category && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((item) => {
            const stats = projectStats[item.id];
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5"
              >
                <Link
                  href={`/admin/library/${category.slug}/${item.slug}`}
                  className="group block"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <Briefcase size={18} className="text-gold/80" />
                    <p className="text-sm text-soft-white transition group-hover:text-gold">
                      {item.name}
                    </p>
                  </div>
                  <p className="text-xs text-soft-white/40">
                    {item.clientName || "—"} · {item.status.replace("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-soft-white/40">
                    {stats?.albumCount ?? 0} albums · {stats?.photoCount ?? 0} photos ·{" "}
                    {stats?.videoCount ?? 0} videos
                  </p>
                </Link>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="text-[10px] uppercase tracking-[0.18em] text-soft-white/35 hover:text-gold"
                    onClick={() => {
                      const next = window.prompt("Rename project", item.name);
                      if (!next?.trim()) return;
                      startTransition(async () => {
                        await persistProjectUpdate(item.id, { name: next.trim() });
                        router.refresh();
                      });
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="text-[10px] uppercase tracking-[0.18em] text-red-300/70 hover:text-red-300"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Delete project "${item.name}" and all albums/media?`
                        )
                      )
                        return;
                      startTransition(async () => {
                        try {
                          await removeProject(item.id);
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
          {filteredProjects.length === 0 && (
            <p className="text-sm text-soft-white/40">
              No projects yet. Add the first project above.
            </p>
          )}
        </div>
      )}

      {mode === "albums" && category && project && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredAlbums.map((item) => {
            const stats = albumStats[item.id];
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5"
              >
                <Link
                  href={`/admin/library/${category.slug}/${project.slug}/${item.slug}`}
                  className="group block"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <Images size={18} className="text-gold/80" />
                    <p className="text-sm text-soft-white transition group-hover:text-gold">
                      {item.name}
                    </p>
                  </div>
                  <p className="text-xs text-soft-white/40">
                    {stats?.photoCount ?? 0} photos · {stats?.videoCount ?? 0} videos
                  </p>
                </Link>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="text-[10px] uppercase tracking-[0.18em] text-soft-white/35 hover:text-gold"
                    onClick={() => {
                      const next = window.prompt("Rename album", item.name);
                      if (!next?.trim()) return;
                      startTransition(async () => {
                        await persistAlbumUpdate(item.id, { name: next.trim() });
                        router.refresh();
                      });
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="text-[10px] uppercase tracking-[0.18em] text-red-300/70 hover:text-red-300"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Delete album "${item.name}" and all media?`
                        )
                      )
                        return;
                      startTransition(async () => {
                        try {
                          await removeAlbum(item.id);
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
          {filteredAlbums.length === 0 && (
            <p className="text-sm text-soft-white/40">
              No albums yet. Add a custom album (Haldi, Ceremony, Reception…).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
