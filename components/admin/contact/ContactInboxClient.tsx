"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import AdminCard from "@/components/admin/shared/AdminCard";
import type { ContactMessage } from "@/types/cms";
import type { SiteSettings } from "@/types";
import ContactEditor from "@/components/admin/ContactEditor";
import { persistContactMessageStatus } from "@/app/actions/cms";

export default function ContactInboxClient({
  messages,
  settings,
}: {
  messages: ContactMessage[];
  settings: SiteSettings;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"inbox" | "settings">("inbox");
  const [filter, setFilter] = useState<"all" | ContactMessage["status"]>("all");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const visible = messages.filter(
    (message) => filter === "all" || message.status === filter
  );

  const setStatus = (id: string, status: ContactMessage["status"]) => {
    setError("");
    startTransition(async () => {
      try {
        await persistContactMessageStatus(id, status);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      }
    });
  };

  return (
    <div>
      <AdminPageHeader
        title="Contact"
        description="Inbox for client messages and contact page configuration."
      />

      <div className="mb-6 flex gap-2">
        {(["inbox", "settings"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em] ${
              tab === key
                ? "bg-emerald/20 text-gold"
                : "bg-white/[0.04] text-soft-white/45"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {tab === "inbox" ? (
        <AdminCard>
          <div className="mb-4 flex flex-wrap gap-2">
            {(["all", "inbox", "replied", "archived"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] ${
                  filter === key
                    ? "bg-emerald/20 text-gold"
                    : "bg-white/[0.04] text-soft-white/45"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
          {error && <p className="mb-3 text-xs text-red-300/90">{error}</p>}
          {visible.length === 0 ? (
            <p className="text-sm text-soft-white/45">
              {messages.length === 0
                ? "Inbox is empty. Messages submitted via the contact form will appear here."
                : "No messages match this filter."}
            </p>
          ) : (
            <div className="space-y-3">
              {visible.map((message) => (
                <div
                  key={message.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-soft-white">{message.name}</p>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-gold/70">
                      {message.status}
                    </span>
                  </div>
                  <p className="text-xs text-soft-white/35">{message.email}</p>
                  {message.subject && (
                    <p className="mt-1 text-xs text-soft-white/50">{message.subject}</p>
                  )}
                  <p className="mt-2 text-sm text-soft-white/70">{message.message}</p>
                  <p className="mt-2 text-[10px] text-soft-white/30">
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {message.status !== "replied" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => setStatus(message.id, "replied")}
                        className="text-[10px] uppercase tracking-[0.18em] text-gold/80 hover:text-gold disabled:opacity-40"
                      >
                        Mark replied
                      </button>
                    )}
                    {message.status !== "archived" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => setStatus(message.id, "archived")}
                        className="text-[10px] uppercase tracking-[0.18em] text-soft-white/45 hover:text-soft-white disabled:opacity-40"
                      >
                        Archive
                      </button>
                    )}
                    {message.status !== "inbox" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => setStatus(message.id, "inbox")}
                        className="text-[10px] uppercase tracking-[0.18em] text-soft-white/45 hover:text-soft-white disabled:opacity-40"
                      >
                        Move to inbox
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      ) : (
        <ContactEditor settings={settings} />
      )}
    </div>
  );
}
