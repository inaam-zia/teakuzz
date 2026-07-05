import type { SupabaseClient } from "@supabase/supabase-js";
import { hashOtp, otpConfig } from "@/lib/otp";

type OtpRow = {
  id: string;
  phone: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  created_at: string;
};

export type OtpVerifyResult =
  | { status: "ok" }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "too_many_attempts" }
  | { status: "not_found" };

export async function getLatestOtp(
  supabase: SupabaseClient,
  phone: string
): Promise<OtpRow | null> {
  const { data, error } = await supabase
    .from("otp_verifications")
    .select("*")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as OtpRow;
}

export async function saveOtp(
  supabase: SupabaseClient,
  phone: string,
  code: string,
  expiresAt: Date
): Promise<{ ok: true } | { ok: false; error: string }> {
  await supabase.from("otp_verifications").delete().eq("phone", phone);

  const { error } = await supabase.from("otp_verifications").insert({
    phone,
    code_hash: hashOtp(phone, code),
    expires_at: expiresAt.toISOString(),
    attempts: 0,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function verifyStoredOtp(
  supabase: SupabaseClient,
  phone: string,
  code: string
): Promise<OtpVerifyResult> {
  const row = await getLatestOtp(supabase, phone);
  if (!row) return { status: "not_found" };

  if (new Date(row.expires_at) < new Date()) {
    return { status: "expired" };
  }

  if (row.attempts >= otpConfig.maxAttempts) {
    return { status: "too_many_attempts" };
  }

  if (hashOtp(phone, code) !== row.code_hash) {
    await supabase
      .from("otp_verifications")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return { status: "invalid" };
  }

  await supabase.from("otp_verifications").delete().eq("id", row.id);
  return { status: "ok" };
}
