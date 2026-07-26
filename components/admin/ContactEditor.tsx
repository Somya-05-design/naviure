"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettings } from "@/app/actions/admin";
import MagneticButton from "@/components/ui/MagneticButton";
import type { SiteSettings } from "@/types";

export default function ContactEditor({ settings }: { settings: SiteSettings }) {
  const router = useRouter();
  const [contact, setContact] = useState(settings.contact);
  const [social, setSocial] = useState(settings.social);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSave = () => {
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        await saveSettings({ contact, social });
        setMessage("Saved successfully");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  const contactFields = [
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "instagram", label: "Instagram URL" },
    { key: "address", label: "Address" },
  ] as const;

  const socialFields = [
    { key: "instagram", label: "Social Instagram" },
    { key: "whatsapp", label: "Social WhatsApp" },
    { key: "email", label: "Social Email" },
    { key: "phone", label: "Social Phone" },
  ] as const;

  return (
    <div>
      <h1 className="font-display text-3xl text-soft-white font-light mb-8">Contact</h1>
      <div className="space-y-6 max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
          Contact details
        </p>
        {contactFields.map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs uppercase tracking-[0.2em] text-soft-white/40 mb-2 block">{label}</label>
            <input
              value={contact[key] || ""}
              onChange={(e) => setContact({ ...contact, [key]: e.target.value })}
              className="w-full bg-transparent border-b border-white/10 py-3 text-soft-white focus:border-emerald focus:outline-none text-sm"
            />
          </div>
        ))}

        <p className="pt-4 text-[11px] uppercase tracking-[0.22em] text-soft-white/35">
          Social links
        </p>
        {socialFields.map(({ key, label }) => (
          <div key={`social-${key}`}>
            <label className="text-xs uppercase tracking-[0.2em] text-soft-white/40 mb-2 block">{label}</label>
            <input
              value={social[key] || ""}
              onChange={(e) => setSocial({ ...social, [key]: e.target.value })}
              className="w-full bg-transparent border-b border-white/10 py-3 text-soft-white focus:border-emerald focus:outline-none text-sm"
            />
          </div>
        ))}

        {message && <p className="text-sm text-emerald">{message}</p>}
        {error && <p className="text-sm text-red-300/90">{error}</p>}
        <MagneticButton onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save Changes"}
        </MagneticButton>
      </div>
    </div>
  );
}
