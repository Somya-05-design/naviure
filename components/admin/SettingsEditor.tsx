"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettings } from "@/app/actions/admin";
import MagneticButton from "@/components/ui/MagneticButton";
import type { SiteSettings } from "@/types";

export default function SettingsEditor({ settings }: { settings: SiteSettings }) {
  const [form, setForm] = useState({
    siteName: settings.siteName,
    tagline: settings.tagline,
    footerImage: settings.footerImage,
  });
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleSave = () => {
    startTransition(async () => {
      try {
        await saveSettings(form);
        setMessage("Saved successfully");
        router.refresh();
      } catch {
        setMessage("Save failed — please try again");
      }
    });
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-soft-white font-light mb-8">Settings</h1>
      <div className="space-y-6 max-w-2xl">
        {[
          { key: "siteName", label: "Site Name" },
          { key: "tagline", label: "Tagline" },
          { key: "footerImage", label: "Footer Image URL" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs uppercase tracking-[0.2em] text-soft-white/40 mb-2 block">{label}</label>
            <input
              value={form[key as keyof typeof form]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="w-full bg-transparent border-b border-white/10 py-3 text-soft-white focus:border-emerald focus:outline-none text-sm"
            />
          </div>
        ))}
        {message && <p className="text-sm text-emerald">{message}</p>}
        <MagneticButton onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save Changes"}
        </MagneticButton>
      </div>
    </div>
  );
}
