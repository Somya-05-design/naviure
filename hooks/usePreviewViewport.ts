"use client";

import { useEffect, useState } from "react";
import type { PreviewViewport } from "@/types/cms";
import { VIEWPORT_WIDTHS } from "@/types/cms";

export function usePreviewViewport(): PreviewViewport {
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      if (width < VIEWPORT_WIDTHS.mobile + 80) setViewport("mobile");
      else if (width < VIEWPORT_WIDTHS.tablet + 80) setViewport("tablet");
      else if (width < VIEWPORT_WIDTHS.laptop + 80) setViewport("laptop");
      else setViewport("desktop");
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return viewport;
}
