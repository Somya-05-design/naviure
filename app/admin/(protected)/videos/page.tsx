import { redirect } from "next/navigation";

/** Prefer Library or Projects pages for the Category → Project → Album hierarchy. */
export default function AdminVideosPage() {
  redirect("/admin/photos");
}
