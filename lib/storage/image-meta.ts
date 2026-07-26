/** Optional image dimension read — never fails the upload. */

export async function readImageDimensions(buffer: Buffer): Promise<{
  width: number | null;
  height: number | null;
  orientation: number | null;
}> {
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buffer).metadata();
    return {
      width: meta.width ?? null,
      height: meta.height ?? null,
      orientation: typeof meta.orientation === "number" ? meta.orientation : null,
    };
  } catch {
    return { width: null, height: null, orientation: null };
  }
}
