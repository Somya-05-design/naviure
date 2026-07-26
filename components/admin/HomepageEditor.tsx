"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettings } from "@/app/actions/admin";
import FileUploader from "@/components/admin/FileUploader";
import MagneticButton from "@/components/ui/MagneticButton";
import type { SiteSettings } from "@/types";

export default function HomepageEditor({ settings }: { settings: SiteSettings }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSave = () => {
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        await saveSettings(form);
        setMessage("Saved successfully");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-soft-white font-light mb-8">Homepage</h1>

      <div className="space-y-8 max-w-2xl">
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-soft-white/40 mb-2 block">
            Intro Video
          </label>
          <p className="text-sm text-soft-white/60 mb-4">Current: {form.introVideo}</p>
          <FileUploader
            folder="videos"
            accept="video/*"
            label="Replace Intro Video"
            onUploadComplete={(url) => setForm({ ...form, introVideo: url })}
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-soft-white/40 mb-2 block">
            Hero Image
          </label>
          <p className="text-sm text-soft-white/60 mb-4">Current: {form.heroImage}</p>
          <FileUploader
            folder="images"
            accept="image/*"
            label="Replace Hero Image"
            onUploadComplete={(url) => setForm({ ...form, heroImage: url })}
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-soft-white/40 mb-2 block">
            Animations
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.animationsEnabled}
              onChange={(e) => setForm({ ...form, animationsEnabled: e.target.checked })}
              className="accent-emerald"
            />
            <span className="text-sm text-soft-white/60">Enable homepage animations</span>
          </label>
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
