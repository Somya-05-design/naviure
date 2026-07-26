import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import type { UploadResult, StorageProvider, StorageObjectInfo } from "@/types";

export interface StorageAdapter {
  upload(file: Buffer, key: string, mimeType: string): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  get(key: string): Promise<Buffer | null>;
  /** Verify the object exists and return ETag/size when available. */
  head(key: string): Promise<StorageObjectInfo>;
  getUrl(key: string): string;
  getSignedUploadUrl?(key: string, mimeType: string): Promise<string>;
}

export function computeChecksum(file: Buffer): string {
  return createHash("sha256").update(file).digest("hex");
}

function stripEtagQuotes(etag: string | undefined | null): string | null {
  if (!etag) return null;
  return etag.replace(/^"|"$/g, "");
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local (local) or your Vercel project settings (production).`
    );
  }
  return value;
}

class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor(basePath = "public") {
    this.basePath = basePath;
  }

  private resolvePath(key: string) {
    const root = path.join(
      /* turbopackIgnore: true */ process.cwd(),
      this.basePath
    );
    const resolved = path.resolve(root, key);
    // Guard against path traversal (e.g. keys containing "../").
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error(`Invalid storage key (path traversal): ${key}`);
    }
    return resolved;
  }

  async upload(file: Buffer, key: string, mimeType: string): Promise<UploadResult> {
    const checksum = computeChecksum(file);
    const filePath = this.resolvePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file);

    const verified = await this.head(key);
    if (!verified.exists) {
      throw new Error(`Upload verification failed: local file "${key}" was not found after write.`);
    }

    return {
      url: `/${key}`,
      key,
      size: file.length,
      mimeType,
      etag: verified.etag,
      checksum,
    };
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return;
      throw error;
    }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolvePath(key));
    } catch {
      return null;
    }
  }

  async head(key: string): Promise<StorageObjectInfo> {
    try {
      const stat = await fs.stat(this.resolvePath(key));
      if (!stat.isFile()) {
        return { exists: false, etag: null, size: null };
      }
      const buf = await fs.readFile(this.resolvePath(key));
      return {
        exists: true,
        etag: computeChecksum(buf),
        size: stat.size,
      };
    } catch {
      return { exists: false, etag: null, size: null };
    }
  }

  async list(prefix: string): Promise<string[]> {
    const dirPath = this.resolvePath(prefix);
    try {
      return await this.walkDir(dirPath, prefix);
    } catch {
      return [];
    }
  }

  private async walkDir(dir: string, prefix: string): Promise<string[]> {
    const results: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const key = path.join(prefix, entry.name).replace(/\\/g, "/");
        if (entry.isDirectory()) {
          results.push(...(await this.walkDir(fullPath, key)));
        } else if (this.isMediaFile(entry.name)) {
          results.push(key);
        }
      }
    } catch {
      // Directory doesn't exist
    }
    return results;
  }

  private isMediaFile(name: string): boolean {
    return /\.(jpg|jpeg|png|webp|avif|gif|mp4|webm|mov)$/i.test(name);
  }

  getUrl(key: string): string {
    return `/${key}`;
  }
}

class R2StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    const endpoint = requireEnv("R2_ENDPOINT");
    const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
    this.bucket = requireEnv("R2_BUCKET_NAME");
    this.publicUrl = requireEnv("R2_PUBLIC_URL").replace(/\/$/, "");

    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async upload(file: Buffer, key: string, mimeType: string): Promise<UploadResult> {
    const checksum = computeChecksum(file);
    const put = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: mimeType,
      })
    );

    const verified = await this.head(key);
    if (!verified.exists) {
      // Best-effort cleanup of a ghost put
      try {
        await this.delete(key);
      } catch {
        // ignore
      }
      throw new Error(
        `Upload verification failed: object "${key}" was not found in Cloudflare R2 after upload.`
      );
    }

    return {
      url: `${this.publicUrl}/${key}`,
      key,
      size: file.length,
      mimeType,
      etag: verified.etag ?? stripEtagQuotes(put.ETag),
      checksum,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      if (!response.Body) return null;
      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch {
      return null;
    }
  }

  async head(key: string): Promise<StorageObjectInfo> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return {
        exists: true,
        etag: stripEtagQuotes(response.ETag),
        size: response.ContentLength ?? null,
      };
    } catch {
      return { exists: false, etag: null, size: null };
    }
  }

  async list(prefix: string): Promise<string[]> {
    const response = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix })
    );
    return (response.Contents || []).map((obj) => obj.Key!).filter(Boolean);
  }

  getUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  async getSignedUploadUrl(key: string, mimeType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }
}

/** Resolve object key from a stored media URL (R2 public URL or local `/key`). */
export function extractStorageKey(url: string): string | null {
  if (!url) return null;

  const publicUrl = (
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL
  )?.replace(/\/$/, "");
  if (publicUrl && url.startsWith(`${publicUrl}/`)) {
    return decodeURIComponent(url.slice(publicUrl.length + 1));
  }

  if (url.startsWith("/") && !url.startsWith("//")) {
    return decodeURIComponent(url.slice(1));
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (
      host === "media.naviure.in" ||
      host.endsWith(".r2.dev") ||
      host.endsWith(".r2.cloudflarestorage.com") ||
      (publicUrl && host === new URL(publicUrl).hostname)
    ) {
      return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    }
  } catch {
    return null;
  }

  return null;
}

export function getStorageProvider(): StorageProvider {
  return process.env.STORAGE_PROVIDER === "r2" ? "r2" : "local";
}

export function createStorageAdapter(): StorageAdapter {
  const provider = getStorageProvider();
  if (provider === "r2") {
    return new R2StorageAdapter();
  }
  return new LocalStorageAdapter();
}

let _storage: StorageAdapter | null = null;

/** Lazily create the shared storage adapter (validates R2 env only when provider is r2). */
export function getStorage(): StorageAdapter {
  if (!_storage) {
    _storage = createStorageAdapter();
  }
  return _storage;
}

/** Shared storage facade — all uploads/deletes go through here. */
export const storage = {
  upload: (...args: Parameters<StorageAdapter["upload"]>) =>
    getStorage().upload(...args),
  delete: (...args: Parameters<StorageAdapter["delete"]>) =>
    getStorage().delete(...args),
  list: (...args: Parameters<StorageAdapter["list"]>) => getStorage().list(...args),
  get: (...args: Parameters<StorageAdapter["get"]>) => getStorage().get(...args),
  head: (...args: Parameters<StorageAdapter["head"]>) => getStorage().head(...args),
  getUrl: (...args: Parameters<StorageAdapter["getUrl"]>) => getStorage().getUrl(...args),
  getSignedUploadUrl: (key: string, mimeType: string) => {
    const adapter = getStorage();
    if (!adapter.getSignedUploadUrl) {
      throw new Error("Signed upload URLs are only available with STORAGE_PROVIDER=r2");
    }
    return adapter.getSignedUploadUrl(key, mimeType);
  },
};
