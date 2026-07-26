"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Pause, Play, RotateCcw, X } from "lucide-react";
import { uploadFile } from "@/app/actions/admin";
import type { Album, CategoryCMS, ProjectCMS } from "@/types/cms";

interface UploadItem {
  id: string;
  name: string;
  progress: number;
  status: "queued" | "uploading" | "done" | "error" | "paused";
  errorMessage?: string;
}

interface UploadZoneProps {
  categories: CategoryCMS[];
  projects?: ProjectCMS[];
  albums: Album[];
  lockedHierarchy?: {
    categorySlug: string;
    projectSlug: string;
    albumSlug: string;
  };
}

export default function UploadZone({
  categories,
  projects = [],
  albums,
  lockedHierarchy,
}: UploadZoneProps) {
  const router = useRouter();
  const [targetCategory, setTargetCategory] = useState(
    lockedHierarchy?.categorySlug ?? categories[0]?.slug ?? "wedding"
  );
  const [targetProject, setTargetProject] = useState(
    lockedHierarchy?.projectSlug ?? ""
  );
  const [targetAlbum, setTargetAlbum] = useState(
    lockedHierarchy?.albumSlug ?? ""
  );
  const [mediaType, setMediaType] = useState<"photo" | "video">("photo");
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [hierarchyError, setHierarchyError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const filesRef = useRef<Map<string, File>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!lockedHierarchy) return;
    // Sync form selection to the locked hierarchy prop when it changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetCategory(lockedHierarchy.categorySlug);
    setTargetProject(lockedHierarchy.projectSlug);
    setTargetAlbum(lockedHierarchy.albumSlug);
  }, [lockedHierarchy]);

  const projectOptions = useMemo(() => {
    const fromAlbums = albums
      .filter((a) => a.categorySlug === targetCategory && a.projectSlug)
      .map((a) => ({
        slug: a.projectSlug!,
        name: a.projectSlug!,
        id: a.projectId ?? a.projectSlug!,
      }));
    const fromProjects = projects
      .filter((p) => p.categorySlug === targetCategory)
      .map((p) => ({ slug: p.slug, name: p.name, id: p.id }));
    const merged = [...fromProjects];
    for (const item of fromAlbums) {
      if (!merged.some((p) => p.slug === item.slug)) merged.push(item);
    }
    return merged;
  }, [albums, projects, targetCategory]);

  const albumOptions = useMemo(
    () =>
      albums.filter(
        (album) =>
          album.categorySlug === targetCategory &&
          (!targetProject || (album.projectSlug ?? "") === targetProject)
      ),
    [albums, targetCategory, targetProject]
  );

  useEffect(() => {
    if (lockedHierarchy) return;
    // Keep the selected project valid as the available options change.
    if (!targetProject && projectOptions[0]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetProject(projectOptions[0].slug);
    } else if (
      targetProject &&
      projectOptions.length > 0 &&
      !projectOptions.some((p) => p.slug === targetProject)
    ) {
      setTargetProject(projectOptions[0]?.slug ?? "");
    }
  }, [lockedHierarchy, projectOptions, targetProject]);

  useEffect(() => {
    if (lockedHierarchy) return;
    // Keep the selected album valid as the available options change.
    if (!targetAlbum && albumOptions[0]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetAlbum(albumOptions[0].slug);
    } else if (
      targetAlbum &&
      albumOptions.length > 0 &&
      !albumOptions.some((a) => a.slug === targetAlbum)
    ) {
      setTargetAlbum(albumOptions[0]?.slug ?? "");
    }
  }, [lockedHierarchy, albumOptions, targetAlbum]);

  const hierarchyReady = Boolean(
    targetCategory &&
      (targetProject || projectOptions[0]?.slug) &&
      (targetAlbum || albumOptions[0]?.slug) &&
      projectOptions.length > 0 &&
      albumOptions.length > 0
  );

  const uploadOne = useCallback(
    async (itemId: string) => {
      const file = filesRef.current.get(itemId);
      if (!file) {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: "error",
                  progress: 0,
                  errorMessage: "File no longer available — re-select to retry.",
                }
              : item
          )
        );
        return;
      }

      const projectSlug = targetProject || projectOptions[0]?.slug;
      const albumSlug = targetAlbum || albumOptions[0]?.slug;
      if (!projectSlug || !albumSlug) return;

      setQueue((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, status: "uploading", progress: 10, errorMessage: undefined }
            : item
        )
      );

      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", targetCategory);
      formData.append("projectSlug", projectSlug);
      formData.append("albumSlug", albumSlug);
      formData.append("mediaType", mediaType);

      try {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, progress: 55 } : item
          )
        );
        await uploadFile(formData);
        setQueue((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, status: "done", progress: 100 }
              : item
          )
        );
        filesRef.current.delete(itemId);
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";
        setQueue((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: "error",
                  progress: 0,
                  name: file.name,
                  errorMessage: message,
                }
              : item
          )
        );
      }
    },
    [
      albumOptions,
      mediaType,
      projectOptions,
      router,
      targetAlbum,
      targetCategory,
      targetProject,
    ]
  );

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);

    while (true) {
      if (pausedRef.current) break;

      const pending = queue.find(
        (item) => item.status === "queued" || item.status === "paused"
      );
      if (!pending) break;

      if (pending.status === "paused") {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === pending.id ? { ...item, status: "queued" } : item
          )
        );
      }

      await uploadOne(pending.id);
    }

    processingRef.current = false;
    setIsProcessing(false);
  }, [queue, uploadOne]);

  useEffect(() => {
    const hasPending = queue.some(
      (item) => item.status === "queued" || item.status === "paused"
    );
    if (hasPending && !pausedRef.current && !processingRef.current) {
      void processQueue();
    }
  }, [queue, processQueue]);

  const enqueueFiles = useCallback(
    (files: FileList | File[]) => {
      const accept =
        mediaType === "photo"
          ? (file: File) => file.type.startsWith("image/")
          : (file: File) => file.type.startsWith("video/");

      const list = Array.from(files).filter(accept);
      const projectSlug = targetProject || projectOptions[0]?.slug;
      const albumSlug = targetAlbum || albumOptions[0]?.slug;
      if (!projectSlug || !albumSlug) {
        setHierarchyError(
          "Create a project and album in the library before uploading."
        );
        return;
      }
      setHierarchyError("");

      const items: UploadItem[] = list.map((file) => {
        const id = `${file.name}-${Date.now()}-${Math.random()}`;
        filesRef.current.set(id, file);
        return {
          id,
          name: file.name,
          progress: 0,
          status: "queued" as const,
        };
      });
      setQueue((prev) => [...prev, ...items]);
      pausedRef.current = false;
      setPaused(false);
    },
    [albumOptions, mediaType, projectOptions, targetAlbum, targetProject]
  );

  const retryFailed = () => {
    setQueue((prev) =>
      prev.map((item) =>
        item.status === "error" && filesRef.current.has(item.id)
          ? { ...item, status: "queued", progress: 0, errorMessage: undefined }
          : item
      )
    );
    pausedRef.current = false;
    setPaused(false);
  };

  const clearCompleted = () => {
    setQueue((prev) => prev.filter((item) => item.status !== "done"));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!hierarchyReady) {
      setHierarchyError(
        "Create a project and album in the library before uploading."
      );
      return;
    }
    if (e.dataTransfer.files.length) enqueueFiles(e.dataTransfer.files);
  };

  const locked = Boolean(lockedHierarchy);
  const pathPreview = `${targetCategory}/${targetProject || "…"}/${targetAlbum || "…"}/${mediaType === "photo" ? "photos" : "videos"}/`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
            Category
          </span>
          <select
            value={targetCategory}
            disabled={locked}
            onChange={(e) => {
              setTargetCategory(e.target.value);
              setTargetProject("");
              setTargetAlbum("");
            }}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-soft-white outline-none focus:border-gold/35 disabled:opacity-50"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
            Project
          </span>
          <select
            value={targetProject}
            disabled={locked || projectOptions.length === 0}
            onChange={(e) => {
              setTargetProject(e.target.value);
              setTargetAlbum("");
            }}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-soft-white outline-none focus:border-gold/35 disabled:opacity-50"
          >
            {projectOptions.length === 0 ? (
              <option value="">Create a project first</option>
            ) : (
              projectOptions.map((project) => (
                <option key={project.id} value={project.slug}>
                  {project.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
            Album
          </span>
          <select
            value={targetAlbum}
            disabled={locked || albumOptions.length === 0}
            onChange={(e) => setTargetAlbum(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-soft-white outline-none focus:border-gold/35 disabled:opacity-50"
          >
            {albumOptions.length === 0 ? (
              <option value="">Create an album first</option>
            ) : (
              albumOptions.map((album) => (
                <option key={album.id} value={album.slug}>
                  {album.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
            Media type
          </span>
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as "photo" | "video")}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-soft-white outline-none focus:border-gold/35"
          >
            <option value="photo">Photo</option>
            <option value="video">Video</option>
          </select>
        </label>
      </div>

      {hierarchyError && (
        <p className="text-xs text-red-300/90">{hierarchyError}</p>
      )}

      <div
        role="button"
        tabIndex={hierarchyReady ? 0 : -1}
        aria-disabled={!hierarchyReady}
        onKeyDown={(e) => {
          if (!hierarchyReady) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (hierarchyReady) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => {
          if (!hierarchyReady) {
            setHierarchyError(
              "Create a project and album in the library before uploading."
            );
            return;
          }
          inputRef.current?.click();
        }}
        className={`rounded-2xl border border-dashed p-10 text-center transition ${
          !hierarchyReady
            ? "cursor-not-allowed border-white/10 bg-white/[0.01] opacity-55"
            : isDragging
              ? "cursor-pointer border-gold/50 bg-gold/5"
              : "cursor-pointer border-white/10 bg-white/[0.02] hover:border-gold/25"
        }`}
      >
        <Upload size={28} className="mx-auto mb-3 text-gold/80" />
        <p className="text-sm text-soft-white/70">
          {hierarchyReady
            ? `Drag ${mediaType === "photo" ? "photos" : "videos"} here, or click to browse`
            : "Select an existing project and album to enable uploads"}
        </p>
        <p className="mt-2 text-xs text-soft-white/35">{pathPreview}</p>
        <input
          ref={inputRef}
          type="file"
          accept={mediaType === "photo" ? "image/*" : "video/*"}
          multiple
          className="hidden"
          disabled={!hierarchyReady}
          onChange={(e) => e.target.files && enqueueFiles(e.target.files)}
        />
      </div>

      {queue.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !pausedRef.current;
                pausedRef.current = next;
                setPaused(next);
                if (!next) void processQueue();
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-soft-white/55"
            >
              {paused ? <Play size={12} /> : <Pause size={12} />}
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={retryFailed}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-soft-white/55"
            >
              <RotateCcw size={12} />
              Retry failed
            </button>
            <button
              type="button"
              onClick={clearCompleted}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-soft-white/55"
            >
              <X size={12} />
              Clear done
            </button>
            {isProcessing && (
              <span className="text-xs text-gold/70">Uploading…</span>
            )}
          </div>

          {queue.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
            >
              <div className="mb-1 flex justify-between gap-2 text-xs">
                <span className="truncate text-soft-white/70">{item.name}</span>
                <span className="shrink-0 text-soft-white/35">{item.status}</span>
              </div>
              {item.errorMessage && (
                <p className="mb-1 text-[11px] text-red-300/85">{item.errorMessage}</p>
              )}
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={`h-full transition-all ${
                    item.status === "error" ? "bg-red-400" : "bg-gold/70"
                  }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
