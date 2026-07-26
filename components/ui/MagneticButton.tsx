"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useMagnetic } from "@/hooks/useAnimations";
import { useRef } from "react";

interface MagneticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "glass";
  size?: "sm" | "md" | "lg";
  magnetic?: boolean;
}

const MagneticButton = forwardRef<HTMLButtonElement, MagneticButtonProps>(
  ({ className, variant = "primary", size = "md", magnetic = true, children, ...props }, ref) => {
    const innerRef = useRef<HTMLButtonElement>(null);
    useMagnetic(innerRef, magnetic ? 0.2 : 0);

    const setRef = (node: HTMLButtonElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    const variants = {
      primary:
        "bg-emerald text-soft-white hover:bg-forest border border-emerald/30 shadow-lg shadow-emerald/10",
      ghost:
        "bg-transparent text-soft-white border border-white/20 hover:border-emerald/50 hover:text-emerald",
      glass:
        "glass text-soft-white hover:bg-white/10 border border-white/10",
    };

    const sizes = {
      sm: "px-4 py-2 text-xs tracking-widest",
      md: "px-8 py-3 text-sm tracking-[0.2em]",
      lg: "px-12 py-4 text-sm tracking-[0.25em] uppercase",
    };

    return (
      <button
        ref={setRef}
        className={cn(
          "relative inline-flex items-center justify-center font-body font-light",
          "transition-colors duration-500 ease-out",
          "uppercase disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

MagneticButton.displayName = "MagneticButton";
export default MagneticButton;
