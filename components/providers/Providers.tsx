"use client";

import { useEffect } from "react";
import { AppProvider } from "@/hooks/useAppContext";
import { useLenis } from "@/hooks/useAnimations";
import PageTransition from "@/components/animations/PageTransition";

export default function Providers({ children }: { children: React.ReactNode }) {
  useLenis();

  useEffect(() => {
    document.documentElement.classList.add("lenis");
  }, []);

  return (
    <AppProvider>
      <PageTransition />
      {children}
    </AppProvider>
  );
}
