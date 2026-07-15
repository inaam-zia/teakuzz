import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { clearBrandingCache, getBranding } from "@/lib/branding";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import type { CafeTheme } from "@/lib/branding-types";
import { resolveFontFamilyId } from "@/lib/branding-types";

export async function GET() {
  const branding = await getBranding();
  return NextResponse.json(branding);
}

export async function PATCH(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const current = await getBranding();

    const updates: {
      app_name?: string;
      logo_url?: string | null;
      tagline?: string;
      theme?: CafeTheme;
      gst_enabled?: boolean;
      gstin?: string | null;
      updated_at: string;
    } = { updated_at: new Date().toISOString() };

    if (typeof body.appName === "string" && body.appName.trim()) {
      updates.app_name = body.appName.trim();
    }

    if (typeof body.tagline === "string") {
      updates.tagline = body.tagline.trim();
    }

    if (body.logoUrl === null || typeof body.logoUrl === "string") {
      updates.logo_url = body.logoUrl;
    }

    if (body.theme && typeof body.theme === "object") {
      const nextTheme = { ...current.theme, ...body.theme };
      nextTheme.fontFamily = resolveFontFamilyId(nextTheme.fontFamily);
      updates.theme = nextTheme;
    }

    if (typeof body.gstEnabled === "boolean") {
      updates.gst_enabled = body.gstEnabled;
    }

    if (body.gstin === null || typeof body.gstin === "string") {
      const gstin = String(body.gstin || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
      updates.gstin = gstin || null;
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("cafe_settings")
      .upsert({ id: 1, ...updates })
      .select()
      .single();

    if (error) {
      if (error.message.includes("gst_")) {
        return NextResponse.json(
          {
            error:
              "Run supabase/add-gst.sql in Supabase SQL editor to enable GST settings.",
          },
          { status: 503 }
        );
      }
      if (error.message.includes("cafe_settings")) {
        return NextResponse.json(
          {
            error:
              "Run supabase/add-cafe-settings.sql in Supabase SQL editor to enable branding.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    clearBrandingCache();
    revalidatePath("/", "layout");
    const branding = await getBranding();
    return NextResponse.json(branding);
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
