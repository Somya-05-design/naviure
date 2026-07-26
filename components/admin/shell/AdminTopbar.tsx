"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, Menu, Plus, Search } from "lucide-react";
import Link from "next/link";
import { searchAdmin } from "@/app/actions/admin";
import type { AdminSearchResult } from "@/types/cms";

interface AdminTopbarProps {
  userName?: string;
  onMenuOpen?: () => void;
}

export default function AdminTopbar({ userName, onMenuOpen }: AdminTopbarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const searchGeneration = useRef(0);

  useEffect(() => {
    if (!query.trim()) {
      // Debounced async search — effect is the correct synchronization point.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    const generation = ++searchGeneration.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const next = await searchAdmin(query);
        if (generation === searchGeneration.current) {
          setResults(next);
          setOpen(true);
        }
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/[0.06] bg-[#050807]/80 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onMenuOpen}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-soft-white/55 transition hover:border-gold/30 hover:text-gold md:hidden"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <div className="hidden sm:block">
          <p className="text-[10px] uppercase tracking-[0.28em] text-gold/55">
            Admin
          </p>
          <p className="mt-0.5 text-sm text-soft-white/70">
            Welcome back{userName ? `, ${userName}` : ""}
          </p>
        </div>

        <div className="relative min-w-0 max-w-md flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-soft-white/30"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search projects, clients, albums, media…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-soft-white outline-none focus:border-gold/35"
          />
          {open && query.trim() && (results.length > 0 || isPending || !isPending) && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-80 overflow-y-auto rounded-xl border border-white/[0.08] bg-[#0a0f0e] shadow-2xl">
              {isPending && results.length === 0 && (
                <p className="px-3 py-2 text-xs text-soft-white/40">Searching…</p>
              )}
              {!isPending && results.length === 0 && (
                <p className="px-3 py-2 text-xs text-soft-white/40">No results</p>
              )}
              {results.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.href}
                  className="block border-b border-white/[0.04] px-3 py-2.5 last:border-0 hover:bg-gold/[0.06]"
                >
                  <p className="text-sm text-soft-white/85">{item.title}</p>
                  <p className="text-[11px] text-soft-white/35">{item.subtitle}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-gold transition hover:bg-gold/15 sm:px-4 sm:py-2"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">New Project</span>
        </Link>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-soft-white/45 transition hover:border-gold/30 hover:text-gold"
          aria-label="Notifications"
        >
          <Bell size={16} />
        </button>
      </div>
    </header>
  );
}
