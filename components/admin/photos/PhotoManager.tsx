"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Download,
  Trash2,
  Sparkles,
  Info,
  CheckSquare,
  Square,
} from "lucide-react";
import AdminCard from "@/components/admin/shared/AdminCard";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import UploadZone from "@/components/admin/upload/UploadZone";
import { persistImageMetadata } from "@/app/actions/cms";
import { deleteMedia } from "@/app/actions/admin";
import type { GalleryImage, GalleryVideo } from "@/types";
import type { Album, CategoryCMS, ImageMetadata } from "@/types/cms";

const TOOLBAR = [
  { icon: Info, label: "Metadata" },
  { icon: Star, label: "Favorite" },
  { icon: Download, label: "Download" },
  { icon: Trash2, label: "Delete" },
] as const;

export default function PhotoManager({
  photos,
  videos,
  categories,
  albums,
  projects = [],
  metadataMap,
  lockedHierarchy,
  hideHeader = false,
}: {
  photos: GalleryImage[];
  videos: GalleryVideo[];
  categories: CategoryCMS[];
  albums: Album[];
  projects?: import("@/types/cms").ProjectCMS[];
  metadataMap: Record<string, ImageMetadata>;
  lockedHierarchy?: {
    categorySlug: string;
    projectSlug: string;
    albumSlug: string;
  };
  hideHeader?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState(
    lockedHierarchy?.categorySlug ?? "all"
  );
  const [albumFilter, setAlbumFilter] = useState(
    lockedHierarchy?.albumSlug ?? "all"
  );
  const [mediaType, setMediaType] = useState<"all" | "photo" | "video">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "alpha">("newest");
  const [metadataId, setMetadataId] = useState<string | null>(null);
  const [localMetadata, setLocalMetadata] = useState(metadataMap);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState("");
  const router = useRouter();

  const mediaItems = useMemo(() => {
    const photoItems = photos.map((photo) => ({
      id: photo.id,
      type: "photo" as const,
      title: photo.title ?? photo.alt,
      category: photo.category,
      albumSlug: photo.albumSlug ?? "main",
      src: photo.src,
      thumb: photo.thumbnail ?? photo.src,
      createdAt: photo.createdAt ?? "",
      featured: photo.featured,
      raw: photo,
    }));
    const videoItems = videos.map((video) => ({
      id: video.id,
      type: "video" as const,
      title: video.title,
      category: video.category,
      albumSlug: video.albumSlug ?? "main",
      src: video.src,
      thumb: video.thumbnail,
      createdAt: video.createdAt ?? "",
      featured: false,
      raw: video,
    }));
    return [...photoItems, ...videoItems].filter((item) => !hiddenIds.has(item.id));
  }, [photos, videos, hiddenIds]);

  const filtered = useMemo(() => {
    let items = mediaItems;
    if (categoryFilter !== "all") {
      items = items.filter((item) => item.category === categoryFilter);
    }
    if (albumFilter !== "all") {
      items = items.filter((item) => item.albumSlug === albumFilter);
    }
    if (mediaType !== "all") {
      items = items.filter((item) => item.type === mediaType);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }
    items = [...items];
    if (sort === "oldest") {
      items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } else if (sort === "alpha") {
      items.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return items;
  }, [mediaItems, categoryFilter, albumFilter, mediaType, search, sort]);

  const albumOptions = useMemo(() => {
    if (categoryFilter === "all") return albums;
    return albums.filter((album) => album.categorySlug === categoryFilter);
  }, [albums, categoryFilter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((photo) => photo.id)));
    }
  };

  const saveMetadata = useCallback(
    (next: Record<string, ImageMetadata>) => {
      setLocalMetadata(next);
      startTransition(async () => {
        await persistImageMetadata(next);
      });
    },
    []
  );

  const updateMetadata = (imageId: string, patch: Partial<ImageMetadata>) => {
    const current = localMetadata[imageId] ?? {
      imageId,
      tags: [],
    };
    saveMetadata({
      ...localMetadata,
      [imageId]: { ...current, ...patch },
    });
  };

  const removeMediaItems = (ids: string[]) => {
    if (ids.length === 0) return;
    const label = ids.length === 1 ? "this item" : `${ids.length} items`;
    if (!window.confirm(`Delete ${label}? This removes metadata and storage objects.`)) {
      return;
    }
    setActionError("");
    startTransition(async () => {
      try {
        for (const id of ids) {
          const item = mediaItems.find((entry) => entry.id === id);
          if (!item) continue;
          await deleteMedia(id, item.type);
        }
        setHiddenIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.add(id));
          return next;
        });
        setSelected((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        router.refresh();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Delete failed");
      }
    });
  };

  const activeMeta = metadataId ? localMetadata[metadataId] : null;
  const activePhoto = metadataId ? photos.find((p) => p.id === metadataId) : null;

  return (
    <div>
      {!hideHeader && (
        <AdminPageHeader
          title="Media Library"
          description="Browse, search, and manage photos and videos across categories, projects, and albums."
          actions={
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-soft-white/60"
            >
              {selected.size === filtered.length ? (
                <CheckSquare size={14} />
              ) : (
                <Square size={14} />
              )}
              {selected.size > 0 ? `${selected.size} selected` : "Select all"}
            </button>
          }
        />
      )}

      <AdminCard className="mb-6 space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search media..."
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-soft-white outline-none focus:border-gold/35"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-xl border border-white/10 bg-[#0A1410] px-3 py-2.5 text-sm text-soft-white outline-none focus:border-gold/35"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="alpha">Alphabetical</option>
          </select>
          <select
            value={albumFilter}
            disabled={Boolean(lockedHierarchy)}
            onChange={(e) => setAlbumFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0A1410] px-3 py-2.5 text-sm text-soft-white outline-none focus:border-gold/35 disabled:opacity-50"
          >
            <option value="all">All albums</option>
            {albumOptions.map((album) => (
              <option key={album.id} value={album.slug}>
                {album.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            {(["all", "photo", "video"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMediaType(type)}
                className={`flex-1 rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.18em] ${
                  mediaType === type
                    ? "bg-emerald/20 text-gold"
                    : "bg-white/[0.04] text-soft-white/45"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        {!lockedHierarchy && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("all");
                  setAlbumFilter("all");
                }}
                className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.18em] ${
                  categoryFilter === "all"
                    ? "bg-emerald/20 text-gold"
                    : "bg-white/[0.04] text-soft-white/45"
                }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(category.slug);
                    setAlbumFilter("all");
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.18em] ${
                    categoryFilter === category.slug
                      ? "bg-emerald/20 text-gold"
                      : "bg-white/[0.04] text-soft-white/45"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.18em] ${
                  viewMode === "grid" ? "bg-emerald/20 text-gold" : "bg-white/[0.04] text-soft-white/45"
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.18em] ${
                  viewMode === "list" ? "bg-emerald/20 text-gold" : "bg-white/[0.04] text-soft-white/45"
                }`}
              >
                List
              </button>
            </div>
          </div>
        )}
        <UploadZone
          categories={categories}
          projects={projects}
          albums={albums}
          lockedHierarchy={lockedHierarchy}
        />
      </AdminCard>

      {selected.size > 0 && (
        <AdminCard className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => removeMediaItems([...selected])}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-soft-white/55 hover:border-gold/30 hover:text-gold"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => {
              for (const id of selected) {
                const item = mediaItems.find((entry) => entry.id === id);
                if (item) window.open(item.src, "_blank");
              }
            }}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-soft-white/55 hover:border-gold/30 hover:text-gold"
          >
            Download
          </button>
        </AdminCard>
      )}

      {actionError && (
        <p className="mb-4 text-xs text-red-300/90">{actionError}</p>
      )}

      {filtered.length === 0 ? (
        <AdminCard>
          <p className="text-sm text-soft-white/40">
            No media matches the current filters. Upload photos or videos into a
            project album to get started.
          </p>
        </AdminCard>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {filtered.map((item) => {
            const meta = item.type === "photo" ? localMetadata[item.id] : undefined;
            const isSelected = selected.has(item.id);

            return (
              <motion.div
                key={item.id}
                layout
                className={`group relative overflow-hidden rounded-2xl border bg-[#0A1410] ${
                  isSelected ? "border-gold/40 ring-1 ring-gold/20" : "border-white/[0.08]"
                }`}
                onContextMenu={(e) => {
                  if (item.type === "photo") {
                    e.preventDefault();
                    setMetadataId(item.id);
                  }
                }}
              >
                <button
                  type="button"
                  aria-label={isSelected ? "Deselect item" : "Select item"}
                  onClick={() => toggleSelect(item.id)}
                  className="absolute left-2 top-2 z-10 rounded-md bg-black/50 p-1 text-soft-white/70"
                >
                  {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumb}
                  alt={item.title}
                  className="aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  draggable
                />

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />

                {item.type === "photo" && (
                  <div className="absolute inset-x-0 bottom-0 translate-y-full p-2 transition group-hover:translate-y-0">
                    <div className="flex flex-wrap justify-center gap-1">
                      {TOOLBAR.map(({ icon: Icon, label }) => (
                        <button
                          key={label}
                          type="button"
                          title={label}
                          onClick={() => {
                            if (label === "Metadata") setMetadataId(item.id);
                            if (label === "Favorite")
                              updateMetadata(item.id, { starred: !meta?.starred });
                            if (label === "Download") window.open(item.src, "_blank");
                            if (label === "Delete") removeMediaItems([item.id]);
                          }}
                          className="rounded-lg bg-black/60 p-1.5 text-soft-white/80 hover:text-gold"
                        >
                          <Icon size={12} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="absolute right-2 top-2 flex gap-1">
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-gold">
                    {item.type}
                  </span>
                  {meta?.starred && <Star size={14} className="text-gold" fill="currentColor" />}
                  {item.featured && <Sparkles size={14} className="text-emerald" />}
                </div>

                <p className="truncate px-2 py-1.5 text-[10px] text-soft-white/45">
                  {item.category} · {item.albumSlug}
                </p>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <AdminCard className="divide-y divide-white/[0.06] p-0">
          {filtered.map((item) => {
            const isSelected = selected.has(item.id);
            return (
              <div
                key={item.id}
                className={`flex items-center gap-4 px-4 py-3 ${
                  isSelected ? "bg-gold/5" : ""
                }`}
              >
                <button
                  type="button"
                  aria-label={isSelected ? "Deselect item" : "Select item"}
                  onClick={() => toggleSelect(item.id)}
                >
                  {isSelected ? (
                    <CheckSquare size={14} className="text-gold" />
                  ) : (
                    <Square size={14} className="text-soft-white/35" />
                  )}
                </button>
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.thumb} alt={item.title} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-soft-white">{item.title}</p>
                  <p className="text-xs text-soft-white/40">
                    {item.category} · {item.albumSlug}
                  </p>
                </div>
                <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-soft-white/45">
                  {item.type}
                </span>
                <span className="hidden text-xs text-soft-white/35 sm:block">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
                </span>
              </div>
            );
          })}
        </AdminCard>
      )}

      <AnimatePresence>
        {metadataId && activePhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={() => setMetadataId(null)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#081A12] p-6"
            >
              <h3 className="mb-4 font-display text-xl text-soft-white">Image Metadata</h3>
              <div className="mb-4 overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activePhoto.src}
                  alt={activePhoto.alt}
                  className="aspect-video w-full object-cover"
                />
              </div>
              {(
                [
                  ["Alt Text", "altText"],
                  ["Description", "description"],
                  ["Camera", "camera"],
                  ["Lens", "lens"],
                  ["ISO", "iso"],
                  ["Exposure", "exposure"],
                  ["Location", "location"],
                  ["Copyright", "copyright"],
                  ["Tags (comma separated)", "tags"],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="mb-3 block">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-soft-white/35">
                    {label}
                  </span>
                  <input
                    value={
                      key === "tags"
                        ? (activeMeta?.tags ?? []).join(", ")
                        : ((activeMeta?.[key] as string) ?? "")
                    }
                    onChange={(e) =>
                      updateMetadata(
                        metadataId,
                        key === "tags"
                          ? {
                              tags: e.target.value
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean),
                            }
                          : { [key]: e.target.value }
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-soft-white outline-none focus:border-gold/35"
                  />
                </label>
              ))}
              {isPending && (
                <p className="text-xs text-gold/70">Saving metadata...</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
