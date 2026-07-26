"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";

interface PrimaryNavPillProps {
  compact?: boolean;
  className?: string;
}

const PrimaryNavPill = forwardRef<HTMLElement, PrimaryNavPillProps>(
  ({ compact = false, className }, ref) => {
    const pathname = usePathname();

    return (
      <nav
        ref={ref}
        className={cn(
          "glass-dark relative overflow-hidden rounded-full border border-white/10",
          "shadow-[0_22px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl",
          compact ? "px-2 py-1.5" : "px-3 py-2",
          className
        )}
        aria-label="Main navigation"
      >
        <ul className="flex items-center justify-between gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.id} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    "block rounded-full text-center font-light uppercase transition-all duration-500",
                    compact
                      ? "px-3 py-2 text-[9px] tracking-[0.22em] md:text-[10px]"
                      : "px-4 py-3 text-[10px] tracking-[0.24em] md:text-[11px]",
                    isActive
                      ? "bg-gold/14 text-gold shadow-[inset_0_0_0_1px_rgba(200,169,106,0.26),0_0_24px_rgba(200,169,106,0.08)]"
                      : "text-soft-white/58 hover:bg-white/6 hover:text-soft-white"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
);

PrimaryNavPill.displayName = "PrimaryNavPill";
export default PrimaryNavPill;
