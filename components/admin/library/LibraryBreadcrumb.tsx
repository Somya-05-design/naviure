"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type LibraryCrumb = { label: string; href?: string };

export default function LibraryBreadcrumb({ items }: { items: LibraryCrumb[] }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-soft-white/40">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 && <ChevronRight size={12} className="text-soft-white/25" />}
          {item.href ? (
            <Link href={item.href} className="transition hover:text-gold">
              {item.label}
            </Link>
          ) : (
            <span className="text-gold/80">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
