"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Images,
  Image,
  FolderOpen,
  Sparkles,
  Clapperboard,
  Home,
  FileText,
  Mail,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COLLAPSED_W = 70;
const EXPANDED_W = 240;

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/library", label: "Library", icon: Images },
      { href: "/admin/projects", label: "Projects", icon: Briefcase },
      { href: "/admin/categories", label: "Categories", icon: FolderOpen },
      { href: "/admin/photos", label: "Media", icon: Image },
      { href: "/admin/activity", label: "Activity", icon: FileText },
      { href: "/admin/gallery-builder", label: "Gallery Builder", icon: Sparkles },
      { href: "/admin/video-builder", label: "Video Builder", icon: Clapperboard },
    ],
  },
  {
    label: "Website",
    items: [
      { href: "/admin/homepage", label: "Homepage", icon: Home },
      { href: "/admin/about", label: "About", icon: FileText },
      { href: "/admin/contact", label: "Contact", icon: Mail },
    ],
  },
] as const;

const SETTINGS_ITEM = {
  href: "/admin/settings",
  label: "Settings",
  icon: Settings,
};

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  hoverExpanded: boolean;
  onHoverChange: (value: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarInnerProps {
  pathname: string;
  showLabels: boolean;
  showDesktopToggle: boolean;
  showMobileClose: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onMobileClose: () => void;
}

function SidebarInner({
  pathname,
  showLabels,
  showDesktopToggle,
  showMobileClose,
  collapsed,
  onToggle,
  onMobileClose,
}: SidebarInnerProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-4">
        <div className={cn("min-w-0 overflow-hidden", !showLabels && "mx-auto")}>
          {showLabels ? (
            <div>
              <p className="font-display text-[15px] tracking-[0.12em] text-soft-white">
                NAVIURE
              </p>
              <p className="mt-0.5 text-[9px] uppercase tracking-[0.28em] text-gold/55">
                Photography CMS
              </p>
            </div>
          ) : (
            <p className="font-display text-sm tracking-[0.14em] text-soft-white">N</p>
          )}
        </div>

        {showDesktopToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-soft-white/45 transition hover:border-gold/30 hover:text-gold"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}

        {showMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-soft-white/45 transition hover:border-gold/30 hover:text-gold"
            aria-label="Close menu"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.label} className={cn(groupIndex > 0 && "mt-4")}>
            {showLabels && (
              <p className="mb-1.5 px-2 text-[9px] uppercase tracking-[0.26em] text-soft-white/28">
                {group.label}
              </p>
            )}
            {!showLabels && groupIndex > 0 && (
              <div className="mx-auto mb-2 h-px w-6 bg-white/[0.06]" />
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onMobileClose}
                      title={!showLabels ? item.label : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-[13px] transition-all duration-200",
                        !showLabels && "justify-center px-0",
                        active
                          ? "bg-emerald/10 text-soft-white ring-1 ring-inset ring-gold/30"
                          : "text-soft-white/50 hover:bg-white/[0.04] hover:text-soft-white/85"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-full bg-gold" />
                      )}
                      <Icon
                        size={16}
                        strokeWidth={1.75}
                        className={cn(
                          "shrink-0",
                          active ? "text-gold" : "text-soft-white/40 group-hover:text-soft-white/65"
                        )}
                      />
                      {showLabels && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.06] p-2">
        {(() => {
          const Icon = SETTINGS_ITEM.icon;
          const active = isActive(pathname, SETTINGS_ITEM.href);
          return (
            <Link
              href={SETTINGS_ITEM.href}
              onClick={onMobileClose}
              title={!showLabels ? SETTINGS_ITEM.label : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-[13px] transition-all duration-200",
                !showLabels && "justify-center px-0",
                active
                  ? "bg-emerald/10 text-soft-white ring-1 ring-inset ring-gold/30"
                  : "text-soft-white/50 hover:bg-white/[0.04] hover:text-soft-white/85"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-full bg-gold" />
              )}
              <Icon
                size={16}
                strokeWidth={1.75}
                className={cn(
                  "shrink-0",
                  active ? "text-gold" : "text-soft-white/40 group-hover:text-soft-white/65"
                )}
              />
              {showLabels && <span>{SETTINGS_ITEM.label}</span>}
            </Link>
          );
        })()}
      </div>
    </>
  );
}

export default function AdminSidebar({
  collapsed,
  onToggle,
  hoverExpanded,
  onHoverChange,
  mobileOpen,
  onMobileClose,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Hydration-safe mount flag — must be set post-mount, not during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const showLabels = !collapsed || hoverExpanded;
  const width = showLabels ? EXPANDED_W : COLLAPSED_W;

  return (
    <>
      {/* Mobile overlay — client only to avoid SSR/client branch mismatch */}
      {mounted && mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Desktop / tablet sidebar — stable SSR output */}
      <aside
        style={{ width }}
        onMouseEnter={() => collapsed && onHoverChange(true)}
        onMouseLeave={() => onHoverChange(false)}
        className={cn(
          "relative z-50 hidden min-h-screen shrink-0 flex-col overflow-hidden",
          "border-r border-white/[0.06] bg-[#050807]/98 backdrop-blur-xl",
          "transition-[width] duration-200 ease-out md:flex"
        )}
      >
        <SidebarInner
          pathname={pathname}
          showLabels={showLabels}
          showDesktopToggle={showLabels}
          showMobileClose={false}
          collapsed={collapsed}
          onToggle={onToggle}
          onMobileClose={onMobileClose}
        />
      </aside>

      {/* Mobile drawer — client only */}
      {mounted && (
        <aside
          aria-hidden={!mobileOpen}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-white/[0.06]",
            "bg-[#050807] shadow-[24px_0_64px_rgba(0,0,0,0.5)] transition-transform duration-200 ease-out md:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
          )}
        >
          <SidebarInner
            pathname={pathname}
            showLabels
            showDesktopToggle={false}
            showMobileClose
            collapsed={false}
            onToggle={onToggle}
            onMobileClose={onMobileClose}
          />
        </aside>
      )}
    </>
  );
}

export { COLLAPSED_W, EXPANDED_W };
