import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";

export async function isTableOrderable(tableNumber: number): Promise<{
  ok: boolean;
  reason?: "not_found" | "disabled" | "no_config";
}> {
  if (!isSupabaseConfigured()) {
    return { ok: false, reason: "no_config" };
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("cafe_tables")
    .select("enabled")
    .eq("table_number", tableNumber)
    .maybeSingle();

  if (error) {
    if (error.message.includes("cafe_tables")) {
      // Table not configured yet — allow orders (backward compatible)
      return { ok: true };
    }
    return { ok: false, reason: "not_found" };
  }

  if (!data) {
    return { ok: false, reason: "not_found" };
  }

  if (!data.enabled) {
    return { ok: false, reason: "disabled" };
  }

  return { ok: true };
}
