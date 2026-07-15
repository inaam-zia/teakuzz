import { unstable_noStore as noStore } from "next/cache";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  type CafeBranding,
  type CafeTheme,
  getDefaultBranding,
  mergeTheme,
} from "@/lib/branding-types";

type SettingsRow = {
  app_name: string;
  logo_url: string | null;
  tagline: string | null;
  theme: Partial<CafeTheme> | null;
  gst_enabled?: boolean | null;
  gstin?: string | null;
};

let cache: { data: CafeBranding; at: number } | null = null;
const CACHE_MS = 30_000;

export function clearBrandingCache() {
  cache = null;
}

function normalizeGstin(raw?: string | null): string | null {
  const value = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return value || null;
}

export async function getBranding(): Promise<CafeBranding> {
  noStore();

  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.data;
  }

  const defaults = getDefaultBranding();

  if (!isSupabaseConfigured()) {
    return defaults;
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("cafe_settings")
      .select("app_name, logo_url, tagline, theme, gst_enabled, gstin")
      .eq("id", 1)
      .maybeSingle();

    // Older DBs without GST columns
    if (error?.message?.includes("gst_")) {
      const fallback = await supabase
        .from("cafe_settings")
        .select("app_name, logo_url, tagline, theme")
        .eq("id", 1)
        .maybeSingle();

      if (fallback.error || !fallback.data) {
        return defaults;
      }

      const row = fallback.data as SettingsRow;
      const branding: CafeBranding = {
        appName: row.app_name?.trim() || defaults.appName,
        logoUrl: row.logo_url || null,
        tagline: row.tagline?.trim() || defaults.tagline,
        theme: mergeTheme(row.theme),
        gstEnabled: false,
        gstin: null,
      };
      cache = { data: branding, at: Date.now() };
      return branding;
    }

    if (error || !data) {
      return defaults;
    }

    const row = data as SettingsRow;
    const gstin = normalizeGstin(row.gstin);
    const branding: CafeBranding = {
      appName: row.app_name?.trim() || defaults.appName,
      logoUrl: row.logo_url || null,
      tagline: row.tagline?.trim() || defaults.tagline,
      theme: mergeTheme(row.theme),
      gstEnabled: Boolean(row.gst_enabled) && Boolean(gstin),
      gstin,
    };

    cache = { data: branding, at: Date.now() };
    return branding;
  } catch {
    return defaults;
  }
}

export async function getCafeNameFromBranding(): Promise<string> {
  const branding = await getBranding();
  return branding.appName;
}
