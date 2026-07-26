"use client";

import { useEffect, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  EDITOR_GRID_COLUMNS,
  getCanvasHeight,
  getGridGap,
  getRowHeight,
} from "@/lib/gallery-builder/engine";
import SortableVideoTile from "@/components/admin/video-builder/SortableVideoTile";
import type { GalleryVideo } from "@/types";
import type { GalleryLayoutItem } from "@/types/cms";

interface VideoCanvasProps {
  items: GalleryLayoutItem[];
  videos: GalleryVideo[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReorder: (activeId: string, overId: string) => void;
}

export default function VideoCanvas({
  items,
  videos,
  selectedId,
  onSelect,
  onReorder,
}: VideoCanvasProps) {
  const videoMap = new Map(videos.map((video) => [video.id, video]));
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const rowHeight = getRowHeight();
  const gap = getGridGap();
  const layoutKey = useMemo(
    () =>
      sorted
        .map((item) => `${item.id}:${item.x},${item.y},${item.colSpan},${item.rowSpan}`)
        .join("|"),
    [sorted]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!selectedId) return;
    document
      .getElementById(`video-tile-${selectedId}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div
        className="min-h-[480px] rounded-2xl border border-white/[0.08] bg-[#06120D] p-4"
        onClick={() => onSelect(null)}
      >
        {sorted.length === 0 ? (
          <div className="flex h-[420px] items-center justify-center text-sm text-soft-white/35">
            No videos in this category yet.
          </div>
        ) : (
          <SortableContext
            key={layoutKey}
            items={sorted.map((item) => item.id)}
            strategy={rectSortingStrategy}
          >
            <div
              className="relative w-full"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${EDITOR_GRID_COLUMNS}, minmax(0, 1fr))`,
                gridAutoRows: `${rowHeight}px`,
                gap: `${gap}px`,
                minHeight: getCanvasHeight(sorted),
              }}
            >
              {sorted.map((item) => (
                <SortableVideoTile
                  key={item.id}
                  item={item}
                  video={videoMap.get(item.imageId)}
                  selected={selectedId === item.id}
                  onSelect={() => onSelect(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </DndContext>
  );
}
