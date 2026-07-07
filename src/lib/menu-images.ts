import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "menu-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function getMenuImagePublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "";
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function uploadMenuImage(
  supabase: SupabaseClient,
  file: File
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: "Use a JPG, PNG, WebP, or GIF image" };
  }

  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Image must be under 5 MB" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    if (error.message.includes("Bucket not found")) {
      return {
        ok: false,
        error:
          "Image storage not set up. Run supabase/add-menu-image.sql in Supabase SQL editor.",
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, url: getMenuImagePublicUrl(path) };
}
