/**
 * Upload / register website assets on Cloudflare R2 (not gallery).
 *
 * Usage: npx --yes tsx scripts/upload-website-assets.ts
 */

import {
  createHash,
  randomUUID,
} from "crypto";
import {
  createReadStream,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { basename, extname, join } from "path";
import { finished } from "stream/promises";

type AssetRecord = {
  id: string;
  key: string;
  name: string;
  type: "image" | "video" | "icon" | "other";
  kind: string;
  storageKey: string;
  url: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  etag: string | null;
  checksum: string | null;
  localPath: string | null;
};

const ASSETS_PATH = join(process.cwd(), "data", "assets.json");
const ALL_DETAILS =
  "/Volumes/D /Divyansh Other/KTP/Naviure/All details";

function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) throw new Error(".env.local missing");
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(path);
  stream.on("data", (chunk) => hash.update(chunk));
  await finished(stream);
  return hash.digest("hex");
}

function mimeOf(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
  };
  return map[ext] || "application/octet-stream";
}

function typeOf(mime: string, kind: string): AssetRecord["type"] {
  if (mime.startsWith("video/")) return "video";
  if (kind === "icons" || kind === "favicons" || mime.includes("icon"))
    return "icon";
  if (mime.startsWith("image/")) return "image";
  return "other";
}

function titleOf(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
}

type Spec = {
  absPath: string;
  kind: string;
  key: string;
  filename: string;
  localPath: string | null;
};

function findAllDetailsFile(partial: string): string | null {
  if (!existsSync(ALL_DETAILS)) return null;
  const files = readdirSync(ALL_DETAILS);
  const hit = files.find((f) => f.includes(partial) || f.startsWith(partial));
  return hit ? join(ALL_DETAILS, hit) : null;
}

function buildSpecs(): Spec[] {
  const specs: Spec[] = [];
  const pub = join(process.cwd(), "public");

  const add = (
    abs: string | null,
    kind: string,
    key: string,
    filename: string,
    localPath: string | null
  ) => {
    if (!abs || !existsSync(abs)) return;
    specs.push({ absPath: abs, kind, key, filename, localPath });
  };

  add(join(pub, "images/logo-white.png"), "logos", "logo-white", "logo-white.png", "public/images/logo-white.png");
  add(join(pub, "images/logo-black.png"), "logos", "logo-black", "logo-black.png", "public/images/logo-black.png");
  add(join(pub, "images/hero-cinematic.jpg"), "hero", "hero-cinematic", "hero-cinematic.jpg", "public/images/hero-cinematic.jpg");
  add(join(pub, "images/footer-wedding.jpg"), "backgrounds", "footer-wedding", "footer-wedding.jpg", "public/images/footer-wedding.jpg");
  add(join(pub, "images/photographer.jpg"), "backgrounds", "photographer", "photographer.jpg", "public/images/photographer.jpg");
  add(join(pub, "images/instagram-qr.jpg"), "branding", "instagram-qr", "instagram-qr.jpg", "public/images/instagram-qr.jpg");
  add(join(pub, "videos/intro.mp4"), "hero", "intro", "intro.mp4", "public/videos/intro.mp4");
  add(join(pub, "videos/logo-reveal-intro.mp4"), "loaders", "logo-reveal-intro", "logo-reveal-intro.mp4", "public/videos/logo-reveal-intro.mp4");
  add(join(pub, "videos/logo-reveal-transition.mp4"), "loaders", "logo-reveal-transition", "logo-reveal-transition.mp4", "public/videos/logo-reveal-transition.mp4");
  add(join(pub, "videos/logo-reveal.mp4"), "loaders", "logo-reveal", "logo-reveal.mp4", "public/videos/logo-reveal.mp4");
  add(join(process.cwd(), "app/favicon.ico"), "favicons", "favicon", "favicon.ico", "app/favicon.ico");
  // apple-touch from white logo
  add(join(pub, "images/logo-white.png"), "favicons", "apple-touch-icon", "apple-touch-icon.png", "public/images/logo-white.png");

  // All details extras
  add(findAllDetailsFile("Logo_reveal_condensation_wipe_an…_202606221539"), "loaders", "logo-reveal-condensation-portrait", "logo-reveal-condensation-portrait.mp4", null);
  add(findAllDetailsFile("Logo_reveal_condensation_wipe_an…_202606251018"), "loaders", "logo-reveal-condensation-landscape", "logo-reveal-condensation-landscape.mp4", null);
  add(findAllDetailsFile("home page video"), "hero", "home-page-video", "home-page-video.mp4", null);
  add(findAllDetailsFile("work page intro"), "hero", "work-page-intro", "work-page-intro.mp4", null);
  add(findAllDetailsFile("scroll annimation"), "loaders", "scroll-animation", "scroll-animation.mp4", null);
  add(findAllDetailsFile("photo section annimation"), "loaders", "photo-section-animation", "photo-section-animation.mp4", null);
  add(findAllDetailsFile("hover annimation.png"), "misc", "hover-animation", "hover-animation.png", null);
  add(findAllDetailsFile("hover 3d"), "misc", "hover-3d-animation", "hover-3d-animation.png", null);
  add(findAllDetailsFile("color theme"), "branding", "color-theme", "color-theme.jpeg", null);
  add(findAllDetailsFile("Naviure Insta QR"), "branding", "instagram-qr-source", "instagram-qr-source.jpeg", null);
  add(findAllDetailsFile("Navine Photo"), "backgrounds", "photographer-source", "photographer-source.jpeg", null);

  return specs;
}

async function main() {
  loadEnvLocal();
  const { storage } = await import("../lib/storage/index");

  const existing: AssetRecord[] = existsSync(ASSETS_PATH)
    ? JSON.parse(readFileSync(ASSETS_PATH, "utf8"))
    : [];
  const byKey = new Map(existing.map((a) => [a.key || basename(a.storageKey), a]));

  // Migrate old records missing `key`
  for (const a of existing) {
    if (!(a as AssetRecord).key) {
      (a as AssetRecord).key = basename(a.storageKey)
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
    }
    if (!(a as AssetRecord).type) {
      (a as AssetRecord).type = typeOf(a.mimeType, a.kind);
    }
    byKey.set((a as AssetRecord).key, a as AssetRecord);
  }

  const log: string[] = [];
  const specs = buildSpecs();

  for (const spec of specs) {
    const storageKey = `assets/${spec.kind}/${spec.filename}`;
    const mime = mimeOf(spec.filename);
    const size = statSync(spec.absPath).size;
    const checksum = await sha256File(spec.absPath);

    const head = await storage.head(storageKey);
    let url = "";
    let etag: string | null = null;
    let uploadedAt = new Date().toISOString();

    if (head.exists) {
      if (head.size != null && head.size !== size) {
        log.push(
          `SKIP (exists, size differs — not overwritten): ${storageKey}`
        );
        // Still register metadata pointing at existing object
      }
      url = storage.getUrl(storageKey);
      etag = head.etag;
      log.push(`EXISTS: ${storageKey}`);
    } else {
      const result = await storage.upload(
        readFileSync(spec.absPath),
        storageKey,
        mime
      );
      const verified = await storage.head(storageKey);
      if (!verified.exists) {
        throw new Error(`HEAD failed after upload: ${storageKey}`);
      }
      url = result.url;
      etag = result.etag ?? verified.etag;
      uploadedAt = new Date().toISOString();
      log.push(`UPLOADED: ${spec.key} → ${storageKey}`);
    }

    const prev = byKey.get(spec.key);
    const record: AssetRecord = {
      id: prev?.id || randomUUID(),
      key: spec.key,
      name: titleOf(spec.filename),
      type: typeOf(mime, spec.kind),
      kind: spec.kind,
      storageKey,
      url,
      mimeType: mime,
      fileSize: head.exists ? head.size ?? size : size,
      uploadedAt: prev?.uploadedAt || uploadedAt,
      etag,
      checksum,
      localPath: spec.localPath,
    };
    byKey.set(spec.key, record);
  }

  // Prefer loaders paths for logo-reveal keys if both hero+loaders exist — keep loaders as canonical via key
  // Also keep hero/logo-reveal-* if already uploaded from prior phase: add alias records by reusing those URLs
  for (const [aliasKey, storageKey] of [
    ["logo-reveal-intro", "assets/hero/logo-reveal-intro.mp4"],
    ["logo-reveal-transition", "assets/hero/logo-reveal-transition.mp4"],
    ["logo-reveal", "assets/hero/logo-reveal.mp4"],
  ] as const) {
    if (byKey.has(aliasKey)) continue;
    const head = await storage.head(storageKey);
    if (!head.exists) continue;
    byKey.set(aliasKey, {
      id: randomUUID(),
      key: aliasKey,
      name: titleOf(basename(storageKey)),
      type: "video",
      kind: "hero",
      storageKey,
      url: storage.getUrl(storageKey),
      mimeType: "video/mp4",
      fileSize: head.size ?? 0,
      uploadedAt: new Date().toISOString(),
      etag: head.etag,
      checksum: null,
      localPath: `public/videos/${basename(storageKey)}`,
    });
    log.push(`REGISTERED existing: ${aliasKey} → ${storageKey}`);
  }

  // Icons alias for favicon under assets/icons (legacy)
  if (!byKey.has("favicon")) {
    const legacy = "assets/icons/favicon.ico";
    const head = await storage.head(legacy);
    if (head.exists) {
      byKey.set("favicon", {
        id: randomUUID(),
        key: "favicon",
        name: "favicon",
        type: "icon",
        kind: "favicons",
        storageKey: legacy,
        url: storage.getUrl(legacy),
        mimeType: "image/x-icon",
        fileSize: head.size ?? 0,
        uploadedAt: new Date().toISOString(),
        etag: head.etag,
        checksum: null,
        localPath: "app/favicon.ico",
      });
    }
  }

  const out = [...byKey.values()].sort((a, b) =>
    a.storageKey.localeCompare(b.storageKey)
  );
  writeFileSync(ASSETS_PATH, JSON.stringify(out, null, 2) + "\n");
  writeFileSync(
    join(process.cwd(), "data", "website-assets-upload-log.txt"),
    log.join("\n") + "\n"
  );
  console.log(`Assets registered: ${out.length}`);
  for (const line of log) console.log(line);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
