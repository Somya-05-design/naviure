"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAbout } from "@/app/actions/admin";
import MagneticButton from "@/components/ui/MagneticButton";
import type { AboutContent } from "@/types";

export default function AboutEditor({ content }: { content: AboutContent }) {
  const router = useRouter();
  const [form, setForm] = useState(content);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSave = () => {
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        await saveAbout(form);
        setMessage("Saved successfully");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-soft-white font-light mb-8">About Page</h1>
      <div className="space-y-6 max-w-2xl">
        {[
          { key: "name", label: "Name" },
          { key: "title", label: "Title" },
          { key: "heroSubtitle", label: "Hero Subtitle" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs uppercase tracking-[0.2em] text-soft-white/40 mb-2 block">{label}</label>
            <input
              value={form[key as keyof AboutContent] as string}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="w-full bg-transparent border-b border-white/10 py-3 text-soft-white focus:border-emerald focus:outline-none text-sm"
            />
          </div>
        ))}

        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-soft-white/40 mb-2 block">Story</label>
          <textarea
            value={form.story}
            onChange={(e) => setForm({ ...form, story: e.target.value })}
            rows={6}
            className="w-full bg-transparent border border-white/10 rounded-sm p-4 text-soft-white focus:border-emerald focus:outline-none text-sm resize-none"
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
