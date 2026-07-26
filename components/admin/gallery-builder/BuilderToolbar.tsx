"use client";

import { useTransition } from "react";
import {
  LayoutGrid,
  Save,
  Globe,
  Eye,
  EyeOff,
  Wand2,
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GRID_TYPE_LABELS } from "@/types/cms";
import type { CategoryCMS, GalleryGridType } from "@/types/cms";

interface BuilderToolbarProps {
  categories: CategoryCMS[];
  categorySlug: string;
  gridType: GalleryGridType;
  status: "draft" | "published";
  isDirty: boolean;
  isSaving: boolean;
  showPreview: boolean;
  itemCount: number;
  canUndo: boolean;
  canRedo: boolean;
  historyLabel?: string;
  builderLabel?: string;
  onCategoryChange: (slug: string) => void;
  onGridTypeChange: (type: GalleryGridType) => void;
  onAutoArrange: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: (publish: boolean) => void;
  onTogglePreview: () => void;
}

export default function BuilderToolbar({
  categories,
  categorySlug,
  gridType,
  status,
  isDirty,
  isSaving,
  showPreview,
  itemCount,
  canUndo,
  canRedo,
  historyLabel,
  builderLabel = "Gallery Builder",
  onCategoryChange,
  onGridTypeChange,
  onAutoArrange,
  onUndo,
  onRedo,
  onSave,
  onTogglePreview,
}: BuilderToolbarProps) {
  const [, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <LayoutGrid size={16} className="text-gold/70" />
        <span className="text-sm text-soft-white">{builderLabel}</span>
        {isDirty && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
            Unsaved
          </span>
        )}
        {!isDirty && status === "published" && (
          <span className="rounded-full bg-emerald/15 px-2 py-0.5 text-[10px] text-emerald">
            Published
          </span>
        )}
      </div>

      <div className="h-6 w-px bg-white/10" />

      <select
        value={categorySlug}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="rounded-lg border border-white/[0.1] bg-[#0A1410] px-3 py-2 text-sm text-soft-white outline-none focus:border-gold/40"
      >
        <option value="">Select category</option>
        {categories.map((cat) => (
          <option key={cat.slug} value={cat.slug}>
            {cat.name}
          </option>
        ))}
      </select>

      <select
        value={gridType}
        onChange={(e) => onGridTypeChange(e.target.value as GalleryGridType)}
        className="rounded-lg border border-white/[0.1] bg-[#0A1410] px-3 py-2 text-sm text-soft-white outline-none focus:border-gold/40"
      >
        {Object.entries(GRID_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={itemCount === 0}
        onClick={onAutoArrange}
        className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-2 text-sm text-soft-white/70 transition-colors hover:border-gold/30 hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Wand2 size={14} />
        New Scene
      </button>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          title="Back (⌘Z)"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.1] text-soft-white/70 transition-colors hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          title="Forward (⌘⇧Z)"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.1] text-soft-white/70 transition-colors hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Redo2 size={15} />
        </button>
      </div>

      {historyLabel && (
        <span className="hidden text-[10px] uppercase tracking-[0.18em] text-soft-white/35 lg:inline">
          {historyLabel}
        </span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onTogglePreview}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
            showPreview
              ? "border-gold/30 bg-gold/10 text-gold"
              : "border-white/[0.1] text-soft-white/70 hover:border-white/25"
          )}
        >
          {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
          Preview
        </button>

        <button
          type="button"
          disabled={!categorySlug || isSaving}
          onClick={() => startTransition(() => onSave(false))}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-4 py-2 text-sm text-soft-white/80 transition-colors hover:border-white/25 disabled:opacity-40"
        >
          <Save size={14} />
          {isSaving ? "Saving…" : "Save Draft"}
        </button>

        <button
          type="button"
          disabled={!categorySlug || isSaving}
          onClick={() => startTransition(() => onSave(true))}
          className="flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-[#081A12] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Globe size={14} />
          Publish
        </button>
      </div>
    </div>
  );
}
