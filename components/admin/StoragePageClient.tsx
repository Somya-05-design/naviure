"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { backupData, restoreData } from "@/app/actions/admin";
import MagneticButton from "@/components/ui/MagneticButton";

export default function StoragePageClient({ provider }: { provider: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleExport = () => {
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        const data = await backupData();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `naviure-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage("Backup downloaded.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed");
      }
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage("");
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      startTransition(async () => {
        try {
          const data = JSON.parse(String(reader.result));
          await restoreData(data);
          setMessage("Backup restored. Site content refreshed.");
          router.refresh();
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Import failed — invalid backup file"
          );
        }
      });
    };
    reader.onerror = () => setError("Could not read backup file.");
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-soft-white font-light mb-8">Storage</h1>

      <div className="glass rounded-sm p-6 mb-8 max-w-2xl">
        <p className="text-sm text-soft-white/60 mb-2">Current Provider</p>
        <p className="text-lg text-emerald uppercase tracking-wider">{provider}</p>
        <p className="text-xs text-soft-white/30 mt-2">
          Switch to Cloudflare R2 by setting STORAGE_PROVIDER=r2 in environment variables.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <MagneticButton onClick={handleExport} disabled={isPending}>
          {isPending ? "Working..." : "Export Backup"}
        </MagneticButton>
        <label className="cursor-pointer">
          <span className="inline-flex items-center justify-center px-8 py-3 text-sm tracking-[0.2em] uppercase bg-transparent text-soft-white border border-white/20 hover:border-emerald/50 transition-colors">
            Import Backup
          </span>
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            disabled={isPending}
          />
        </label>
      </div>

      {message && <p className="mt-4 text-sm text-emerald">{message}</p>}
      {error && <p className="mt-4 text-sm text-red-300/90">{error}</p>}
    </div>
  );
}
