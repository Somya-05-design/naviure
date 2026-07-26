import { randomUUID } from "crypto";
import type { ActivityRecord } from "@/lib/db/schema";
import { readTable, writeTable } from "@/lib/db/client";

const FILE = "activity-logs.json";
const MAX = 200;

export async function listActivity(limit = 50): Promise<ActivityRecord[]> {
  const logs = await readTable<ActivityRecord[]>(FILE, []);
  return logs
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function logActivity(
  action: string,
  entity: string,
  entityId: string,
  user = "Admin"
): Promise<ActivityRecord> {
  const logs = await readTable<ActivityRecord[]>(FILE, []);
  const entry: ActivityRecord = {
    id: randomUUID(),
    action,
    entity,
    entityId,
    user,
    createdAt: new Date().toISOString(),
  };
  logs.unshift(entry);
  await writeTable(FILE, logs.slice(0, MAX));
  return entry;
}
