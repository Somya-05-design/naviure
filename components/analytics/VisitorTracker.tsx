"use client";

import { useEffect } from "react";

const VISITOR_KEY = "naviure_visitor_counted";

export default function VisitorTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(VISITOR_KEY)) return;
    sessionStorage.setItem(VISITOR_KEY, "1");
    fetch("/api/analytics/visit", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
