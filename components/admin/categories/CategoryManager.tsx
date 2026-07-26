"use client";

import { useMemo, useState, useTransition } from "react";
import { Reorder, motion, AnimatePresence } from "framer-motion";
import {
  GripVertical,
  Eye,
  EyeOff,
  Star,
  Trash2,
  Plus,
} from "lucide-react";
import AdminCard from "@/components/admin/shared/AdminCard";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import { persistCMSCategories } from "@/app/actions/cms";
import { randomUUID } from "@/lib/uuid";
import type { CategoryCMS } from "@/types/cms";
import type { CategoryStats } from "@/lib/db/schema";

function CategoryRow({
  category,
  selected,
  stats,
  onSelect,
  onChange,
  onDelete,
}: {
  category: CategoryCMS;
  selected: boolean;
  stats?: CategoryStats;
  onSelect: () => void;
  onChange: (next: CategoryCMS) => void;
  onDelete: () => void;
}) {
  return (
    <Reorder.Item
      value={category}
      className={`cursor-grab rounded-2xl border px-4 py-4 active:cursor-grabbing ${
        selected
          ? "border-gold/30 bg-gold/5"
          : "border-white/[0.08] bg-white/[0.02]"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <GripVertical size={16} className="mt-0.5 text-soft-white/30" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <p className="text-sm text-soft-white">{category.name}</p>
            {category.featured && <Star size={14} className="text-gold" />}
            {category.hidden && <EyeOff size={14} className="text-soft-white/35" />}
          </div>
          <p className="mt-1 text-xs text-soft-white/35">/{category.slug}</p>
          {stats && (
            <p className="mt-2 text-[10px] text-soft-white/40">
              {stats.projectCount ?? 0} projects · {stats.albumCount} albums ·{" "}
              {stats.photoCount} photos · {stats.videoCount} videos
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ ...category, hidden: !category.hidden });
            }}
            className="rounded-lg border border-white/10 p-2 text-soft-white/45 hover:text-gold"
          >
            {category.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ ...category, featured: !category.featured });
            }}
            className="rounded-lg border border-white/10 p-2 text-soft-white/45 hover:text-gold"
          >
            <Star size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-lg border border-white/10 p-2 text-soft-white/45 hover:text-red-300"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </Reorder.Item>
  );
}

export default function CategoryManager({
  initialCategories,
  statsMap = {},
}: {
  initialCategories: CategoryCMS[];
  statsMap?: Record<string, CategoryStats>;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [selectedId, setSelectedId] = useState(initialCategories[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(
    () => categories.find((item) => item.id === selectedId) ?? categories[0],
    [categories, selectedId]
  );

  const save = (next: CategoryCMS[]) => {
    setCategories(next);
    startTransition(async () => {
      await persistCMSCategories(next);
    });
  };

  const updateSelected = (patch: Partial<CategoryCMS>) => {
    if (!selected) return;
    save(
      categories.map((item) =>
        item.id === selected.id ? { ...item, ...patch } : item
      )
    );
  };

  const addCategory = () => {
    const created: CategoryCMS = {
      id: randomUUID(),
      slug: `category-${categories.length + 1}`,
      name: "New Category",
      description: "",
      coverImage: "",
      order: categories.length,
      featured: false,
      hidden: false,
      color: "#0F3D2E",
      seoTitle: "",
      seoDescription: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    save([...categories, created]);
    setSelectedId(created.id);
  };

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        description="Create, reorder, and configure portfolio categories with SEO, cover art, and visibility controls."
        actions={
          <button
            type="button"
            onClick={addCategory}
            className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-gold"
          >
            <Plus size={14} />
            New Category
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <AdminCard>
          <Reorder.Group
            axis="y"
            values={categories}
            onReorder={(next) =>
              save(next.map((item, index) => ({ ...item, order: index })))
            }
            className="space-y-3"
          >
            {categories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                stats={statsMap[category.id]}
                selected={category.id === selected?.id}
                onSelect={() => setSelectedId(category.id)}
                onChange={(next) =>
                  save(categories.map((item) => (item.id === next.id ? next : item)))
                }
                onDelete={() => {
                  if (
                    !window.confirm(
                      `Delete category "${category.name}"? Categories with projects cannot be deleted.`
                    )
                  ) {
                    return;
                  }
                  const previous = categories;
                  const next = categories.filter((item) => item.id !== category.id);
                  setCategories(next);
                  startTransition(async () => {
                    try {
                      await persistCMSCategories(next);
                    } catch (err) {
                      setCategories(previous);
                      window.alert(
                        err instanceof Error ? err.message : "Delete failed"
                      );
                    }
                  });
                }}
              />
            ))}
          </Reorder.Group>
        </AdminCard>

        <AnimatePresence mode="wait">
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <AdminCard className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(
                    [
                      ["Name", "name"],
                      ["Slug", "slug"],
                      ["Color", "color"],
                      ["Cover Image URL", "coverImage"],
                    ] as const
                  ).map(([label, key]) => (
                    <label key={key} className="block">
                      <span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
                        {label}
                      </span>
                      <input
                        value={selected[key]}
                        onChange={(e) => updateSelected({ [key]: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-soft-white outline-none focus:border-gold/35"
                      />
                    </label>
                  ))}
                </div>

                <label className="block">
                  <span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
                    Description
                  </span>
                  <textarea
                    rows={3}
                    value={selected.description}
                    onChange={(e) => updateSelected({ description: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-soft-white outline-none focus:border-gold/35"
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
                      SEO Title
                    </span>
                    <input
                      value={selected.seoTitle}
                      onChange={(e) => updateSelected({ seoTitle: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-soft-white outline-none focus:border-gold/35"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
                      SEO Description
                    </span>
                    <input
                      value={selected.seoDescription}
                      onChange={(e) =>
                        updateSelected({ seoDescription: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-soft-white outline-none focus:border-gold/35"
                    />
                  </label>
                </div>

                {selected.coverImage && (
                  <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selected.coverImage}
                      alt={selected.name}
                      className="aspect-[16/9] w-full object-cover"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-[11px] text-soft-white/45 md:grid-cols-4">
                  <div>
                    <p className="uppercase tracking-[0.18em]">Projects</p>
                    <p className="mt-1 text-lg text-soft-white">
                      {statsMap[selected.id]?.projectCount ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.18em]">Albums</p>
                    <p className="mt-1 text-lg text-soft-white">
                      {statsMap[selected.id]?.albumCount ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.18em]">Photos</p>
                    <p className="mt-1 text-lg text-soft-white">
                      {statsMap[selected.id]?.photoCount ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.18em]">Videos</p>
                    <p className="mt-1 text-lg text-soft-white">
                      {statsMap[selected.id]?.videoCount ?? 0}
                    </p>
                  </div>
                </div>

                {selected.createdAt && (
                  <p className="text-[11px] text-soft-white/35">
                    Created {new Date(selected.createdAt).toLocaleDateString("en-IN")}
                  </p>
                )}

                {isPending && (
                  <p className="text-xs uppercase tracking-[0.22em] text-gold/70">
                    Saving...
                  </p>
                )}
              </AdminCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
