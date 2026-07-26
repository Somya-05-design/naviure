import type { MetadataRoute } from "next";
import { getAssetUrl } from "@/lib/assets";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NAVIURE — Luxury Photography",
    short_name: "NAVIURE",
    description:
      "Premium luxury photography by Naviure. Wedding, portrait, and cinematic visual storytelling.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0A0A",
    theme_color: "#2D8659",
    icons: [
      {
        src: getAssetUrl("logo-white"),
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: getAssetUrl("apple-touch-icon"),
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
