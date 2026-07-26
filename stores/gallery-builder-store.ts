import { create } from "zustand";
import {
  buildCategoryGridLayout,
  packItems,
  pickSceneGridType,
  resizeItem,
  runGalleryAutoArrange,
} from "@/lib/gallery-builder/engine";
import { buildLayoutViewports } from "@/lib/gallery-layout-render";
import type { GalleryImage } from "@/types";
import type {
  GalleryGridType,
  GalleryLayout,
  GalleryLayoutItem,
  GalleryTileSize,
} from "@/types/cms";
import {
  EDITOR_GRID_COLUMNS,
  GRID_TYPE_LABELS,
  migrateLegacyLayout,
  normalizeLayoutItem,
  TILE_SIZE_PRESETS,
} from "@/types/cms";
import { randomUUID } from "@/lib/uuid";

const MAX_HISTORY = 40;

interface LayoutSnapshot {
  items: GalleryLayoutItem[];
  gridType: GalleryGridType;
  label: string;
}

interface GalleryBuilderState {
  categorySlug: string;
  categoryPhotos: GalleryImage[];
  items: GalleryLayoutItem[];
  gridType: GalleryGridType;
  status: GalleryLayout["status"];
  selectedId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  showPreview: boolean;
  history: LayoutSnapshot[];
  historyIndex: number;
  sceneCounter: number;

  setCategory: (slug: string) => void;
  loadLayout: (
    categorySlug: string,
    layout: GalleryLayout | null,
    photos: GalleryImage[]
  ) => void;
  selectItem: (id: string | null) => void;
  reorderItems: (activeId: string, overId: string) => void;
  setSizePreset: (itemId: string, size: GalleryTileSize) => void;
  growItem: (itemId: string) => void;
  shrinkItem: (itemId: string) => void;
  setGridTypeAndArrange: (gridType: GalleryGridType) => void;
  applyAutoArrange: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  addPhoto: (photo: GalleryImage) => void;
  removeItem: (itemId: string) => void;
  togglePin: (itemId: string) => void;
  toggleHidden: (itemId: string) => void;
  setCover: (itemId: string) => void;
  togglePreview: () => void;
  markSaved: (status: GalleryLayout["status"]) => void;
  setSaving: (saving: boolean) => void;
  buildLayout: () => GalleryLayout;
}

function sortByOrder(items: GalleryLayoutItem[]) {
  return [...items].sort((a, b) => a.order - b.order);
}

function cloneItems(items: GalleryLayoutItem[]): GalleryLayoutItem[] {
  return JSON.parse(JSON.stringify(items)) as GalleryLayoutItem[];
}

function syncItemsWithCategoryPhotos(
  items: GalleryLayoutItem[],
  categoryPhotos: GalleryImage[],
  gridType: GalleryGridType
) {
  if (!categoryPhotos.length) return items;
  return buildCategoryGridLayout(
    categoryPhotos,
    items,
    gridType,
    EDITOR_GRID_COLUMNS,
    { rearrange: false }
  );
}

function createSnapshot(
  items: GalleryLayoutItem[],
  gridType: GalleryGridType,
  label: string
): LayoutSnapshot {
  return {
    items: cloneItems(items),
    gridType,
    label,
  };
}

function inferSizeFromSpans(colSpan: number, rowSpan: number): GalleryTileSize {
  let best: GalleryTileSize = "m";
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const [size, preset] of Object.entries(TILE_SIZE_PRESETS) as [
    GalleryTileSize,
    { colSpan: number; rowSpan: number },
  ][]) {
    const diff =
      Math.abs(preset.colSpan - colSpan) + Math.abs(preset.rowSpan - rowSpan);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = size;
    }
  }

  return best;
}

function withInferredSize(items: GalleryLayoutItem[], itemId: string) {
  return items.map((entry) =>
    entry.id === itemId
      ? {
          ...entry,
          size: inferSizeFromSpans(entry.colSpan, entry.rowSpan),
        }
      : entry
  );
}

function initHistory(
  items: GalleryLayoutItem[],
  gridType: GalleryGridType,
  label: string
) {
  return {
    history: [createSnapshot(items, gridType, label)],
    historyIndex: 0,
    sceneCounter: 1,
  };
}

export const useGalleryBuilderStore = create<GalleryBuilderState>((set, get) => {
  const commitLayoutChange = (
    items: GalleryLayoutItem[],
    gridType: GalleryGridType,
    label: string,
    extra?: Partial<GalleryBuilderState>
  ) => {
    const state = get();
    const truncated = state.history.slice(0, state.historyIndex + 1);
    truncated.push(createSnapshot(items, gridType, label));
    const history =
      truncated.length > MAX_HISTORY
        ? truncated.slice(truncated.length - MAX_HISTORY)
        : truncated;

    set({
      items,
      gridType,
      history,
      historyIndex: history.length - 1,
      isDirty: true,
      ...extra,
    });
  };

  return {
    categorySlug: "",
    categoryPhotos: [],
    items: [],
    gridType: "custom",
    status: "draft",
    selectedId: null,
    isDirty: false,
    isSaving: false,
    showPreview: false,
    history: [],
    historyIndex: -1,
    sceneCounter: 0,

    setCategory: (slug) => set({ categorySlug: slug }),

    loadLayout: (slug, layout, photos) => {
      const categoryPhotos = photos
        .filter((photo) => photo.category === slug)
        .sort((a, b) => a.order - b.order);

      if (!categoryPhotos.length) {
        set({
          categorySlug: slug,
          categoryPhotos: [],
          items: [],
          gridType: "custom",
          status: "draft",
          selectedId: null,
          isDirty: false,
          ...initHistory([], "custom", "Empty category"),
        });
        return;
      }

      const migrated = layout?.items?.length ? migrateLegacyLayout(layout) : null;
      const gridType = migrated?.gridType ?? "custom";
      const existingItems = migrated?.items ?? [];
      const placedIds = new Set(existingItems.map((item) => item.imageId));
      const missingPhotos = categoryPhotos.filter((photo) => !placedIds.has(photo.id));
      const shouldArrange = existingItems.length === 0 || missingPhotos.length > 0;

      const items = buildCategoryGridLayout(
        categoryPhotos,
        existingItems,
        gridType,
        EDITOR_GRID_COLUMNS,
        { rearrange: shouldArrange, seed: 1 }
      );

      set({
        categorySlug: slug,
        categoryPhotos,
        items,
        gridType,
        status: migrated?.status ?? "draft",
        selectedId: null,
        isDirty: false,
        ...initHistory(
          items,
          gridType,
          shouldArrange ? "Auto-placed all photos" : "Loaded layout"
        ),
      });
    },

    selectItem: (id) => set({ selectedId: id }),

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    undo: () => {
      const { history, historyIndex } = get();
      if (historyIndex <= 0) return;
      const nextIndex = historyIndex - 1;
      const snapshot = history[nextIndex];
      set({
        historyIndex: nextIndex,
        items: cloneItems(snapshot.items),
        gridType: snapshot.gridType,
        isDirty: true,
      });
    },

    redo: () => {
      const { history, historyIndex } = get();
      if (historyIndex >= history.length - 1) return;
      const nextIndex = historyIndex + 1;
      const snapshot = history[nextIndex];
      set({
        historyIndex: nextIndex,
        items: cloneItems(snapshot.items),
        gridType: snapshot.gridType,
        isDirty: true,
      });
    },

    reorderItems: (activeId, overId) => {
      if (activeId === overId) return;
      const sorted = sortByOrder(get().items);
      const oldIndex = sorted.findIndex((item) => item.id === activeId);
      const newIndex = sorted.findIndex((item) => item.id === overId);
      if (oldIndex < 0 || newIndex < 0) return;

      const next = [...sorted];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);

      commitLayoutChange(
        packItems(
          next.map((item, index) => ({ ...item, order: index })),
          EDITOR_GRID_COLUMNS
        ),
        get().gridType,
        "Reordered photos"
      );
    },

    setSizePreset: (itemId, size) => {
      const preset = TILE_SIZE_PRESETS[size];
      const item = get().items.find((entry) => entry.id === itemId);
      if (!item) return;
      commitLayoutChange(
        resizeItem(
          get().items.map((entry) =>
            entry.id === itemId
              ? normalizeLayoutItem({
                  ...entry,
                  size,
                  colSpan: preset.colSpan,
                  rowSpan: preset.rowSpan,
                })
              : entry
          ),
          itemId,
          preset.colSpan,
          preset.rowSpan,
          EDITOR_GRID_COLUMNS
        ),
        get().gridType,
        `Size: ${preset.label}`
      );
    },

    growItem: (itemId) => {
      const item = get().items.find((entry) => entry.id === itemId);
      if (!item) return;
      const resized = resizeItem(
        get().items,
        itemId,
        Math.min(EDITOR_GRID_COLUMNS, item.colSpan + 1),
        item.rowSpan + 1,
        EDITOR_GRID_COLUMNS
      );
      commitLayoutChange(
        withInferredSize(resized, itemId),
        get().gridType,
        "Made larger"
      );
    },

    shrinkItem: (itemId) => {
      const item = get().items.find((entry) => entry.id === itemId);
      if (!item) return;
      const resized = resizeItem(
        get().items,
        itemId,
        Math.max(1, item.colSpan - 1),
        Math.max(1, item.rowSpan - 1),
        EDITOR_GRID_COLUMNS
      );
      commitLayoutChange(
        withInferredSize(resized, itemId),
        get().gridType,
        "Made smaller"
      );
    },

    setGridTypeAndArrange: (gridType) => {
      const { items, categoryPhotos, sceneCounter } = get();
      const synced = syncItemsWithCategoryPhotos(items, categoryPhotos, gridType);
      if (!synced.length) {
        set({ gridType, isDirty: true });
        return;
      }
      const nextScene = sceneCounter + 1;
      const arranged = runGalleryAutoArrange(synced, gridType, EDITOR_GRID_COLUMNS, {
        seed: nextScene,
        varyGrid: false,
      });
      commitLayoutChange(
        arranged,
        gridType,
        `Scene ${nextScene}: ${GRID_TYPE_LABELS[gridType]}`,
        { sceneCounter: nextScene }
      );
    },

    applyAutoArrange: () => {
      const { items, categoryPhotos, gridType, sceneCounter } = get();
      const synced = syncItemsWithCategoryPhotos(items, categoryPhotos, gridType);
      if (!synced.length) return;
      const nextScene = sceneCounter + 1;
      const sceneGridType = pickSceneGridType(gridType, nextScene, true);
      const arranged = runGalleryAutoArrange(synced, gridType, EDITOR_GRID_COLUMNS, {
        seed: nextScene,
        varyGrid: true,
      });
      commitLayoutChange(
        arranged,
        gridType,
        `Scene ${nextScene}: ${GRID_TYPE_LABELS[sceneGridType]}`,
        { sceneCounter: nextScene }
      );
    },

    addPhoto: (photo) => {
      const exists = get().items.some((item) => item.imageId === photo.id);
      if (exists) {
        set({
          selectedId:
            get().items.find((item) => item.imageId === photo.id)?.id ?? null,
        });
        return;
      }
      const size = "m";
      const preset = TILE_SIZE_PRESETS[size];
      const newItem = normalizeLayoutItem({
        id: randomUUID(),
        imageId: photo.id,
        size,
        colSpan: preset.colSpan,
        rowSpan: preset.rowSpan,
        x: 1,
        y: 1,
        order: get().items.length,
        alt: photo.alt,
      });
      commitLayoutChange(
        packItems([...get().items, newItem], EDITOR_GRID_COLUMNS),
        get().gridType,
        "Added photo",
        { selectedId: newItem.id }
      );
    },

    removeItem: (itemId) => {
      commitLayoutChange(
        packItems(
          get()
            .items.filter((item) => item.id !== itemId)
            .map((item, index) => ({ ...item, order: index })),
          EDITOR_GRID_COLUMNS
        ),
        get().gridType,
        "Removed photo",
        {
          selectedId: get().selectedId === itemId ? null : get().selectedId,
        }
      );
    },

    togglePin: (itemId) => {
      commitLayoutChange(
        get().items.map((item) =>
          item.id === itemId ? { ...item, pinned: !item.pinned } : item
        ),
        get().gridType,
        "Toggled pin"
      );
    },

    toggleHidden: (itemId) => {
      commitLayoutChange(
        get().items.map((item) => {
          if (item.id !== itemId) return item;
          const hidden = !item.hidden;
          return {
            ...item,
            hidden,
            cover: hidden ? false : item.cover,
            hero: hidden ? false : item.hero,
          };
        }),
        get().gridType,
        "Toggled visibility"
      );
    },

    setCover: (itemId) => {
      const items = get().items;
      const target = items.find((item) => item.id === itemId);
      if (!target) return;

      if (target.cover) {
        commitLayoutChange(
          items.map((item) =>
            item.id === itemId ? { ...item, cover: false, hero: false } : item
          ),
          get().gridType,
          "Removed cover"
        );
        return;
      }

      const others = items
        .filter((item) => item.id !== itemId)
        .sort((a, b) => a.order - b.order);

      const reordered = [
        {
          ...target,
          cover: true,
          hero: true,
          featured: true,
          order: 0,
        },
        ...others.map((item, index) => ({
          ...item,
          cover: false,
          hero: false,
          order: index + 1,
        })),
      ];

      commitLayoutChange(
        packItems(reordered, EDITOR_GRID_COLUMNS),
        get().gridType,
        "Set cover photo"
      );
    },

    togglePreview: () => set({ showPreview: !get().showPreview }),

    markSaved: (status) => set({ status, isDirty: false, isSaving: false }),

    setSaving: (saving) => set({ isSaving: saving }),

    buildLayout: () => {
      const { categorySlug, items, gridType, status } = get();
      const packed = packItems(items, EDITOR_GRID_COLUMNS);
      return {
        categorySlug,
        gridType,
        status,
        items: packed,
        viewports: buildLayoutViewports(packed),
        versions: [],
        updatedAt: new Date().toISOString(),
      };
    },
  };
});
