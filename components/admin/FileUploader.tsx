"use client";

import { useState, useTransition } from "react";
import { uploadFile } from "@/app/actions/admin";
import { Upload } from "lucide-react";

interface FileUploaderProps {
  folder?: string;
  accept?: string;
  label?: string;
  category?: string;
  projectSlug?: string;
  albumSlug?: string;
  mediaType?: "photo" | "video";
  onUploadComplete?: (url: string) => void;
}

export default function FileUploader({
  folder = "site",
  accept = "image/*",
  label = "Upload File",
  category,
  projectSlug = "general",
  albumSlug = "main",
  mediaType,
  onUploadComplete,
}: FileUploaderProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const resolvedMediaType: "photo" | "video" =
    mediaType ?? (accept.startsWith("video/") ? "video" : "photo");

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mediaType", resolvedMediaType);
    if (category) {
      formData.append("category", category);
      formData.append("projectSlug", projectSlug);
      formData.append("albumSlug", albumSlug);
    } else {
      formData.append("siteFolder", folder);
    }

    startTransition(async () => {
      try {
        const result = await uploadFile(formData);
        setMessage(`Uploaded: ${result.url}`);
        onUploadComplete?.(result.url);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Upload failed");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-6">
      <label className="flex cursor-pointer flex-col items-center gap-4">
        <Upload size={24} className="text-gold/80" />
        <span className="text-sm text-soft-white/60">{label}</span>
        <input
          type="file"
          accept={accept}
          onChange={handleUpload}
          className="hidden"
          disabled={isPending}
        />
        {isPending && <span className="text-xs text-gold/70">Uploading...</span>}
        {message && <span className="text-xs text-soft-white/40">{message}</span>}
      </label>
    </div>
  );
}
