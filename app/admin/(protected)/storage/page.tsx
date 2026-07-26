import { getStorageProvider } from "@/lib/storage";
import StoragePageClient from "@/components/admin/StoragePageClient";

export default function AdminStoragePage() {
  const provider = getStorageProvider();
  return <StoragePageClient provider={provider} />;
}
