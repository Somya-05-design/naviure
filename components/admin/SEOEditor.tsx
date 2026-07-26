"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettings } from "@/app/actions/admin";
import MagneticButton from "@/components/ui/MagneticButton";
import type { SiteSettings } from "@/types";

export default function SEOEditor({ settings }: { settings: SiteSettings }) {
  const router = useRouter();
  const [seo, setSeo] = useState(settings.seo);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSave = () => {
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        await saveSettings({ seo });
        setMessage("Saved successfully");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-soft-white font-light mb-8">SEO Settings</h1>
      <div className="space-y-6 max-w-2xl">
        {[
          { key: "title", label: "Page Title" },
          { key: "description", label: "Meta Description" },
          { key: "ogImage", label: "OG Image URL" },
          { key: "twitterHandle", label: "Twitter Handle" },
          { key: "canonicalUrl", label: "Canonical URL" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs uppercase tracking-[0.2em] text-soft-white/40 mb-2 block">{label}</label>
            <input
              value={(seo[key as keyof typeof seo] as string) || ""}
              onChange={(e) => setSeo({ ...seo, [key]: e.target.value })}
              className="w-full bg-transparent border-b border-white/10 py-3 text-soft-white focus:border-emerald focus:outline-none text-sm"
            />
          </div>
        ))}
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-soft-white/40 mb-2 block">Keywords (comma separated)</label>
          <input
            value={seo.keywords.join(", ")}
            onChange={(e) =>
              setSeo({
                ...seo,
                keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
              })
            }
            className="w-full bg-transparent border-b border-white/10 py-3 text-soft-white focus:border-emerald focus:outline-none text-sm"
          />
        </div>
        {message && <p className="text-sm text-emerald">{message}</p>}
        {error && <p className="text-sm text-red-300/90">{error}</p>}
        <MagneticButton onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save Changes"}
        </MagneticButton>
      </div>
    </div>
  );
}
