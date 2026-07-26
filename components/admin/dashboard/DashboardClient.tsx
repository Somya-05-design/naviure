"use client";

import {
  Image,
  Video,
  FolderOpen,
  HardDrive,
  Briefcase,
  Calendar,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import AdminCard from "@/components/admin/shared/AdminCard";
import { formatDateTime, formatNumber } from "@/lib/format-date";
import type { CMSStats } from "@/types/cms";
import type { ActivityLogEntry } from "@/types/cms";
import type { ProjectRecord } from "@/lib/db/schema";

const statIcons = {
  photos: Image,
  videos: Video,
  projects: Briefcase,
  albums: FolderOpen,
  categories: FolderOpen,
  storage: HardDrive,
  visitors: Users,
  bookings: Calendar,
};

export default function DashboardClient({
  stats,
  uploads,
  activity,
  monthly,
  recentProjects = [],
}: {
  stats: CMSStats;
  uploads: Array<{
    id: string;
    src: string;
    alt: string;
    mediaType: "photo" | "video";
    createdAt: string;
  }>;
  activity: ActivityLogEntry[];
  monthly: { month: string; label: string; photos: number; videos: number; total: number }[];
  recentProjects?: ProjectRecord[];
}) {
  const cards = [
    { key: "projects", label: "Projects", value: stats.projects },
    { key: "albums", label: "Albums", value: stats.albums },
    { key: "photos", label: "Total Photos", value: stats.photos },
    { key: "videos", label: "Total Videos", value: stats.videos },
    {
      key: "storage",
      label: "Storage Used",
      value: `${stats.storageUsedMb} MB`,
    },
    { key: "categories", label: "Categories", value: stats.categories },
    { key: "visitors", label: "Visitors", value: formatNumber(stats.visitors) },
    { key: "bookings", label: "Bookings", value: stats.bookings },
    { key: "uploadsToday", label: "Uploads Today", value: stats.uploadsToday },
    {
      key: "uploadsMonth",
      label: "Uploads This Month",
      value: stats.uploadsThisMonth,
    },
  ] as const;

  const maxUpload = Math.max(...monthly.map((item) => item.total), 1);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ key, label, value }) => {
          const Icon = statIcons[key as keyof typeof statIcons] ?? Upload;
          return (
            <AdminCard key={key}>
              <Icon size={18} className="mb-4 text-gold/80" />
              <p className="font-display text-3xl font-light text-soft-white">
                {value}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-soft-white/40">
                {label}
              </p>
            </AdminCard>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <AdminCard className="xl:col-span-2">
          <h2 className="mb-6 text-lg font-light text-soft-white">
            Monthly Uploads
          </h2>
          <div className="flex h-48 items-end gap-3">
            {monthly.map((item) => (
              <div key={item.month} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full min-h-[4px] rounded-t-lg bg-gradient-to-t from-emerald/20 to-gold/35"
                  style={{
                    height: `${Math.max(4, (item.total / maxUpload) * 100)}%`,
                  }}
                  title={`${item.photos} photos · ${item.videos} videos`}
                />
                <span className="text-[10px] uppercase tracking-[0.2em] text-soft-white/35">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard>
          <h2 className="mb-4 text-lg font-light text-soft-white">
            Latest Activity
          </h2>
          <div className="space-y-3">
            {activity.slice(0, 6).map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                <p className="text-sm text-soft-white/80">{entry.action}</p>
                <p className="mt-1 text-[11px] text-soft-white/35">
                  {entry.entity} · {formatDateTime(entry.createdAt)}
                </p>
              </div>
            ))}
            {activity.length === 0 && (
              <p className="text-sm text-soft-white/40">No activity yet.</p>
            )}
          </div>
        </AdminCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AdminCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-light text-soft-white">Recent Projects</h2>
            <Link
              href="/admin/projects"
              className="text-[10px] uppercase tracking-[0.2em] text-gold/70 hover:text-gold"
            >
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {recentProjects.slice(0, 6).map((project) => (
              <Link
                key={project.id}
                href={`/admin/library/${project.categorySlug}/${project.slug}`}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition hover:border-gold/25"
              >
                <div>
                  <p className="text-sm text-soft-white/85">{project.name}</p>
                  <p className="mt-0.5 text-[11px] text-soft-white/35">
                    {project.clientName || project.categorySlug} ·{" "}
                    {project.status.replace("_", " ")}
                  </p>
                </div>
                <span className="text-[10px] text-soft-white/30">
                  {project.updatedAt.slice(0, 10)}
                </span>
              </Link>
            ))}
            {recentProjects.length === 0 && (
              <p className="text-sm text-soft-white/40">No projects yet.</p>
            )}
          </div>
        </AdminCard>

        <AdminCard>
          <h2 className="mb-4 text-lg font-light text-soft-white">Recent Uploads</h2>
          <div className="grid grid-cols-4 gap-2">
            {uploads.slice(0, 8).map((item) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={item.id}
                src={item.src}
                alt={item.alt}
                className="aspect-square rounded-lg object-cover"
              />
            ))}
            {uploads.length === 0 && (
              <p className="col-span-4 text-sm text-soft-white/40">No uploads yet.</p>
            )}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
