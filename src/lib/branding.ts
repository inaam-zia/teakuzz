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
  gst_percent?: number | string | null;
  cgst_percent?: number | string | null;
  sgst_percent?: number | string | null;
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

function normalizePercent(raw?: number | string | null): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, Math.round(n * 100) / 100);
}

function resolveTaxPercents(row: SettingsRow): {
  cgstPercent: number;
  sgstPercent: number;
} {
  let cgst = normalizePercent(row.cgst_percent);
  let sgst = normalizePercent(row.sgst_percent);
  if (cgst <= 0 && sgst <= 0) {
    const legacy = normalizePercent(row.gst_percent);
    if (legacy > 0) {
      cgst = Math.round((legacy / 2) * 100) / 100;
      sgst = Math.round((legacy / 2) * 100) / 100;
    }
  }
  return { cgstPercent: cgst, sgstPercent: sgst };
}

function rowToBranding(row: SettingsRow, defaults: CafeBranding): CafeBranding {
  const gstin = normalizeGstin(row.gstin);
  const { cgstPercent, sgstPercent } = resolveTaxPercents(row);
  return {
    appName: row.app_name?.trim() || defaults.appName,
    logoUrl: row.logo_url || null,
    tagline: row.tagline?.trim() || defaults.tagline,
    theme: mergeTheme(row.theme),
    // Tax lines depend on enable + rates; GSTIN is optional display
    gstEnabled: Boolean(row.gst_enabled),
    gstin,
    cgstPercent,
    sgstPercent,
  };
}

async function loadSettingsRow(): Promise<SettingsRow | null> {
  const supabase = createServerClient();

  const full = await supabase
    .from("cafe_settings")
    .select(
      "app_name, logo_url, tagline, theme, gst_enabled, gstin, gst_percent, cgst_percent, sgst_percent"
    )
    .eq("id", 1)
    .maybeSingle();

  if (!full.error && full.data) return full.data as SettingsRow;

  // Progressively older schemas
  const withLegacyGst = await supabase
    .from("cafe_settings")
    .select("app_name, logo_url, tagline, theme, gst_enabled, gstin, gst_percent")
    .eq("id", 1)
    .maybeSingle();
  if (!withLegacyGst.error && withLegacyGst.data) {
    return withLegacyGst.data as SettingsRow;
  }

  const withGstin = await supabase
    .from("cafe_settings")
    .select("app_name, logo_url, tagline, theme, gst_enabled, gstin")
    .eq("id", 1)
    .maybeSingle();
  if (!withGstin.error && withGstin.data) return withGstin.data as SettingsRow;

  const plain = await supabase
    .from("cafe_settings")
    .select("app_name, logo_url, tagline, theme")
    .eq("id", 1)
    .maybeSingle();
  if (!plain.error && plain.data) return plain.data as SettingsRow;

  return null;
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
    const row = await loadSettingsRow();
    if (!row) return defaults;
    const branding = rowToBranding(row, defaults);
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
