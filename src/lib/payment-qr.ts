import { unstable_noStore as noStore } from "next/cache";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";

export type PaymentQrCode = {
  id: string;
  image_url: string;
  label: string;
  is_active: boolean;
  created_at: string;
};

export async function getActivePaymentQr(): Promise<PaymentQrCode | null> {
  noStore();

  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("payment_qr_codes")
      .select("id, image_url, label, is_active, created_at")
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as PaymentQrCode;
  } catch {
    return null;
  }
}

export async function listPaymentQrCodes(): Promise<PaymentQrCode[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("payment_qr_codes")
    .select("id, image_url, label, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }

  return (data ?? []) as PaymentQrCode[];
}

/** Deactivate all, then activate the chosen QR. */
export async function activatePaymentQr(
  supabase: ReturnType<typeof createServerClient>,
  id: string
): Promise<{ error?: string }> {
  const { error: offError } = await supabase
    .from("payment_qr_codes")
    .update({ is_active: false })
    .eq("is_active", true);

  if (offError) {
    return { error: offError.message };
  }

  const { error: onError } = await supabase
    .from("payment_qr_codes")
    .update({ is_active: true })
    .eq("id", id);

  if (onError) {
    return { error: onError.message };
  }

  return {};
}
