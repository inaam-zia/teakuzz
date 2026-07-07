import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { activatePaymentQr, listPaymentQrCodes } from "@/lib/payment-qr";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

const BUCKET = "branding";
const MAX_BYTES = 2 * 1024 * 1024;

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const codes = await listPaymentQrCodes();
  return NextResponse.json({ codes });
}

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
    const label = String(formData.get("label") || "").trim();
    const setActive = formData.get("setActive") !== "false";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Upload a PNG or JPG image" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be under 2 MB" }, { status: 400 });
    }

    const supabase = createServerClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `payment-qr/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      if (uploadError.message.includes("Bucket not found")) {
        return NextResponse.json(
          { error: "Run supabase/add-cafe-settings.sql to set up storage." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "";
    const imageUrl = `${base}/storage/v1/object/public/${BUCKET}/${path}`;

    const { count } = await supabase
      .from("payment_qr_codes")
      .select("id", { count: "exact", head: true });

    const shouldActivate = setActive || (count ?? 0) === 0;

    if (shouldActivate) {
      await supabase.from("payment_qr_codes").update({ is_active: false }).eq("is_active", true);
    }

    const { data, error: insertError } = await supabase
      .from("payment_qr_codes")
      .insert({
        image_url: imageUrl,
        label,
        is_active: shouldActivate,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.message.includes("payment_qr_codes")) {
        return NextResponse.json(
          { error: "Run supabase/add-payment-qr.sql in Supabase SQL editor first." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: formatSupabaseError(insertError) }, { status: 500 });
    }

    return NextResponse.json({ code: data });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
