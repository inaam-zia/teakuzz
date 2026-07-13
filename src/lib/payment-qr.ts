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

export type UpiPayParams = {
  upiId: string;
  payeeName?: string | null;
  amount: number;
  note?: string;
};

function upiQuery(params: UpiPayParams): string {
  const query = new URLSearchParams({
    pa: params.upiId,
    cu: "INR",
    am: params.amount.toFixed(2),
  });
  if (params.payeeName) query.set("pn", params.payeeName);
  if (params.note) query.set("tn", params.note);
  return query.toString();
}

/** Generic UPI link — OS usually shows an app chooser (GPay, PhonePe, Paytm…). */
export function buildUpiDeepLink(params: UpiPayParams): string {
  return `upi://pay?${upiQuery(params)}`;
}

export type UpiAppOption = {
  id: string;
  label: string;
  href: string;
};

/**
 * App-specific deep links so the customer can pick GPay / PhonePe / Paytm.
 * Amount (`am`) is pre-filled in every link. Works on Android Chrome and iOS Safari
 * when the app is installed; otherwise the generic `upi://` link is the fallback.
 */
export function buildUpiAppLinks(params: UpiPayParams): UpiAppOption[] {
  const q = upiQuery(params);
  return [
    { id: "any", label: "Any UPI app", href: `upi://pay?${q}` },
    { id: "gpay", label: "Google Pay", href: `gpay://upi/pay?${q}` },
    { id: "phonepe", label: "PhonePe", href: `phonepe://pay?${q}` },
    { id: "paytm", label: "Paytm", href: `paytmmp://pay?${q}` },
  ];
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
