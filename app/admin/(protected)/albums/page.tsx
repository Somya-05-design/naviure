import { redirect } from "next/navigation";

/** Albums live under Projects in the Library drill-down. */
export default function AdminAlbumsRedirectPage() {
  redirect("/admin/library");
}
