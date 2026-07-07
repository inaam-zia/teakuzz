import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { clearBrandingCache } from "@/lib/branding";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

const BUCKET = "branding";
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Upload a PNG, JPG, or SVG image" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Logo must be under 2 MB" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `logo-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = createServerClient();
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) {
      if (uploadError.message.includes("Bucket not found")) {
        return NextResponse.json(
          { error: "Run supabase/add-cafe-settings.sql to set up logo storage." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "";
    const url = `${base}/storage/v1/object/public/${BUCKET}/${path}`;

    const { error: saveError } = await supabase
      .from("cafe_settings")
      .upsert({ id: 1, logo_url: url, updated_at: new Date().toISOString() });

    if (saveError) {
      return NextResponse.json({ error: formatSupabaseError(saveError) }, { status: 500 });
    }

    clearBrandingCache();
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

export async function DELETE() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("cafe_settings")
      .upsert({ id: 1, logo_url: null, updated_at: new Date().toISOString() });

    if (error) {
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    clearBrandingCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
