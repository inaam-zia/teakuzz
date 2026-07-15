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
      cgst_percent?: number;
      sgst_percent?: number;
      gst_percent?: number;
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

    const parsePercent = (
      value: unknown,
      label: string
    ): number | NextResponse => {
      const percent = Number(value);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        return NextResponse.json(
          { error: `${label} must be a number between 0 and 100` },
          { status: 400 }
        );
      }
      return Math.round(percent * 100) / 100;
    };

    if (body.cgstPercent !== undefined && body.cgstPercent !== null) {
      const parsed = parsePercent(body.cgstPercent, "CGST %");
      if (parsed instanceof NextResponse) return parsed;
      updates.cgst_percent = parsed;
    }

    if (body.sgstPercent !== undefined && body.sgstPercent !== null) {
      const parsed = parsePercent(body.sgstPercent, "SGST %");
      if (parsed instanceof NextResponse) return parsed;
      updates.sgst_percent = parsed;
    }

    // Keep legacy gst_percent in sync = CGST + SGST for older rows/tools
    if (
      updates.cgst_percent !== undefined ||
      updates.sgst_percent !== undefined
    ) {
      const c =
        updates.cgst_percent !== undefined
          ? updates.cgst_percent
          : current.cgstPercent;
      const s =
        updates.sgst_percent !== undefined
          ? updates.sgst_percent
          : current.sgstPercent;
      updates.gst_percent = Math.round((c + s) * 100) / 100;
    }

    // If GST is being turned on without explicit rates, persist defaults so bills
    // do not end up with GSTIN only and 0% tax.
    if (updates.gst_enabled === true) {
      const nextCgst =
        updates.cgst_percent !== undefined
          ? updates.cgst_percent
          : current.cgstPercent;
      const nextSgst =
        updates.sgst_percent !== undefined
          ? updates.sgst_percent
          : current.sgstPercent;
      if (nextCgst <= 0 && nextSgst <= 0) {
        updates.cgst_percent = 2.5;
        updates.sgst_percent = 2.5;
        updates.gst_percent = 5;
      }
    }

    const supabase = createServerClient();
    let { error } = await supabase
      .from("cafe_settings")
      .upsert({ id: 1, ...updates })
      .select()
      .single();

    // Older DBs may lack cgst_percent / sgst_percent — fall back to gst_percent only.
    if (
      error &&
      (error.message.includes("cgst_percent") ||
        error.message.includes("sgst_percent"))
    ) {
      const {
        cgst_percent: _c,
        sgst_percent: _s,
        ...legacyUpdates
      } = updates;
      if (
        updates.cgst_percent !== undefined ||
        updates.sgst_percent !== undefined
      ) {
        const c = updates.cgst_percent ?? current.cgstPercent;
        const s = updates.sgst_percent ?? current.sgstPercent;
        legacyUpdates.gst_percent = Math.round((c + s) * 100) / 100;
      }
      const retry = await supabase
        .from("cafe_settings")
        .upsert({ id: 1, ...legacyUpdates })
        .select()
        .single();
      error = retry.error;
    }

    if (error) {
      if (error.message.includes("gst_")) {
        return NextResponse.json(
          {
            error:
              "Run supabase/add-gst.sql and supabase/add-cgst-sgst.sql in Supabase SQL editor.",
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
