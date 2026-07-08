import { unstable_noStore as noStore } from "next/cache";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";

export type PaymentQrCode = {
  id: string;
  image_url: string;
  label: string;
  upi_id: string | null;
  payee_name: string | null;
  is_active: boolean;
  created_at: string;
};

const SELECT_COLUMNS = "id, image_url, label, upi_id, payee_name, is_active, created_at";

/** Build a UPI deep link that opens the customer's UPI app with amount pre-filled. */
export function buildUpiDeepLink(params: {
  upiId: string;
  payeeName?: string | null;
  amount: number;
  note?: string;
}): string {
  const query = new URLSearchParams({
    pa: params.upiId,
    cu: "INR",
    am: params.amount.toFixed(2),
  });
  if (params.payeeName) query.set("pn", params.payeeName);
  if (params.note) query.set("tn", params.note);
  return `upi://pay?${query.toString()}`;
}

export async function getActivePaymentQr(): Promise<PaymentQrCode | null> {
  noStore();

  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("payment_qr_codes")
      .select(SELECT_COLUMNS)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      if (error) return getActivePaymentQrFallback();
      return null;
    }

    return data as PaymentQrCode;
  } catch {
    return null;
  }
}

async function getActivePaymentQrFallback(): Promise<PaymentQrCode | null> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("payment_qr_codes")
      .select("id, image_url, label, is_active, created_at")
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return null;
    return { ...data, upi_id: null, payee_name: null } as PaymentQrCode;
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
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    const { data: fallback } = await supabase
      .from("payment_qr_codes")
      .select("id, image_url, label, is_active, created_at")
      .order("created_at", { ascending: false });
    return ((fallback ?? []) as Omit<PaymentQrCode, "upi_id" | "payee_name">[]).map(
      (row) => ({ ...row, upi_id: null, payee_name: null })
    );
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
