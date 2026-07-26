"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { persistVideoGalleryLayout } from "@/app/actions/cms";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import AdminCard from "@/components/admin/shared/AdminCard";
import BuilderToolbar from "@/components/admin/gallery-builder/BuilderToolbar";
import VideoCanvas from "@/components/admin/video-builder/VideoCanvas";
import TileInspector from "@/components/admin/gallery-builder/TileInspector";
import VisualVideoGridGallery from "@/components/features/portfolio/VisualVideoGridGallery";
import { getCanvasHeight } from "@/lib/gallery-builder/engine";
import { getClampedInspectorTop } from "@/lib/gallery-layout-render";
import { useVideoBuilderStore } from "@/stores/video-builder-store";
import { cn } from "@/lib/utils";
import type { GalleryVideo, Category } from "@/types";
import type { CategoryCMS, GalleryLayout } from "@/types/cms";

const INSPECTOR_WIDTH = 260;
const CANVAS_PADDING = 16;

function toCategoryCMS(category: Category): CategoryCMS {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    coverImage: category.coverImage,
    order: category.order,
    featured: category.featured,
    hidden: false,
    color: "#0F3D2E",
    seoTitle: category.name,
    seoDescription: category.description,
  };
}

interface VideoBuilderProps {
  categories: Category[];
  videos: GalleryVideo[];
  layouts: Record<string, GalleryLayout>;
}

export default function VideoBuilder({
  categories,
  videos,
  layouts,
}: VideoBuilderProps) {
  const router = useRouter();
  const [saveError, setSaveError] = useState("");
  const {
    categorySlug,
    items,
    gridType,
    status,
    selectedId,
    isDirty,
    isSaving,
    showPreview,
    setCategory,
    loadLayout,
    selectItem,
    reorderItems,
    setSizePreset,
    growItem,
    shrinkItem,
    setGridTypeAndArrange,
    applyAutoArrange,
    undo,
    redo,
    canUndo,
    canRedo,
    history,
    historyIndex,
    removeItem,
    togglePin,
    toggleHidden,
    setCover,
    togglePreview,
    markSaved,
    setSaving,
    buildLayout,
  } = useVideoBuilderStore();

  const cmsCategories = useMemo(
    () => categories.map(toCategoryCMS).sort((a, b) => a.order - b.order),
    [categories]
  );

  const initialCategory = cmsCategories[0]?.slug ?? "";
  const loadedCategoryRef = useRef<string | null>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const [inspectorHeight, setInspectorHeight] = useState(520);

  useEffect(() => {
    const slug = categorySlug || initialCategory;
    if (!slug) return;

    if (!categorySlug) {
      setCategory(slug);
      return;
    }

    if (loadedCategoryRef.current === slug) return;
    loadedCategoryRef.current = slug;
    loadLayout(slug, layouts[slug] ?? null, videos);
  }, [categorySlug, initialCategory, layouts, videos, loadLayout, setCategory]);

  const categoryVideos = useMemo(
    () => videos.filter((video) => video.category === categorySlug),
    [videos, categorySlug]
  );

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const selectedVideo = selectedItem
    ? videos.find((video) => video.id === selectedItem.imageId)
    : undefined;

  const previewVideos = useMemo(() => {
    const videoMap = new Map(categoryVideos.map((video) => [video.id, video]));
    return items
      .filter((item) => !item.hidden && videoMap.has(item.imageId))
      .sort((a, b) => a.order - b.order)
      .map((item) => videoMap.get(item.imageId)!);
  }, [items, categoryVideos]);

  const canvasHeight = getCanvasHeight(items) + CANVAS_PADDING * 2;

  const inspectorTop = useMemo(() => {
    if (!selectedItem) return CANVAS_PADDING;
    return getClampedInspectorTop(
      selectedItem,
      inspectorHeight,
      canvasHeight,
      CANVAS_PADDING
    );
  }, [selectedItem, inspectorHeight, canvasHeight]);

  useEffect(() => {
    const node = inspectorRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setInspectorHeight(entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [selectedItem]);

  const historyLabel = history[historyIndex]?.label;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        if (canUndo()) undo();
      }
      if (event.key === "z" && event.shiftKey) {
        event.preventDefault();
        if (canRedo()) redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  const handleCategoryChange = useCallback(
    (slug: string) => {
      if (slug === categorySlug) return;
      if (isDirty && !window.confirm("You have unsaved changes. Switch category anyway?")) {
        return;
      }
      loadedCategoryRef.current = null;
      setCategory(slug);
    },
    [categorySlug, isDirty, setCategory]
  );

  const handleSave = useCallback(
    async (publish: boolean) => {
      if (!categorySlug) return;
      setSaving(true);
      setSaveError("");
      try {
        const layout = {
          ...buildLayout(),
          status: publish ? ("published" as const) : ("draft" as const),
        };
        await persistVideoGalleryLayout(layout);
        markSaved(layout.status);
        router.refresh();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
        setSaving(false);
      }
    },
    [categorySlug, buildLayout, markSaved, setSaving, router]
  );

  const handleCanvasSelect = useCallback(
    (id: string | null) => {
      selectItem(id);
    },
    [selectItem]
  );

  const inspectorPreview = selectedVideo
    ? {
        src: selectedVideo.thumbnail,
        title: selectedVideo.title,
        subtitle: selectedVideo.duration,
      }
    : undefined;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Video Builder"
        description="All category videos are placed on the grid automatically. Drag to reorder, resize tiles, and publish when ready."
      />

      {saveError && (
        <p className="text-xs text-red-300/90">{saveError}</p>
      )}

      <BuilderToolbar
        categories={cmsCategories}
        categorySlug={categorySlug}
        gridType={gridType}
        status={status}
        isDirty={isDirty}
        isSaving={isSaving}
        showPreview={showPreview}
        itemCount={items.length}
        canUndo={canUndo()}
        canRedo={canRedo()}
        historyLabel={historyLabel}
        builderLabel="Video Builder"
        onCategoryChange={handleCategoryChange}
        onGridTypeChange={setGridTypeAndArrange}
        onAutoArrange={applyAutoArrange}
        onUndo={undo}
        onRedo={redo}
        onSave={handleSave}
        onTogglePreview={togglePreview}
      />

      <div className="relative min-w-0">
        <div
          className={cn("transition-[padding] duration-200")}
          style={{
            paddingRight: selectedItem && !showPreview ? INSPECTOR_WIDTH + 16 : undefined,
          }}
        >
          {showPreview ? (
            <AdminCard>
              <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-soft-white/40">
                Live Preview
              </p>
              <VisualVideoGridGallery
                videos={previewVideos}
                layoutItems={items.filter((item) => !item.hidden)}
                layout={{
                  categorySlug,
                  gridType,
                  status,
                  items,
                  updatedAt: "",
                }}
              />
            </AdminCard>
          ) : items.length > 0 ? (
            <VideoCanvas
              items={items}
              videos={categoryVideos}
              selectedId={selectedId}
              onSelect={handleCanvasSelect}
              onReorder={reorderItems}
            />
          ) : (
            <AdminCard>
              <div className="flex min-h-[480px] items-center justify-center text-sm text-soft-white/35">
                {categoryVideos.length
                  ? "Loading grid…"
                  : "No videos in this category yet."}
              </div>
            </AdminCard>
          )}
        </div>

        {selectedItem && !showPreview && (
          <div
            ref={inspectorRef}
            className="absolute right-0 z-20 w-[260px] transition-[top] duration-200 ease-out"
            style={{ top: inspectorTop }}
          >
            <AdminCard className="max-h-[calc(100vh-8rem)] overflow-y-auto shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
              <TileInspector
                item={selectedItem}
                preview={inspectorPreview}
                mediaLabel="Selected Video"
                coverLabel="Set as cover"
                onSizePreset={(size) => selectedId && setSizePreset(selectedId, size)}
                onGrow={() => selectedId && growItem(selectedId)}
                onShrink={() => selectedId && shrinkItem(selectedId)}
                onPin={() => selectedId && togglePin(selectedId)}
                onToggleHidden={() => selectedId && toggleHidden(selectedId)}
                onSetCover={() => selectedId && setCover(selectedId)}
                onRemove={() => selectedId && removeItem(selectedId)}
              />
            </AdminCard>
          </div>
        )}
      </div>
    </div>
  );
}
