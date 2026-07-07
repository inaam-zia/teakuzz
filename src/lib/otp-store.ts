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

/** DB column is `phone` but stores phone digits or normalized email */
export async function getLatestOtp(
  supabase: SupabaseClient,
  identifier: string
): Promise<OtpRow | null> {
  const { data, error } = await supabase
    .from("otp_verifications")
    .select("*")
    .eq("phone", identifier)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as OtpRow;
}

export async function saveOtp(
  supabase: SupabaseClient,
  identifier: string,
  code: string,
  expiresAt: Date
): Promise<{ ok: true } | { ok: false; error: string }> {
  await supabase.from("otp_verifications").delete().eq("phone", identifier);

  const { error } = await supabase.from("otp_verifications").insert({
    phone: identifier,
    code_hash: hashOtp(identifier, code),
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
  identifier: string,
  code: string
): Promise<OtpVerifyResult> {
  const row = await getLatestOtp(supabase, identifier);
  if (!row) return { status: "not_found" };

  if (new Date(row.expires_at) < new Date()) {
    return { status: "expired" };
  }

  if (row.attempts >= otpConfig.maxAttempts) {
    return { status: "too_many_attempts" };
  }

  if (hashOtp(identifier, code) !== row.code_hash) {
    await supabase
      .from("otp_verifications")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return { status: "invalid" };
  }

  await supabase.from("otp_verifications").delete().eq("id", row.id);
  return { status: "ok" };
}
