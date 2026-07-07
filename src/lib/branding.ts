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
};

let cache: { data: CafeBranding; at: number } | null = null;
const CACHE_MS = 30_000;

export function clearBrandingCache() {
  cache = null;
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
      .select("app_name, logo_url, tagline, theme")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      return defaults;
    }

    const row = data as SettingsRow;
    const branding: CafeBranding = {
      appName: row.app_name?.trim() || defaults.appName,
      logoUrl: row.logo_url || null,
      tagline: row.tagline?.trim() || defaults.tagline,
      theme: mergeTheme(row.theme),
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
