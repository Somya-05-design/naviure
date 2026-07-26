"use client";

import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import LibraryBreadcrumb from "@/components/admin/library/LibraryBreadcrumb";
import PhotoManager from "@/components/admin/photos/PhotoManager";
import type { CategoryCMS } from "@/types/cms";
import type { ProjectRecord, AlbumRecord, AlbumStats } from "@/lib/db/schema";
import type { GalleryImage, GalleryVideo } from "@/types";
import type { ImageMetadata } from "@/types/cms";

export default function AlbumMediaManager({
  category,
  project,
  album,
  photos,
  videos,
  metadataMap,
  stats,
}: {
  category: CategoryCMS;
  project: ProjectRecord;
  album: AlbumRecord;
  photos: GalleryImage[];
  videos: GalleryVideo[];
  metadataMap: Record<string, ImageMetadata>;
  stats?: AlbumStats;
}) {
  return (
    <div>
      <AdminPageHeader
        title={album.name}
        description={`${category.name} · ${project.name} · ${stats?.photoCount ?? 0} photos · ${stats?.videoCount ?? 0} videos`}
      />
      <LibraryBreadcrumb
        items={[
          { label: "Library", href: "/admin/library" },
          { label: category.name, href: `/admin/library/${category.slug}` },
          {
            label: project.name,
            href: `/admin/library/${category.slug}/${project.slug}`,
          },
          { label: album.name },
        ]}
      />
      <PhotoManager
        photos={photos}
        videos={videos}
        categories={[category]}
        albums={[
          {
            id: album.id,
            categorySlug: category.slug,
            projectId: project.id,
            projectSlug: project.slug,
            slug: album.slug,
            name: album.name,
            description: album.description,
            coverImage: album.coverImage,
            order: album.order,
            featured: album.featured,
            published: album.published,
            hidden: album.hidden,
            seoTitle: album.seoTitle,
            seoDescription: album.seoDescription,
            createdAt: album.createdAt,
            updatedAt: album.updatedAt,
          },
        ]}
        projects={[
          {
            id: project.id,
            categoryId: project.categoryId,
            categorySlug: project.categorySlug,
            slug: project.slug,
            name: project.name,
            clientName: project.clientName,
            clientPhone: project.clientPhone,
            clientEmail: project.clientEmail,
            eventDate: project.eventDate,
            shootDate: project.shootDate,
            deliveryDate: project.deliveryDate,
            location: project.location,
            status: project.status,
            description: project.description,
            coverImage: project.coverImage,
            order: project.order,
            featured: project.featured,
            hidden: project.hidden,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          },
        ]}
        metadataMap={metadataMap}
        lockedHierarchy={{
          categorySlug: category.slug,
          projectSlug: project.slug,
          albumSlug: album.slug,
        }}
        hideHeader
      />
    </div>
  );
}
