"use client";

import dynamic from "next/dynamic";

const CinematicIntro = dynamic(
  () => import("@/components/features/intro/CinematicIntro"),
  { ssr: false }
);

export default function IntroPage() {
  return <CinematicIntro />;
}
